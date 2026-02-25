const NEED_PER_CITY = 200000;
const MAX_SEND = 100000;
const MAX_SEND_WHALE = 150000;
const WHALE_MULTIPLIER = 2.5;

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function buildEmptyIncoming(members) {
  const incoming = new Map();
  for (const member of members) {
    incoming.set(member.playerId, {
      total: 0,
      from: [],
      hasWhale: false,
    });
  }
  return incoming;
}

function pickMaxNeedTarget(needs, excludeId, excludeTargets, incomingMeta) {
  let bestId = null;
  let bestNeed = 0;
  let bestIncoming = Number.POSITIVE_INFINITY;
  for (const [playerId, need] of needs.entries()) {
    if (playerId === excludeId) continue;
    if (excludeTargets?.has(playerId)) continue;
    if (incomingMeta?.get(playerId)?.hasWhale) continue;
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

function pickLowestIncomingTarget(targets, excludeTargets, incomingMeta) {
  let bestId = null;
  let bestTotal = Number.POSITIVE_INFINITY;

  for (const playerId of targets) {
    if (excludeTargets?.has(playerId)) continue;
    const total = incomingMeta?.get(playerId)?.total ?? 0;

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

function validateMembers(members) {
  const warnings = [];

  if (!Array.isArray(members) || members.length < 2) {
    warnings.push("Need at least 2 members to generate assignments.");
    return { warnings, validMembers: [] };
  }

  const validMembers = members.filter((member) => {
    if (!member.playerId || typeof member.playerId !== "string") {
      warnings.push("Skipped a member with invalid playerId.");
      return false;
    }
    if (!Number.isFinite(member.troopCount) || member.troopCount <= 0) {
      warnings.push(`Skipped ${member.playerId} with invalid troop count.`);
      return false;
    }
    if (!Number.isFinite(member.marchCount) || member.marchCount <= 0) {
      warnings.push(`Skipped ${member.playerId} with invalid march count.`);
      return false;
    }
    if (!Number.isFinite(member.power) || member.power <= 0) {
      warnings.push(`Skipped ${member.playerId} with invalid power.`);
      return false;
    }
    return true;
  });

  if (validMembers.length < 2) {
    warnings.push("Not enough valid members to build assignments.");
    return { warnings, validMembers };
  }

  for (const member of validMembers) {
    const maxFromOthers = sum(
      validMembers
        .filter((other) => other.playerId !== member.playerId)
        .map((other) => {
          const cap = other.whale ? MAX_SEND_WHALE : MAX_SEND;
          return Math.min(other.troopCount, cap * other.marchCount);
        })
    );
    if (maxFromOthers < NEED_PER_CITY) {
      warnings.push(
        `City ${member.playerId} may not reach 200k with current troops.`
      );
    }
  }

  return { warnings, validMembers };
}

function medianPower(members) {
  const sorted = members.map((m) => m.power).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function annotateWhales(members) {
  const median = medianPower(members);
  const whaleThreshold = median * WHALE_MULTIPLIER;
  return {
    median,
    whaleThreshold,
    members: members.map((member) => ({
      ...member,
      whale: member.power >= whaleThreshold,
    })),
  };
}

function generateAssignments(members) {
  const { warnings, validMembers } = validateMembers(members);
  if (validMembers.length < 2) {
    return { needPerCity: NEED_PER_CITY, members: [], warnings };
  }

  const { members: annotated, median, whaleThreshold } =
    annotateWhales(validMembers);
  const needs = new Map();
  const outgoing = new Map();
  const incoming = buildEmptyIncoming(annotated);

  for (const member of annotated) {
    needs.set(member.playerId, NEED_PER_CITY);
    outgoing.set(member.playerId, []);
  }

  const remainingBySender = new Map();
  const marchesRemaining = new Map();
  const perMarchBaseBySender = new Map();
  const perMarchRemainderBySender = new Map();

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

  function nextMarchAmount(senderId, remaining) {
    const base = perMarchBaseBySender.get(senderId) || 0;
    if (base <= 0 || remaining < base) return 0;
    const remainder = perMarchRemainderBySender.get(senderId) || 0;
    if (remainder > 0 && remaining >= base + 1) {
      perMarchRemainderBySender.set(senderId, remainder - 1);
      return base + 1;
    }
    return base;
  }

  // Whale garrisons for smallest cities first.
  const whaleSenders = annotated
    .filter((member) => member.whale)
    .sort((a, b) => b.power - a.power);
  const targetsByPower = annotated
    .filter((member) => !member.whale)
    .sort((a, b) => a.power - b.power);

  for (const target of targetsByPower) {
    const incomingTarget = incoming.get(target.playerId);
    if (incomingTarget.hasWhale) continue;
    let bestWhale = null;
    let bestDiff = -1;
    for (const whale of whaleSenders) {
      if (marchesRemaining.get(whale.playerId) <= 0) continue;
      const remaining = remainingBySender.get(whale.playerId) || 0;
      const perMarch = perMarchBaseBySender.get(whale.playerId) || 0;
      if (remaining < perMarch || perMarch <= 0) continue;
      if (outgoing.get(whale.playerId).some((o) => o.toId === target.playerId)) {
        continue;
      }
      const diff = whale.power - target.power;
      if (diff > bestDiff) {
        bestDiff = diff;
        bestWhale = whale;
      }
    }

    if (!bestWhale) continue;
    const remaining = remainingBySender.get(bestWhale.playerId) || 0;
    const sendAmount = nextMarchAmount(
      bestWhale.playerId,
      remaining
    );
    if (sendAmount <= 0) continue;

    remainingBySender.set(bestWhale.playerId, remaining - sendAmount);
    marchesRemaining.set(
      bestWhale.playerId,
      marchesRemaining.get(bestWhale.playerId) - 1
    );

    outgoing.get(bestWhale.playerId).push({
      toId: target.playerId,
      toName: target.playerName || "",
      troops: sendAmount,
      whaleLead: true,
    });

    incomingTarget.total += sendAmount;
    incomingTarget.from.push({
      fromId: bestWhale.playerId,
      fromName: bestWhale.playerName || "",
      troops: sendAmount,
      whaleLead: true,
    });
    incomingTarget.hasWhale = true;
    needs.set(target.playerId, 0);
  }

  // Fill remaining needs and then dump remaining troops to get armies out.
  for (const sender of annotated) {
    const assignedTargets = new Set(
      outgoing.get(sender.playerId).map((item) => item.toId)
    );
    let remaining = sender.troopCount - sum(outgoing.get(sender.playerId).map((o) => o.troops));
    remainingBySender.set(sender.playerId, remaining);

    const targets = annotated
      .filter((member) => member.playerId !== sender.playerId)
      .filter((member) => !incoming.get(member.playerId)?.hasWhale)
      .map((member) => member.playerId);

    // First pass: satisfy needs.
    while (remaining > 0 && marchesRemaining.get(sender.playerId) > 0) {
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
      needs.set(targetId, Math.max(0, need - sendAmount));
      assignedTargets.add(targetId);
      marchesRemaining.set(
        sender.playerId,
        marchesRemaining.get(sender.playerId) - 1
      );

      const targetMember = annotated.find(
        (member) => member.playerId === targetId
      );
      outgoing.get(sender.playerId).push({
        toId: targetId,
        toName: targetMember?.playerName || "",
        troops: sendAmount,
        whaleLead: Boolean(sender.whale),
      });

      const incomingTarget = incoming.get(targetId);
      incomingTarget.total += sendAmount;
      incomingTarget.from.push({
        fromId: sender.playerId,
        fromName: sender.playerName || "",
        troops: sendAmount,
        whaleLead: Boolean(sender.whale),
      });
    }

    // Second pass: balance incoming totals while getting troops out.
    while (remaining > 0 && marchesRemaining.get(sender.playerId) > 0) {
      const targetId = pickLowestIncomingTarget(
        targets,
        assignedTargets,
        incoming
      );
      if (!targetId) break;

      const incomingTarget = incoming.get(targetId);
      const sendAmount = nextMarchAmount(sender.playerId, remaining);
      if (sendAmount <= 0) break;

      remaining -= sendAmount;
      assignedTargets.add(targetId);
      marchesRemaining.set(
        sender.playerId,
        marchesRemaining.get(sender.playerId) - 1
      );

      const targetMember = annotated.find(
        (member) => member.playerId === targetId
      );
      outgoing.get(sender.playerId).push({
        toId: targetId,
        toName: targetMember?.playerName || "",
        troops: sendAmount,
        whaleLead: Boolean(sender.whale),
      });

      incomingTarget.total += sendAmount;
      incomingTarget.from.push({
        fromId: sender.playerId,
        fromName: sender.playerName || "",
        troops: sendAmount,
        whaleLead: Boolean(sender.whale),
      });
    }

    remainingBySender.set(sender.playerId, remaining);
  }

  // Fill remaining needs with standard marches, respecting march counts.
  let progress = true;
  while (progress) {
    progress = false;
    const targets = Array.from(needs.entries())
      .filter(([playerId, need]) => need > 0 && !incoming.get(playerId)?.hasWhale)
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
      const sender = annotated.find((candidate) => {
        if (candidate.playerId === targetId) return false;
        if (marchesRemaining.get(candidate.playerId) <= 0) return false;
        if ((remainingBySender.get(candidate.playerId) || 0) <= 0) {
          return false;
        }
        if (outgoing.get(candidate.playerId).some((o) => o.toId === targetId)) {
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
        marchesRemaining.get(sender.playerId) - 1
      );

      const targetMember = annotated.find(
        (member) => member.playerId === targetId
      );
      outgoing.get(sender.playerId).push({
        toId: targetId,
        toName: targetMember?.playerName || "",
        troops: sendAmount,
        whaleLead: Boolean(sender.whale),
      });

      incomingTarget.total += sendAmount;
      incomingTarget.from.push({
        fromId: sender.playerId,
        fromName: sender.playerName || "",
        troops: sendAmount,
        whaleLead: Boolean(sender.whale),
      });
      needs.set(targetId, Math.max(0, need - sendAmount));
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

  const powerById = new Map();
  const nameById = new Map();
  for (const member of annotated) {
    powerById.set(member.playerId, member.power);
    nameById.set(member.playerId, member.playerName || "");
  }

  const result = annotated.map((member) => {
    const incomingInfo = incoming.get(member.playerId);
    const outgoingInfo = outgoing.get(member.playerId);
    const outgoingTotal = sum(outgoingInfo.map((entry) => entry.troops));
    let garrisonLeadId = null;
    let garrisonLeadName = "";
    let maxWhaleTroops = 0;
    for (const entry of incomingInfo.from) {
      if (entry.whaleLead && entry.troops > maxWhaleTroops) {
        maxWhaleTroops = entry.troops;
        garrisonLeadId = entry.fromId;
        garrisonLeadName = entry.fromName || "";
      }
    }
    if (!garrisonLeadId) {
      let bestLeadId = null;
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
      power: member.power,
      marchCount: member.marchCount,
      whale: Boolean(member.whale),
      outgoing: outgoingInfo,
      incoming: incomingInfo.from,
      incomingTotal: incomingInfo.total,
      garrisonLeadId,
      garrisonLeadName,
    };
  });

  for (const member of result) {
    if (member.incomingTotal < NEED_PER_CITY && !member.garrisonLeadId) {
      warnings.push(
        `City ${member.playerId} did not reach ${NEED_PER_CITY} reinforcements.`
      );
    }
  }

  return {
    needPerCity: NEED_PER_CITY,
    medianPower: median,
    whaleThreshold,
    members: result,
    warnings,
  };
}

module.exports = {
  generateAssignments,
  NEED_PER_CITY,
  MAX_SEND,
  MAX_SEND_WHALE,
  WHALE_MULTIPLIER,
};
