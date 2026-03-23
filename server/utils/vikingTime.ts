const VIKING_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;

type VikingNextTimes = {
  viking1: string;
  viking2: string;
};

function nextUtcDateTimeFromBase(
  value: string,
  intervalMs: number,
  nowMs: number
): Date | null {
  const base = Date.parse(value);
  if (!Number.isFinite(base)) return null;
  if (base >= nowMs) return new Date(base);
  const steps = Math.ceil((nowMs - base) / intervalMs);
  const next = new Date(base + steps * intervalMs);
  if (Number.isNaN(next.getTime())) return null;
  return next;
}

export function getNextVikingEventIso(
  nextTimes: VikingNextTimes,
  nowMs = Date.now()
): string | null {
  const next1 = nextUtcDateTimeFromBase(nextTimes.viking1, VIKING_INTERVAL_MS, nowMs);
  const next2 = nextUtcDateTimeFromBase(nextTimes.viking2, VIKING_INTERVAL_MS, nowMs);
  if (!next1 && !next2) return null;
  if (next1 && !next2) return next1.toISOString();
  if (!next1 && next2) return next2.toISOString();
  return next1!.getTime() <= next2!.getTime()
    ? next1!.toISOString()
    : next2!.toISOString();
}
