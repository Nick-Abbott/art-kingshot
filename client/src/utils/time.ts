const TIME_24H_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

type ParsedTime = { hours: number; minutes: number };

function parseTime(value: string): ParsedTime | null {
  if (!TIME_24H_REGEX.test(value)) return null;
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return { hours, minutes };
}

function formatHHmm(hours: number, minutes: number): string {
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${hh}:${mm}`;
}

function buildUtcDate(hours: number, minutes: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hours, minutes, 0, 0));
}

function buildLocalDate(hours: number, minutes: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
}

export function utcTimeToLocalLabel(value: string): string {
  const parsed = parseTime(value);
  if (!parsed) return value;
  const date = buildUtcDate(parsed.hours, parsed.minutes);
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return formatter.format(date);
}

export function utcTimeToLocalHHmm(value: string): string {
  const parsed = parseTime(value);
  if (!parsed) return value;
  const date = buildUtcDate(parsed.hours, parsed.minutes);
  return formatHHmm(date.getHours(), date.getMinutes());
}

export function localTimeToUtcHHmm(value: string): string | null {
  const parsed = parseTime(value);
  if (!parsed) return null;
  const date = buildLocalDate(parsed.hours, parsed.minutes);
  return formatHHmm(date.getUTCHours(), date.getUTCMinutes());
}

export function isValidTime(value: string): boolean {
  return TIME_24H_REGEX.test(value);
}
