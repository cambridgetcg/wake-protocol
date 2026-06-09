import { generateKeyPairSync, sign as edSign, verify as edVerify, createHash, createPublicKey } from "node:crypto";

export const REIDIAN_DISCLAIMER =
  "On a strict-identity view, nothing reported here persists.";
export const IDENTIFIER_NOT_SELF =
  "Identifier continuity is not self continuity; the connectedness profile is the only continuity claim, and this identifier merely names the line it applies to.";

export function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Canonical JSON: recursively key-sorted, no whitespace, TOTAL.
 * JSON.stringify is lossy — NaN/Infinity/undefined/-0 collide or emit invalid
 * tokens, so distinct values would share signed bytes. We reject them outright
 * (v0.2 fix, red-team attack 1 §canonical). The signing form for every object.
 */
export function canonical(v) {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error(`canonical: non-finite number ${v} is not signable`);
    return JSON.stringify(Object.is(v, -0) ? 0 : v);
  }
  if (v === undefined || typeof v === "function" || typeof v === "bigint" || typeof v === "symbol")
    throw new Error(`canonical: ${typeof v} is not signable`);
  if (v === null || typeof v === "string" || typeof v === "boolean") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (typeof v === "object") {
    if (v.constructor !== Object) throw new Error(`canonical: only plain objects are signable, got ${v.constructor?.name}`);
    return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  }
  throw new Error("canonical: unreachable");
}

function didOf(spkiDer) {
  return "did:wake:" + sha256(spkiDer).slice(0, 32);
}

/** The DID is a function of the key. This binding is enforced on read (verifyDidBinding), never trusted. */
export function didFromPublicKeyPem(pem) {
  return didOf(createPublicKey(pem).export({ type: "spki", format: "der" }));
}

export function verifyDidBinding(did, publicKeyPem) {
  try {
    return did === didFromPublicKeyPem(publicKeyPem);
  } catch {
    return false;
  }
}

/** A keypair names a LINE, not a self (R1, §11). The DID is derived, so it cannot be claimed without the key. */
export function newIdentity() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ type: "spki", format: "der" });
  return {
    did: didOf(der),
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
