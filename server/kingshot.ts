import * as crypto from "node:crypto";

const SIGN_SECRET = "mN4!pQs6JrYwV9";

export function buildSign(params: Record<string, unknown>): string {
  const sortedKeys = Object.keys(params).sort();
  const base = sortedKeys
    .map((key) => {
      const value = params[key];
      const encoded =
        value !== null && typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
      return `${key}=${encoded}`;
    })
    .join("&");

  return crypto.createHash("md5").update(base + SIGN_SECRET).digest("hex");
}

export function buildPlayerLookupPayload(
  fid: string | number,
  now = Date.now()
): { fid: string; time: number; sign: string } {
  const payload = {
    fid: String(fid),
    time: now,
  };

  return {
    ...payload,
    sign: buildSign(payload),
  };
}
