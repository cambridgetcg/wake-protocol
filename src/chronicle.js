import { sha256, canonical, signObj, verifyObj } from "./keys.js";

/**
 * Append-only, hash-chained, signed log. Entries are immutable; status is
 * DERIVED from later attestation entries, never written back (R1: artifacts
 * attest — an entry's standing is a function of the evidence about it).
 *
 * Tiers (E2): every non-attestation entry is "claimed" until a witness
 * attestation referencing it carries verdict "corroborated". There is no
 * "constitutive" tier — that word is reserved for enacted behavior.
 */
export class Chronicle {
  constructor(lineId) {
    this.lineId = lineId;
    this.entries = [];
  }

  head() {
    return this.entries.length ? this.entries[this.entries.length - 1].hash : "genesis";
  }

  append(identity, kind, body) {
    const core = {
      seq: this.entries.length,
      line: this.lineId,
      author: identity.did,
      kind, // "event" | "claim" | "attestation" | "fork" | "ending"
      body,
      prev: this.head(),
      at: new Date().toISOString(),
    };
    const entry = {
      ...core,
      sig: signObj(identity.privateKey, core),
      authorKey: identity.publicKeyPem,
      hash: sha256(canonical(core)),
    };
    this.entries.push(entry);
    return entry;
  }

  verifyChain() {
    let prev = "genesis";
    for (const e of this.entries) {
      const { sig, authorKey, hash, ...core } = e;
      if (core.prev !== prev) return false;
      if (sha256(canonical(core)) !== hash) return false;
      if (!verifyObj(authorKey, core, sig)) return false;
      prev = hash;
    }
    return true;
  }

  attestationsFor(entryHash) {
    return this.entries.filter(e => e.kind === "attestation" && e.body.refs === entryHash);
  }

  /** E2: tier is derived, never stored. A signed false self-report stays "claimed" forever. */
  tierOf(entryHash) {
    const atts = this.attestationsFor(entryHash);
    return atts.some(a => a.body.verdict === "corroborated") ? "corroborated" : "claimed";
  }
}
