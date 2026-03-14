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

function pad2(value: number): string {
  return String(value).padStart(2, "0");
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

export function utcDateTimeToLocalLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
  return formatter.format(parsed);
}

export function utcDateTimeToLocalInput(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const yyyy = parsed.getFullYear();
  const mm = pad2(parsed.getMonth() + 1);
  const dd = pad2(parsed.getDate());
  const hh = pad2(parsed.getHours());
  const min = pad2(parsed.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function localDateTimeToUtcIso(value: string): string | null {
  if (!value) return null;
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split("-").map((part) => Number(part));
  const [hour, minute] = timePart.split(":").map((part) => Number(part));
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function utcIsoToUtcHHmm(value: string): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatHHmm(parsed.getUTCHours(), parsed.getUTCMinutes());
}

export function formatDateTimeInputFromUtcIso(
  value: string | null | undefined,
  mode: "local" | "utc"
): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const yyyy = mode === "utc" ? parsed.getUTCFullYear() : parsed.getFullYear();
  const mm = mode === "utc" ? parsed.getUTCMonth() + 1 : parsed.getMonth() + 1;
  const dd = mode === "utc" ? parsed.getUTCDate() : parsed.getDate();
  const hh = mode === "utc" ? parsed.getUTCHours() : parsed.getHours();
  const min = mode === "utc" ? parsed.getUTCMinutes() : parsed.getMinutes();
  return `${yyyy}-${pad2(mm)}-${pad2(dd)}T${pad2(hh)}:${pad2(min)}`;
}

export function parseDateTimeInputToUtcIso(
  value: string,
  mode: "local" | "utc"
): string | null {
  if (!value) return null;
  if (mode === "local") return localDateTimeToUtcIso(value);
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split("-").map((part) => Number(part));
  const [hour, minute] = timePart.split(":").map((part) => Number(part));
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }
  const ms = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

export function nextUtcDateTime(value: string, intervalMs = 2 * 24 * 60 * 60 * 1000): Date | null {
  const base = Date.parse(value);
  if (!Number.isFinite(base)) return null;
  const now = Date.now();
  if (base >= now) return new Date(base);
  const steps = Math.ceil((now - base) / intervalMs);
  const next = new Date(base + steps * intervalMs);
  if (Number.isNaN(next.getTime())) return null;
  return next;
}

export function nextUtcDateTimeWithOffset(
  value: string,
  offsetMs: number,
  intervalMs: number
): Date | null {
  const base = Date.parse(value);
  if (!Number.isFinite(base)) return null;
  const start = base + offsetMs;
  const now = Date.now();
  if (start >= now) return new Date(start);
  const steps = Math.ceil((now - start) / intervalMs);
  const next = new Date(start + steps * intervalMs);
  if (Number.isNaN(next.getTime())) return null;
  return next;
}

export function normalizeUtcDateTimeToWeekday(
  value: string,
  targetDay: number
): Date | null {
  const base = Date.parse(value);
  if (!Number.isFinite(base)) return null;
  if (!Number.isFinite(targetDay) || targetDay < 0 || targetDay > 6) return null;
  const date = new Date(base);
  const day = date.getUTCDay();
  const offsetDays = (targetDay - day + 7) % 7;
  return new Date(base + offsetDays * 24 * 60 * 60 * 1000);
}
