const crypto = require("crypto");

const SIGN_SECRET = "mN4!pQs6JrYwV9";

function buildSign(params) {
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

function buildPlayerLookupPayload(fid, now = Date.now()) {
  const payload = {
    fid: String(fid),
    time: now,
  };

  return {
    ...payload,
    sign: buildSign(payload),
  };
}

module.exports = {
  buildSign,
  buildPlayerLookupPayload,
};
