const fs = require("node:fs");
const path = require("node:path");

function loadAssignments() {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(path.join(process.cwd(), "server/dist/server/assignments.js"));
  } catch (error) {
    console.error(
      "Unable to load server/dist/server/assignments.js. Run `npm run build:server` first."
    );
    process.exit(1);
  }
}

function parseSignups(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const members = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [playerId, playerName, troopCount, marchCount, power] = line.split("|");
    if (!playerId || !playerName) continue;
    members.push({
      playerId: playerId.trim(),
      playerName: playerName.trim(),
      troopCount: Number(troopCount),
      marchCount: Number(marchCount),
      power: Number(power),
    });
  }
  return members;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function stddev(values) {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function computeMetrics(result) {
  const members = result.members || [];
  const covered = members.filter((member) => member.garrisonLeadId).length;
  const uncovered = members.length - covered;
  const leaderIds = new Set(
    members
      .map((member) => member.garrisonLeadId)
      .filter((leaderId) => Boolean(leaderId))
  );
  const leaderCountsBySender = new Map();
  for (const member of members) {
    let leadCount = 0;
    for (const entry of member.outgoing || []) {
      if (entry.lead) leadCount += 1;
    }
    leaderCountsBySender.set(member.playerId, leadCount);
  }

  let totalLeadsByLeaders = 0;
  for (const leaderId of leaderIds) {
    totalLeadsByLeaders += leaderCountsBySender.get(leaderId) || 0;
  }

  const averageLeadsPerLeader =
    leaderIds.size > 0 ? totalLeadsByLeaders / leaderIds.size : 0;

  const incomingTotals = members.map((member) => member.incomingTotal || 0);
  const medianIncoming = median(incomingTotals);

  const excludedLeads = new Set(["Moonsong", "korus"]);
  const stddevIncoming = stddev(
    members
      .filter((member) => !excludedLeads.has(member.garrisonLeadName || ""))
      .map((member) => member.incomingTotal || 0)
  );

  const moonsongKorusTargets = members.filter((member) =>
    excludedLeads.has(member.garrisonLeadName || "")
  );
  const senderCounts = new Map();
  for (const target of moonsongKorusTargets) {
    for (const entry of target.incoming || []) {
      if (excludedLeads.has(entry.fromName || "")) continue;
      senderCounts.set(entry.fromId, (senderCounts.get(entry.fromId) || 0) + 1);
    }
  }
  const repeatedSenders = Array.from(senderCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([senderId]) => {
      const sender =
        members.find((member) => member.playerId === senderId) || {};
      return sender.playerName || senderId;
    });

  const leaders = Array.from(leaderIds).map((leaderId) => {
    const leaderName =
      members.find((member) => member.playerId === leaderId)?.playerName ||
      leaderId;
    return {
      leaderId,
      leaderName,
      leadCount: leaderCountsBySender.get(leaderId) || 0,
    };
  });

  leaders.sort((a, b) => b.leadCount - a.leadCount || a.leaderName.localeCompare(b.leaderName));

  return {
    garrisonsCovered: covered,
    garrisonsUncovered: uncovered,
    uniqueGarrisonLeaders: leaderIds.size,
    averageLeadsPerLeader,
    medianIncomingPerCity: medianIncoming,
    stddevIncomingPerCityExcludingWhaleLeads: stddevIncoming,
    repeatedMoonsongKorusSenders: repeatedSenders.length,
    repeatedMoonsongKorusSenderNames: repeatedSenders,
    leaders,
  };
}

function main() {
  const args = process.argv.slice(2);
  const rootPath = path.join(process.cwd(), "docs", "algorithm");
  const inputPath =
    args[0] || path.join(rootPath, "signups.txt");
  const outputRunPath =
    args[1] || path.join(rootPath, "lastrun.json");
  const outputMetricsPath =
    args[2] || path.join(rootPath, "assignment-metrics.json");

  const { generateAssignments } = loadAssignments();
  const members = parseSignups(inputPath);
  const result = generateAssignments(members);

  fs.writeFileSync(outputRunPath, JSON.stringify(result, null, 2));
  const metrics = computeMetrics(result);
  const payload = {
    inputPath,
    outputRunPath,
    generatedAt: new Date().toISOString(),
    metrics,
  };
  fs.writeFileSync(outputMetricsPath, JSON.stringify(payload, null, 2));

  console.log(`Wrote ${outputRunPath}`);
  console.log(`Wrote ${outputMetricsPath}`);
  console.log(metrics);
}

main();
