import type { AssignmentResult, Member } from "../shared/types";
import fs from "node:fs";
import path from "node:path";

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
const RECENCY_PENALTY_START = 0.6;
const RECENCY_PENALTY_FALLBACK_ROUNDS = 4;
const LEADER_PENALTY_FREE_PICKS = 2;
const LEADER_PENALTY_MIN = 0.6;
const LEADER_PENALTY_MAX_PICKS = 6;
const DEBUG_LOG_PATH = path.join(process.cwd(), "assignment-debug.log");
const DEBUG_LOG_ENABLED = process.env.ASSIGNMENT_DEBUG === "1";

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

function buildMarchSizes(member: AnnotatedMember): number[] {
  const cap = member.whale ? MAX_SEND_WHALE : MAX_SEND;
  const avg = member.troopCount / member.marchCount;
  let base = Math.floor(avg);
  let remainder = member.troopCount - base * member.marchCount;
  if (avg > cap) {
    base = Math.floor(cap);
    remainder = 0;
  }

  const sizes: number[] = [];
  if (base <= 0) {
    for (let i = 0; i < remainder; i += 1) {
      sizes.push(1);
    }
  } else {
    for (let i = 0; i < remainder; i += 1) {
      sizes.push(base + 1);
    }
    for (let i = 0; i < member.marchCount - remainder; i += 1) {
      sizes.push(base);
    }
  }

  return sizes.filter((size) => size > 0).sort((a, b) => a - b);
}

function getRecencyPenaltyStep(whaleMarchTotal: number): number {
  if (!Number.isFinite(whaleMarchTotal) || whaleMarchTotal <= 0) {
    return (1 - RECENCY_PENALTY_START) / RECENCY_PENALTY_FALLBACK_ROUNDS;
  }
  return (1 - RECENCY_PENALTY_START) / whaleMarchTotal;
}

function getLeaderPenaltyMultiplier(leadCount: number): number {
  if (!Number.isFinite(leadCount) || leadCount <= LEADER_PENALTY_FREE_PICKS) {
    return 1;
  }
  if (leadCount >= LEADER_PENALTY_MAX_PICKS) {
    return LEADER_PENALTY_MIN;
  }
  const steps = LEADER_PENALTY_MAX_PICKS - LEADER_PENALTY_FREE_PICKS;
  const progress = (leadCount - LEADER_PENALTY_FREE_PICKS) / steps;
  const eased = Math.pow(progress, 2);
  return 1 - (1 - LEADER_PENALTY_MIN) * eased;
}

function isLeadEligible(sender: AnnotatedMember, target: AnnotatedMember): boolean {
  if (target.whale) return false;
  return sender.whale || sender.power >= target.power * 1.25;
}

function generateAssignments(members: Member[]): AssignmentResult {
  const debugLines: string[] = [];
  const logDebug = (line: string) => {
    if (!DEBUG_LOG_ENABLED) return;
    debugLines.push(line);
  };
  const { warnings, warningCodes, validMembers } = validateMembers(members);
  if (validMembers.length < 2) {
    return {
      members: [],
      warnings,
      warningCodes,
    };
  }

  const annotated = annotateWhales(validMembers);
  const outgoing = new Map<string, AssignmentOutgoingEntry[]>();
  const incoming = buildEmptyIncoming(annotated);
  const assignedTargetsBySender = new Map<string, Set<string>>();
  const marchSizesBySender = new Map<string, number[]>();
  const memberById = new Map<string, AnnotatedMember>();
  const powerById = new Map<string, number>();
  const nameById = new Map<string, string>();
  const leaderCountById = new Map<string, number>();
  const leaderAssignments = new Map<string, { senderId: string; troops: number }>();

  for (const member of annotated) {
    outgoing.set(member.playerId, []);
    assignedTargetsBySender.set(member.playerId, new Set());
    marchSizesBySender.set(member.playerId, buildMarchSizes(member));
    memberById.set(member.playerId, member);
    powerById.set(member.playerId, member.power);
    nameById.set(member.playerId, member.playerName || "");
    leaderCountById.set(member.playerId, 0);
  }

  function effectiveTroops(sender: AnnotatedMember, troops: number): number {
    return sender.whale ? troops * WHALE_TROOP_WEIGHT : troops;
  }

  const assignMarch = (
    sender: AnnotatedMember,
    targetId: string,
    troops: number
  ) => {
    const senderOutgoing = getOutgoing(outgoing, sender.playerId);
    const targetMember = memberById.get(targetId);
    senderOutgoing.push({
      toId: targetId,
      toName: targetMember?.playerName || "",
      troops,
      lead: Boolean(sender.whale),
    });
    const incomingTarget = incoming.get(targetId);
    if (!incomingTarget) return;
    incomingTarget.total += troops;
    incomingTarget.effectiveTotal += effectiveTroops(sender, troops);
    incomingTarget.from.push({
      fromId: sender.playerId,
      fromName: sender.playerName || "",
      troops,
      lead: Boolean(sender.whale),
    });
  };

  // Pass 1: seed leads where eligible (best effort).
  const targetsByPower = [...annotated].sort((a, b) => a.power - b.power);
  for (const target of targetsByPower) {
    let bestSender: AnnotatedMember | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const sender of annotated) {
      if (sender.playerId === target.playerId) continue;
      if (!isLeadEligible(sender, target)) continue;
      const sizes = marchSizesBySender.get(sender.playerId) || [];
      if (sizes.length === 0) continue;
      const leadCount = leaderCountById.get(sender.playerId) || 0;
      const multiplier = getLeaderPenaltyMultiplier(leadCount + 1);
      const score = sender.power * multiplier;
      if (score < bestScore) {
        bestScore = score;
        bestSender = sender;
      }
    }
    if (!bestSender) continue;
    const sizes = marchSizesBySender.get(bestSender.playerId);
    if (!sizes || sizes.length === 0) continue;
    const troops = sizes.shift();
    if (!troops) continue;
    logDebug(
      `pass1 seed target=${target.playerName}(${target.playerId}) sender=${bestSender.playerName}(${bestSender.playerId}) troops=${troops}`
    );
    leaderAssignments.set(target.playerId, {
      senderId: bestSender.playerId,
      troops,
    });
    leaderCountById.set(
      bestSender.playerId,
      (leaderCountById.get(bestSender.playerId) || 0) + 1
    );
  }

  const insertMarchSize = (sizes: number[], troops: number) => {
    sizes.push(troops);
    sizes.sort((a, b) => a - b);
  };

  // Pass 2: top-down leader refinement with penalty-adjusted swaps.
  const targetsWithLeader = [...annotated]
    .filter((member) => leaderAssignments.has(member.playerId))
    .sort((a, b) => b.power - a.power);
  for (const target of targetsWithLeader) {
    const current = leaderAssignments.get(target.playerId);
    if (!current) continue;
    const currentSender = memberById.get(current.senderId);
    if (!currentSender) continue;
    const currentLeadCount = leaderCountById.get(current.senderId) || 0;
    const currentMultiplier = getLeaderPenaltyMultiplier(currentLeadCount);
    const currentScore = currentSender.power * currentMultiplier;

    let bestSender: AnnotatedMember | null = null;
    let bestScore = currentScore;
    for (const sender of annotated) {
      if (sender.playerId === target.playerId) continue;
      if (!isLeadEligible(sender, target)) continue;
      const sizes = marchSizesBySender.get(sender.playerId) || [];
      if (sender.playerId !== current.senderId && sizes.length === 0) continue;
      const leadCount = leaderCountById.get(sender.playerId) || 0;
      const multiplier = getLeaderPenaltyMultiplier(leadCount + 1);
      const score = sender.power * multiplier;
      if (score > bestScore) {
        bestScore = score;
        bestSender = sender;
      }
    }

    if (bestSender && bestSender.playerId !== current.senderId) {
      const bestSizes = marchSizesBySender.get(bestSender.playerId) || [];
      const bestTroops = bestSizes.shift();
      if (!bestTroops) continue;
      const currentSizes = marchSizesBySender.get(current.senderId) || [];
      insertMarchSize(currentSizes, current.troops);
      leaderAssignments.set(target.playerId, {
        senderId: bestSender.playerId,
        troops: bestTroops,
      });
      leaderCountById.set(
        current.senderId,
        Math.max(0, (leaderCountById.get(current.senderId) || 0) - 1)
      );
      leaderCountById.set(
        bestSender.playerId,
        (leaderCountById.get(bestSender.playerId) || 0) + 1
      );
      logDebug(
        `pass2 swap target=${target.playerName}(${target.playerId}) from=${currentSender.playerName}(${currentSender.playerId}) to=${bestSender.playerName}(${bestSender.playerId}) score=${bestScore.toFixed(2)}`
      );
    } else {
      logDebug(
        `pass2 keep target=${target.playerName}(${target.playerId}) leader=${currentSender.playerName}(${currentSender.playerId}) score=${currentScore.toFixed(2)}`
      );
    }
  }

  const leadByTarget = new Map<string, string>();
  for (const [targetId, assignment] of leaderAssignments.entries()) {
    const sender = memberById.get(assignment.senderId);
    if (!sender) continue;
    assignMarch(sender, targetId, assignment.troops);
    assignedTargetsBySender.get(sender.playerId)?.add(targetId);
    leadByTarget.set(targetId, assignment.senderId);
  }

  // Pass 3: equalize by effective incoming with remaining marches.
  const remainingMarches: Array<{
    senderId: string;
    troops: number;
  }> = [];
  for (const sender of annotated) {
    const sizes = marchSizesBySender.get(sender.playerId) || [];
    for (const troops of sizes) {
      remainingMarches.push({ senderId: sender.playerId, troops });
    }
  }
  const whaleMarchTotal = annotated
    .filter((member) => member.whale)
    .reduce((total, member) => total + member.marchCount, 0);
  const recencyStep = getRecencyPenaltyStep(whaleMarchTotal);
  const senderMultiplierById = new Map(
    annotated.map((member) => [member.playerId, 1])
  );

  const allTargets = annotated.map((member) => member.playerId);
  while (remainingMarches.length > 0) {
    let bestIndex = -1;
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestTroops = 0;
    let bestPower = 0;

    for (let index = 0; index < remainingMarches.length; index += 1) {
      const march = remainingMarches[index];
      const sender = memberById.get(march.senderId);
      if (!sender) continue;
      const senderMultiplier = senderMultiplierById.get(march.senderId) || 1;
      const score = effectiveTroops(sender, march.troops) * senderMultiplier;
      if (score > bestScore) {
        bestScore = score;
        bestTroops = march.troops;
        bestPower = powerById.get(march.senderId) || 0;
        bestIndex = index;
        continue;
      }
      if (score === bestScore) {
        const power = powerById.get(march.senderId) || 0;
        if (march.troops > bestTroops || (march.troops === bestTroops && power > bestPower)) {
          bestScore = score;
          bestTroops = march.troops;
          bestPower = power;
          bestIndex = index;
        }
      }
    }

    const march = remainingMarches.splice(bestIndex, 1)[0];
    const sender = memberById.get(march.senderId);
    if (!sender) continue;
    const excludeTargets = assignedTargetsBySender.get(march.senderId) || new Set();
    const targets = allTargets.filter((id) => id !== march.senderId);
    const targetId = pickLowestIncomingTarget(targets, excludeTargets, incoming);
    if (!targetId) continue;
    logDebug(
      `pass2 march sender=${sender.playerName}(${sender.playerId}) troops=${march.troops} target=${nameById.get(targetId) || ""}(${targetId}) score=${bestScore.toFixed(2)}`
    );
    assignMarch(sender, targetId, march.troops);
    excludeTargets.add(targetId);
    assignedTargetsBySender.set(march.senderId, excludeTargets);

    if (recencyStep > 0) {
      senderMultiplierById.set(march.senderId, RECENCY_PENALTY_START);
      for (const [senderId, multiplier] of senderMultiplierById.entries()) {
        if (senderId === march.senderId || multiplier >= 1) continue;
        senderMultiplierById.set(senderId, Math.min(1, multiplier + recencyStep));
      }
    }
  }

  const baseResult = annotated.map((member) => {
    const incomingInfo = getIncoming(incoming, member.playerId);
    const outgoingInfo = getOutgoing(outgoing, member.playerId);
    const outgoingTotal = sum(outgoingInfo.map((entry) => entry.troops));
    const garrisonLeadId = leadByTarget.get(member.playerId);
    const garrisonLeadName = garrisonLeadId ? nameById.get(garrisonLeadId) || "" : "";

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

  const result = baseResult.map((member) => ({
    ...member,
    outgoing: member.outgoing.map((entry) => ({
      ...entry,
      lead: leadByTarget.get(entry.toId) === member.playerId,
    })),
    incoming: member.incoming.map((entry) => ({
      ...entry,
      lead: leadByTarget.get(member.playerId) === entry.fromId,
    })),
  }));

  for (const member of result) {
    const outgoingCount = member.outgoing.length;
    if (outgoingCount > (memberById.get(member.playerId)?.marchCount || 0)) {
      warnings.push(`${member.playerId} exceeds march limit.`);
    }
    if ((member.troopsRemaining || 0) > 0) {
      warnings.push(`${member.playerId} still has troops at home.`);
    }
    const incomingInfo = getIncoming(incoming, member.playerId);
    const effectiveIncoming = incomingInfo.effectiveTotal ?? member.incomingTotal;
    if (effectiveIncoming < NEED_PER_CITY && !member.garrisonLeadId) {
      warnings.push(
        `City ${member.playerId} did not reach ${NEED_PER_CITY} reinforcements.`
      );
      warningCodes.push("assignments_city_below_requirement");
    }
  }

  if (DEBUG_LOG_ENABLED && debugLines.length > 0) {
    try {
      fs.writeFileSync(DEBUG_LOG_PATH, debugLines.join("\n"));
    } catch {
      warnings.push("Unable to write assignment debug log.");
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
  RECENCY_PENALTY_START,
  RECENCY_PENALTY_FALLBACK_ROUNDS,
  LEADER_PENALTY_FREE_PICKS,
  LEADER_PENALTY_MIN,
  LEADER_PENALTY_MAX_PICKS,
  DEBUG_LOG_PATH,
  getLeaderPenaltyMultiplier,
  getRecencyPenaltyStep,
};
