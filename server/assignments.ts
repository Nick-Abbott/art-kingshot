import type { AssignmentResult, Member } from "../shared/types";

type AssignmentOutgoingEntry = {
  toId: string;
  toName: string;
  troops: number;
  lead: boolean;
};

type AssignmentIncomingEntry = {
  fromId: string;
  fromName: string;
  troops: number;
  lead: boolean;
};

type IncomingMeta = Map<
  string,
  {
    total: number;
    effectiveTotal: number;
    from: AssignmentIncomingEntry[];
  }
>;

type AnnotatedMember = Member & { whale: boolean };

function getOutgoing(
  outgoing: Map<string, AssignmentOutgoingEntry[]>,
  playerId: string
): AssignmentOutgoingEntry[] {
  const list = outgoing.get(playerId);
  if (!list) {
    throw new Error(`Missing outgoing data for ${playerId}.`);
  }
  return list;
}

function getIncoming(incoming: IncomingMeta, playerId: string) {
  const entry = incoming.get(playerId);
  if (!entry) {
    throw new Error(`Missing incoming data for ${playerId}.`);
  }
  return entry;
}

const NEED_PER_CITY = 200000;
const MAX_SEND = 100000;
const MAX_SEND_WHALE = 150000;
const WHALE_MULTIPLIER = 2.5;
const WHALE_TROOP_WEIGHT = 1.5;

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function buildEmptyIncoming(members: { playerId: string }[]): IncomingMeta {
  const incoming: IncomingMeta = new Map();
  for (const member of members) {
    incoming.set(member.playerId, {
      total: 0,
      effectiveTotal: 0,
      from: [],
    });
  }
  return incoming;
}

function pickMaxNeedTarget(
  needs: Map<string, number>,
  excludeId: string,
  excludeTargets: Set<string> | null,
  incomingMeta: IncomingMeta | null
): string | null {
  let bestId = null;
  let bestNeed = 0;
  let bestIncoming = Number.POSITIVE_INFINITY;
  for (const [playerId, need] of needs.entries()) {
    if (playerId === excludeId) continue;
    if (excludeTargets?.has(playerId)) continue;
    const incomingCount = incomingMeta?.get(playerId)?.from.length ?? 0;
    if (need > bestNeed) {
      bestNeed = need;
      bestId = playerId;
      bestIncoming = incomingCount;
    } else if (need === bestNeed && incomingCount < bestIncoming) {
      bestId = playerId;
      bestIncoming = incomingCount;
    }
  }
  return bestId;
}

function pickLowestIncomingTarget(
  targets: string[],
  excludeTargets: Set<string> | null,
  incomingMeta: IncomingMeta | null
): string | null {
  let bestId = null;
  let bestTotal = Number.POSITIVE_INFINITY;

  for (const playerId of targets) {
    if (excludeTargets?.has(playerId)) continue;
    const total = incomingMeta?.get(playerId)?.effectiveTotal ?? 0;

    if (bestId === null) {
      bestId = playerId;
      bestTotal = total;
      continue;
    }

    if (total < bestTotal) {
      bestId = playerId;
      bestTotal = total;
    }
  }

  return bestId;
}

function validateMembers(members: Member[]) {
  const warnings: string[] = [];
  const warningCodes: string[] = [];

  const pushWarning = (message: string, code: string) => {
    warnings.push(message);
    warningCodes.push(code);
  };

  if (!Array.isArray(members) || members.length < 2) {
    pushWarning(
      "Need at least 2 members to generate assignments.",
      "assignments_need_members"
    );
    return { warnings, warningCodes, validMembers: [] };
  }

  const validMembers = members.filter((member) => {
    if (!member.playerId || typeof member.playerId !== "string") {
      pushWarning(
        "Skipped a member with invalid playerId.",
        "assignments_invalid_player_id"
      );
      return false;
    }
    if (!Number.isFinite(member.troopCount) || member.troopCount <= 0) {
      pushWarning(
        `Skipped ${member.playerId} with invalid troop count.`,
        "assignments_invalid_troop_count"
      );
      return false;
    }
    if (!Number.isFinite(member.marchCount) || member.marchCount <= 0) {
      pushWarning(
        `Skipped ${member.playerId} with invalid march count.`,
        "assignments_invalid_march_count"
      );
      return false;
    }
    if (!Number.isFinite(member.power) || member.power <= 0) {
      pushWarning(
        `Skipped ${member.playerId} with invalid power.`,
        "assignments_invalid_power"
      );
      return false;
    }
    return true;
  });

  if (validMembers.length < 2) {
    pushWarning(
      "Not enough valid members to build assignments.",
      "assignments_not_enough_valid"
    );
    return { warnings, warningCodes, validMembers };
  }

  for (const member of validMembers) {
    const maxFromOthers = sum(
      validMembers
        .filter((other) => other.playerId !== member.playerId)
        .map((other) => {
          const isWhale = (other as Partial<AnnotatedMember>).whale === true;
          const cap = isWhale ? MAX_SEND_WHALE : MAX_SEND;
          return Math.min(other.troopCount, cap * other.marchCount);
        })
    );
    if (maxFromOthers < NEED_PER_CITY) {
      pushWarning(
        `City ${member.playerId} may not reach 200k with current troops.`,
        "assignments_city_under_200k"
      );
    }
  }

  return { warnings, warningCodes, validMembers };
}

function medianPower(members: Member[]): number {
  const sorted = members.map((m) => m.power).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function annotateWhales(members: Member[]): AnnotatedMember[] {
  const median = medianPower(members);
  const whaleThreshold = median * WHALE_MULTIPLIER;
  return members.map((member) => ({
    ...member,
    whale: member.power >= whaleThreshold,
  }));
}

function generateAssignments(members: Member[]): AssignmentResult {
  const { warnings, warningCodes, validMembers } = validateMembers(members);
  if (validMembers.length < 2) {
    return {
      members: [],
      warnings,
      warningCodes,
    };
  }

  const annotated = annotateWhales(validMembers);
  const needs = new Map<string, number>();
  const outgoing = new Map<string, AssignmentOutgoingEntry[]>();
  const incoming = buildEmptyIncoming(annotated);

  for (const member of annotated) {
    needs.set(member.playerId, NEED_PER_CITY);
    outgoing.set(member.playerId, []);
  }

  const remainingBySender = new Map<string, number>();
  const marchesRemaining = new Map<string, number>();
  const perMarchBaseBySender = new Map<string, number>();
  const perMarchRemainderBySender = new Map<string, number>();

  for (const member of annotated) {
    const cap = member.whale ? MAX_SEND_WHALE : MAX_SEND;
    const avg = member.troopCount / member.marchCount;
    let base = Math.floor(avg);
    let remainder = member.troopCount - base * member.marchCount;
    if (avg > cap) {
      base = Math.floor(cap);
      remainder = 0;
    }
    perMarchBaseBySender.set(member.playerId, Math.max(0, base));
    perMarchRemainderBySender.set(member.playerId, Math.max(0, remainder));
    marchesRemaining.set(member.playerId, member.marchCount);
    remainingBySender.set(member.playerId, member.troopCount);
  }

  function nextMarchAmount(senderId: string, remaining: number): number {
    const base = perMarchBaseBySender.get(senderId) || 0;
    if (base <= 0 || remaining < base) return 0;
    const remainder = perMarchRemainderBySender.get(senderId) || 0;
    if (remainder > 0 && remaining >= base + 1) {
      perMarchRemainderBySender.set(senderId, remainder - 1);
      return base + 1;
    }
    return base;
  }

  function effectiveTroops(sender: AnnotatedMember, troops: number): number {
    return sender.whale ? troops * WHALE_TROOP_WEIGHT : troops;
  }

  // Fill remaining needs and then dump remaining troops to get armies out.
  for (const sender of annotated) {
    const senderOutgoing = getOutgoing(outgoing, sender.playerId);
    const assignedTargets = new Set(senderOutgoing.map((item) => item.toId));
    let remaining =
      sender.troopCount - sum(senderOutgoing.map((o) => o.troops));
    remainingBySender.set(sender.playerId, remaining);

    const targets = annotated
      .filter((member) => member.playerId !== sender.playerId)
      .map((member) => member.playerId);

    // First pass: satisfy needs.
    while (remaining > 0 && (marchesRemaining.get(sender.playerId) ?? 0) > 0) {
      const targetId = pickMaxNeedTarget(
        needs,
        sender.playerId,
        assignedTargets,
        incoming
      );
      if (!targetId) break;

      const need = needs.get(targetId) || 0;
      if (need <= 0) break;

      const sendAmount = nextMarchAmount(sender.playerId, remaining);
      if (sendAmount <= 0) break;

      remaining -= sendAmount;
      needs.set(targetId, Math.max(0, need - effectiveTroops(sender, sendAmount)));
      assignedTargets.add(targetId);
      marchesRemaining.set(
        sender.playerId,
        (marchesRemaining.get(sender.playerId) ?? 0) - 1
      );

      const targetMember = annotated.find(
        (member) => member.playerId === targetId
      );
      const senderOutgoing = getOutgoing(outgoing, sender.playerId);
      senderOutgoing.push({
        toId: targetId,
        toName: targetMember?.playerName || "",
        troops: sendAmount,
        lead: Boolean(sender.whale),
      });

      const incomingTarget = incoming.get(targetId);
      if (!incomingTarget) break;
      incomingTarget.total += sendAmount;
      incomingTarget.effectiveTotal += effectiveTroops(sender, sendAmount);
      incomingTarget.from.push({
        fromId: sender.playerId,
        fromName: sender.playerName || "",
        troops: sendAmount,
        lead: Boolean(sender.whale),
      });
    }

    // Second pass: balance incoming totals while getting troops out.
    while (remaining > 0 && (marchesRemaining.get(sender.playerId) ?? 0) > 0) {
      const targetId = pickLowestIncomingTarget(
        targets,
        assignedTargets,
        incoming
      );
      if (!targetId) break;

      const incomingTarget = incoming.get(targetId);
      if (!incomingTarget) break;
      const sendAmount = nextMarchAmount(sender.playerId, remaining);
      if (sendAmount <= 0) break;

      remaining -= sendAmount;
      assignedTargets.add(targetId);
      marchesRemaining.set(
        sender.playerId,
        (marchesRemaining.get(sender.playerId) ?? 0) - 1
      );

      const targetMember = annotated.find(
        (member) => member.playerId === targetId
      );
      const senderOutgoing = getOutgoing(outgoing, sender.playerId);
      senderOutgoing.push({
        toId: targetId,
        toName: targetMember?.playerName || "",
        troops: sendAmount,
        lead: Boolean(sender.whale),
      });

      incomingTarget.total += sendAmount;
      incomingTarget.effectiveTotal += effectiveTroops(sender, sendAmount);
      incomingTarget.from.push({
        fromId: sender.playerId,
        fromName: sender.playerName || "",
        troops: sendAmount,
        lead: Boolean(sender.whale),
      });
    }

    remainingBySender.set(sender.playerId, remaining);
  }

  // Fill remaining needs with standard marches, respecting march counts.
  let progress = true;
  while (progress) {
    progress = false;
    const targets = Array.from(needs.entries())
      .filter(([_playerId, need]) => need > 0)
      .map(([playerId]) => playerId)
      .sort((aId, bId) => {
        const aNeed = needs.get(aId) || 0;
        const bNeed = needs.get(bId) || 0;
        const aIncoming = incoming.get(aId)?.from.length ?? 0;
        const bIncoming = incoming.get(bId)?.from.length ?? 0;
        if (bNeed !== aNeed) return bNeed - aNeed;
        return aIncoming - bIncoming;
      });

    for (const targetId of targets) {
      const incomingTarget = incoming.get(targetId);
      if (!incomingTarget) continue;
      const sender = annotated.find((candidate) => {
        if (candidate.playerId === targetId) return false;
        if ((marchesRemaining.get(candidate.playerId) ?? 0) <= 0) return false;
        if ((remainingBySender.get(candidate.playerId) || 0) <= 0) {
          return false;
        }
        const candidateOutgoing = getOutgoing(outgoing, candidate.playerId);
        if (candidateOutgoing.some((o) => o.toId === targetId)) {
          return false;
        }
        return true;
      });

      if (!sender) continue;
      const remaining = remainingBySender.get(sender.playerId) || 0;
      const need = needs.get(targetId) || 0;
      const sendAmount = nextMarchAmount(sender.playerId, remaining);
      if (sendAmount <= 0) continue;

      remainingBySender.set(sender.playerId, remaining - sendAmount);
      marchesRemaining.set(
        sender.playerId,
        (marchesRemaining.get(sender.playerId) ?? 0) - 1
      );

      const targetMember = annotated.find(
        (member) => member.playerId === targetId
      );
      const senderOutgoing = getOutgoing(outgoing, sender.playerId);
      senderOutgoing.push({
        toId: targetId,
        toName: targetMember?.playerName || "",
        troops: sendAmount,
        lead: Boolean(sender.whale),
      });

      incomingTarget.total += sendAmount;
      incomingTarget.effectiveTotal += effectiveTroops(sender, sendAmount);
      incomingTarget.from.push({
        fromId: sender.playerId,
        fromName: sender.playerName || "",
        troops: sendAmount,
        lead: Boolean(sender.whale),
      });
      needs.set(targetId, Math.max(0, need - effectiveTroops(sender, sendAmount)));
      progress = true;
    }
  }

  for (const member of annotated) {
    const outgoingCount = outgoing.get(member.playerId)?.length ?? 0;
    if (outgoingCount > member.marchCount) {
      warnings.push(`${member.playerId} exceeds march limit.`);
    }
    if ((remainingBySender.get(member.playerId) || 0) > 0) {
      warnings.push(`${member.playerId} still has troops at home.`);
    }
  }

  const powerById = new Map<string, number>();
  const nameById = new Map<string, string>();
  for (const member of annotated) {
    powerById.set(member.playerId, member.power);
    nameById.set(member.playerId, member.playerName || "");
  }

  const baseResult = annotated.map((member) => {
    const incomingInfo = getIncoming(incoming, member.playerId);
    const outgoingInfo = getOutgoing(outgoing, member.playerId);
    const outgoingTotal = sum(outgoingInfo.map((entry) => entry.troops));
    let garrisonLeadId: string | undefined;
    let garrisonLeadName = "";
    let maxLeadTroops = 0;
    for (const entry of incomingInfo.from) {
      if (entry.lead && entry.troops > maxLeadTroops) {
        maxLeadTroops = entry.troops;
        garrisonLeadId = entry.fromId;
        garrisonLeadName = entry.fromName || "";
      }
    }
    if (!garrisonLeadId) {
      let bestLeadId: string | undefined;
      let bestLeadPower = 0;
      for (const entry of incomingInfo.from) {
        const senderPower = powerById.get(entry.fromId) || 0;
        if (senderPower > bestLeadPower) {
          bestLeadPower = senderPower;
          bestLeadId = entry.fromId;
        }
      }
      if (bestLeadId && bestLeadPower > member.power * 1.4) {
        garrisonLeadId = bestLeadId;
        garrisonLeadName = nameById.get(bestLeadId) || "";
      }
    }

    return {
      playerId: member.playerId,
      playerName: member.playerName || "",
      troopCount: member.troopCount,
      troopsRemaining: Math.max(0, member.troopCount - outgoingTotal),
      outgoing: outgoingInfo,
      incoming: incomingInfo.from,
      incomingTotal: incomingInfo.total,
      garrisonLeadId,
      garrisonLeadName,
    };
  });

  const leadByTarget = new Map<string, string>();
  for (const member of baseResult) {
    if (member.garrisonLeadId) {
      leadByTarget.set(member.playerId, member.garrisonLeadId);
    }
  }

  const result = baseResult.map((member) => {
    const outgoingInfo = member.outgoing.map((entry) => ({
      ...entry,
      lead: leadByTarget.get(entry.toId) === member.playerId,
    }));
    const incomingInfo = member.incoming.map((entry) => ({
      ...entry,
      lead: leadByTarget.get(member.playerId) === entry.fromId,
    }));
    return {
      ...member,
      outgoing: outgoingInfo,
      incoming: incomingInfo,
    };
  });

  for (const member of result) {
    const incomingInfo = getIncoming(incoming, member.playerId);
    const effectiveIncoming = incomingInfo.effectiveTotal ?? member.incomingTotal;
    if (effectiveIncoming < NEED_PER_CITY && !member.garrisonLeadId) {
      warnings.push(
        `City ${member.playerId} did not reach ${NEED_PER_CITY} reinforcements.`
      );
      warningCodes.push("assignments_city_below_requirement");
    }
  }

  return {
    members: result,
    warnings,
    warningCodes,
  };
}

export {
  generateAssignments,
  NEED_PER_CITY,
  MAX_SEND,
  MAX_SEND_WHALE,
  WHALE_MULTIPLIER,
};
