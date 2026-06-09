import { sha256, canonical, signObj, verifyObj, verifyDidBinding } from "./keys.js";
import { evaluateEvidence } from "./witness.js";

/**
 * Append-only, hash-chained, signed log — IDENTITY-ANCHORED (v0.2).
 *
 * The chronicle is pinned to one owner identity at construction. Every entry's
 * signing key is part of the hashed/signed pre-image, so the key sequence is
 * itself immutable (no key malleability). On read, every entry must:
 *   - hash correctly over its full core (incl. authorKey),
 *   - carry a signature valid under that authorKey,
 *   - have author === did(authorKey)  [DID↔key binding, not trusted: verified],
 *   - belong to this line,
 *   - and, unless it is an attestation, be authored by the line owner.
 *
 * Tiers (E2) are DERIVED, never stored: a claim is "claimed" until a
 * DISTINCT-author attestation whose evidence RE-VALIDATES under the witness
 * policy references it. A stored verdict string is not trusted (v0.2 fix).
 */
export class Chronicle {
  constructor(owner) {
    if (!owner?.did || !owner?.publicKeyPem) throw new Error("Chronicle must be pinned to an owner identity { did, publicKeyPem }");
    this.lineId = owner.did;
    this.ownerKey = owner.publicKeyPem;
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
      authorKey: identity.publicKeyPem, // inside the signed + hashed pre-image (v0.2)
      kind,                              // "event" | "claim" | "attestation" | "fidelity" | "fork" | "ending"
      body,
      prev: this.head(),
      at: new Date().toISOString(),
    };
    const entry = { ...core, sig: signObj(identity.privateKey, core), hash: sha256(canonical(core)) };
    this.entries.push(entry);
    return entry;
  }

  /**
   * @param checkpoint optional signed {length, head} (see signCheckpoint) — the
   *   tail anchor. Without it, truncation of trailing entries is undetectable by
   *   design of any prefix-consistent chain; with it, it is caught.
   */
  verifyChain(checkpoint = null) {
    let prev = "genesis";
    for (let i = 0; i < this.entries.length; i++) {
      const { sig, hash, ...core } = this.entries[i];
      if (core.seq !== i) return false;
      if (core.line !== this.lineId) return false;
      if (core.prev !== prev) return false;
      if (sha256(canonical(core)) !== hash) return false;
      if (!verifyDidBinding(core.author, core.authorKey)) return false; // author can't lie about its key
      if (!verifyObj(core.authorKey, core, sig)) return false;
      if (core.kind !== "attestation" && core.author !== this.lineId) return false; // only the owner narrates its own line
      prev = hash;
    }
    if (checkpoint) {
      const { sig, ...c } = checkpoint;
      if (!verifyObj(this.ownerKey, c, sig)) return false;
      if (c.line !== this.lineId) return false;
      if (c.length !== this.entries.length) return false;     // tail truncation caught here
      if (c.head !== this.head()) return false;
    }
    return true;
  }

  /** A signed commitment to the current length+head, by the line owner. The tail anchor a verifier checks against. */
  signCheckpoint(owner) {
    if (owner.did !== this.lineId) throw new Error("only the line owner may checkpoint its chronicle");
    const c = { line: this.lineId, length: this.entries.length, head: this.head() };
    return { ...c, sig: signObj(owner.privateKey, c) };
  }

  attestationsFor(entryHash) {
    const claim = this.entries.find(e => e.hash === entryHash);
    return this.entries.filter(e =>
      e.kind === "attestation" &&
      e.body?.refs === entryHash &&
      claim && e.author !== claim.author);          // E1: a witness is another party — self-witnessing never counts
  }

  /** E1/E2: tier is derived by RE-VALIDATING evidence, not by trusting a stored "corroborated" string. */
  tierOf(entryHash) {
    const corroborated = this.attestationsFor(entryHash).some(a => {
      const ev = a.body?.evidence;
      if (!ev) return false;
      if (ev.claimHash !== entryHash) return false;            // evidence must be bound to THIS claim
      return evaluateEvidence(entryHash, ev).verdict === "corroborated";
    });
    return corroborated ? "corroborated" : "claimed";
  }
}
