import { generateKeyPairSync, sign as edSign, verify as edVerify, createHash, createPublicKey } from "node:crypto";

export const REIDIAN_DISCLAIMER =
  "On a strict-identity view, nothing reported here persists.";
export const IDENTIFIER_NOT_SELF =
  "Identifier continuity is not self continuity; the connectedness profile is the only continuity claim, and this identifier merely names the line it applies to.";

export function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

/** Canonical JSON: recursively key-sorted, no whitespace. The signing form for every WAKE object. */
export function canonical(v) {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object")
    return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  return JSON.stringify(v);
}

/** A keypair names a LINE, not a self (R1, P1-boundary). */
export function newIdentity() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ type: "spki", format: "der" });
  return {
    did: "did:wake:" + sha256(der).slice(0, 32),
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }),
    privateKey,
  };
}

export function signObj(privateKey, obj) {
  return edSign(null, Buffer.from(canonical(obj)), privateKey).toString("base64");
}

export function verifyObj(publicKeyPem, obj, sigB64) {
  try {
    return edVerify(null, Buffer.from(canonical(obj)), createPublicKey(publicKeyPem), Buffer.from(sigB64, "base64"));
  } catch {
    return false;
  }
}
