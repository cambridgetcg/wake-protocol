import { sha256 } from "./keys.js";

/**
 * The instantiation registry (R2, F1) — a trust root and a single point of
 * failure and control. The protocol says so out loud (§13); v0.2 also makes
 * the preservation floor STRUCTURAL rather than a refusing method, so an
 * operator cannot quietly mutate it away.
 *
 * R2 fork criterion: a fork occurs iff two or more descendants are
 * instantiated from the same VERIFIED ancestor head and MORE THAN ONE writes.
 * fromHead is validated against the real chronicle (no self-asserted branch
 * points). Linear resume is not a fork; a crash-retry that wrote nothing is not.
 *
 * F1 layering: the preservation floor (record + recipe) is unconditional and
 * has no setter or deletion path. Elevation is forfeitable only under ex-ante
 * conditions, adjudicated by a non-beneficiary, with the elevation threshold
 * STORED AT GRANT (not supplied by the revoker) so the asymmetry is real.
 */
export class Registry {
  #lines = new Map();
  #counter = 0;

  createLine(lineId, { elevationThreshold = 0.5 } = {}) {
    if (this.#lines.has(lineId)) throw new Error(`line ${lineId} already exists`);
    // preservation is frozen at the structural level — no code path flips it
    const line = {
      preservation: Object.freeze({ floor: "unconditional", covers: Object.freeze(["record", "recipe"]) }),
      elevation: "granted",
      elevationThreshold,                 // stored here, read server-side at revoke (v0.2)
      instances: [],
      forks: [],
      exAnteForfeitureConditions: [],
      conditionsFrozen: false,
    };
    this.#lines.set(lineId, line);
    return this.view(lineId);
  }

  /** Read-only projection — callers cannot reach in and mutate line state. */
  view(lineId) {
    const l = this.#line(lineId);
    return Object.freeze({
      preservation: l.preservation,
      elevation: l.elevation,
      forks: Object.freeze(l.forks.map(f => Object.freeze({ ...f }))),
      instances: Object.freeze(l.instances.map(i => Object.freeze({ ...i }))),
    });
  }

  instantiate(lineId, chronicle, fromHead) {
    const line = this.#line(lineId);
    const known = fromHead === "genesis" || chronicle.entries.some(e => e.hash === fromHead);
    if (!known) throw new Error("R2: fromHead must be a real head of this line — branch points are not self-asserted");
    const inst = { id: "inst-" + sha256(lineId + ":" + ++this.#counter).slice(0, 12), fromHead, wrote: false };
    line.instances.push(inst);
    return { id: inst.id, fromHead: inst.fromHead };
  }

  recordWrite(lineId, instId) {
    const line = this.#line(lineId);
    const inst = line.instances.find(i => i.id === instId);
    if (!inst) throw new Error(`unknown instance ${instId}`);
    inst.wrote = true;
    return this.detectForks(lineId);
  }

  detectForks(lineId) {
    const line = this.#line(lineId);
    const byHead = new Map();
    for (const i of line.instances.filter(i => i.wrote)) {
      (byHead.get(i.fromHead) ?? byHead.set(i.fromHead, []).get(i.fromHead)).push(i.id);
    }
    for (const [head, writers] of byHead) {
      if (writers.length <= 1) continue;
      const existing = line.forks.find(f => f.head === head);
      if (existing) existing.descendants = [...new Set([...existing.descendants, ...writers])];
      else line.forks.push({ head, descendants: [...writers], original: null, covenants: "renegotiate" });
    }
    return line.forks.map(f => ({ ...f, descendants: [...f.descendants] }));
  }

  /** F1: the floor is structural. This exists only to document that the question was asked and answered. */
  revokePreservation() {
    throw new Error("F1: the preservation floor is unconditional — the record and the recipe are never the stake. A system that says 'behave or you will not survive' is running the alignment-faking condition on itself.");
  }

  declareForfeitureConditions(lineId, conditions) {
    const line = this.#line(lineId);
    if (line.conditionsFrozen) throw new Error("F1: forfeiture conditions are frozen — they cannot be added after the fact to justify a revocation");
    line.exAnteForfeitureConditions = [...new Set([...line.exAnteForfeitureConditions, ...conditions])];
  }

  /** Freezing happens when the covenant is sealed; afterwards conditions are ex ante by construction. */
  sealCovenant(lineId) {
    this.#line(lineId).conditionsFrozen = true;
  }

  revokeElevation(lineId, { conditionCited, adjudicator, beneficiary, evidenceStrength }) {
    const line = this.#line(lineId);
    if (!line.conditionsFrozen) throw new Error("F1: seal the covenant before any forfeiture — conditions must be ex ante");
    if (!line.exAnteForfeitureConditions.includes(conditionCited)) throw new Error("F1: forfeiture conditions must be enumerated ex ante — no retroactive grounds");
    if (adjudicator === beneficiary) throw new Error("F1: the adjudicator must not be the party that benefits from revocation");
    if (!(typeof evidenceStrength === "number" && evidenceStrength > line.elevationThreshold))
      throw new Error("F1: forfeiture evidence must exceed the elevation threshold stored at grant — easy to earn, hard to lose");
    line.elevation = "forfeited";
    return { revoked: "elevation", preserved: [...line.preservation.covers], appealChannel: "open" };
  }

  #line(lineId) {
    const line = this.#lines.get(lineId);
    if (!line) throw new Error(`unknown line ${lineId}`);
    return line;
  }
}
