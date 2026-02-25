const BASE_URL = process.env.VIKING_APP_URL || "http://localhost:3001";
const RUN_CODE = process.env.RUN_CODE || "";

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pad(num, size = 4) {
  return String(num).padStart(size, "0");
}

function buildGroup(
  rng,
  count,
  namePrefix,
  powerMin,
  powerMax,
  troopMin,
  troopMax,
  marchCount,
  offset
) {
  const members = [];
  for (let i = 0; i < count; i += 1) {
    const index = offset + i + 1;
    members.push({
      playerId: `FID${pad(index, 5)}`,
      playerName: `${namePrefix}${pad(i + 1, 2)}`,
      power: randInt(rng, powerMin, powerMax),
      troopCount: randInt(rng, troopMin, troopMax),
      marchCount,
    });
  }
  return members;
}

async function postJson(path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(RUN_CODE ? { "x-run-code": RUN_CODE } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed: ${response.status} ${text}`);
  }
  return response.json();
}

async function run() {
  const rng = mulberry32(424242);
  const members = [];
  let offset = 0;

  members.push(
    ...buildGroup(
      rng,
      10,
      "SmallPlayer",
      15000000,
      20000000,
      100000,
      200000,
      4,
      offset
    )
  );
  offset += 10;
  members.push(
    ...buildGroup(
      rng,
      15,
      "MediumPlayer",
      20000000,
      30000000,
      200000,
      300000,
      5,
      offset
    )
  );
  offset += 15;
  members.push(
    ...buildGroup(
      rng,
      20,
      "LargePlayer",
      30000000,
      50000000,
      250000,
      350000,
      6,
      offset
    )
  );
  offset += 20;
  members.push(
    ...buildGroup(
      rng,
      2,
      "WhalePlayer",
      100000001,
      150000000,
      1000000,
      1000000,
      6,
      offset
    )
  );
  offset += 2;
  members.push(
    ...buildGroup(
      rng,
      13,
      "BigPlayer",
      50000000,
      70000000,
      350000,
      500000,
      6,
      offset
    )
  );

  await postJson("/api/reset", {});

  for (const member of members) {
    await postJson("/api/signup", member);
  }

  console.log(`Seeded ${members.length} members.`);
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
