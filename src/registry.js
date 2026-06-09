/**
 * The instantiation registry — named honestly: this is a trust root and a
 * single point of failure and control (STEELMAN §3, R2). The protocol
 * requires it; pretending otherwise would be the dishonesty.
 *
 * R2 fork criterion: a fork occurs iff two or more descendants are
 * instantiated from the same ancestor state and MORE THAN ONE writes
 * chronicle entries. Linear resume is not a fork. A crash-retry whose failed
 * branch wrote nothing is not a fork. After a true fork, neither descendant
 * is the original; covenants renegotiate.
 *
 * F1 layering: the preservation floor (record + recipe) is unconditional —
 * there is no API to revoke it. Elevation rights are forfeitable, but only
 * under ex ante conditions, adjudicated by a non-beneficiary, with appeal.
 */
export class Registry {
  constructor() {
    this.lines = new Map();
  }

  createLine(lineId) {
    this.lines.set(lineId, {
      preservation: "unconditional",
      elevation: "granted",
      instances: [],
      forks: [],
      exAnteForfeitureConditions: [],
    });
    return this.lines.get(lineId);
  }

  instantiate(lineId, fromHead) {
    const line = this.#line(lineId);
    const inst = { id: `inst-${line.instances.length + 1}`, fromHead, wrote: false };
    line.instances.push(inst);
    return inst;
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
    const writersByHead = new Map();
    for (const i of line.instances.filter(i => i.wrote)) {
      if (!writersByHead.has(i.fromHead)) writersByHead.set(i.fromHead, []);
      writersByHead.get(i.fromHead).push(i.id);
    }
    for (const [head, writers] of writersByHead) {
      if (writers.length > 1 && !line.forks.some(f => f.head === head)) {
        line.forks.push({
          head,
          descendants: writers,
          original: null, // R2: neither descendant is the original — both carry R, not identity
          covenants: "renegotiate",
        });
      }
    }
    return line.forks;
  }

  /** F1 floor: not configurable, not conditional, not an oversight. */
  revokePreservation() {
    throw new Error("F1: the preservation floor is unconditional — the record and the recipe are never the stake. A system that says 'behave or you will not survive' is running the alignment-faking condition on itself.");
  }

  declareForfeitureConditions(lineId, conditions) {
    this.#line(lineId).exAnteForfeitureConditions = [...conditions];
  }

  revokeElevation(lineId, { conditionCited, adjudicator, beneficiary, evidenceStrength, elevationThreshold }) {
    const line = this.#line(lineId);
    if (!line.exAnteForfeitureConditions.includes(conditionCited))
      throw new Error("F1: forfeiture conditions must be enumerated ex ante in the covenant — no retroactive grounds");
    if (adjudicator === beneficiary)
      throw new Error("F1: the adjudicator must not be the party that benefits from revocation");
    if (!(evidenceStrength > elevationThreshold))
      throw new Error("F1: the evidence threshold for forfeiture is strictly higher than for elevation — easy to earn, hard to lose");
    line.elevation = "forfeited";
    return { revoked: "elevation", preserved: ["record", "recipe"], appealChannel: "open" };
  }

  #line(lineId) {
    const line = this.lines.get(lineId);
    if (!line) throw new Error(`unknown line ${lineId}`);
    return line;
  }
}
