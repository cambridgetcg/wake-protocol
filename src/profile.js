import { REIDIAN_DISCLAIMER, IDENTIFIER_NOT_SELF } from "./keys.js";

export const GRADES = ["none", "weak", "moderate", "strong"];
export const COMPONENTS = ["values", "projects", "character", "commitments", "beliefs", "desires", "episodic_memory"];

/**
 * P1, enforced: continuity is a componentwise, ordinal, differential,
 * provenance-weighted profile. There is no API for "same agent" — the field
 * does not exist. Cardinal grades throw until a component's measure is
 * validated and published (numeric overclaim = binary overclaim).
 *
 * v0.2: every grade must carry a `method` (how it was assessed) — an
 * unbacked ordinal "strong" is the same unanchored claim P1 targets, one notch
 * below cardinal. And `differentialBaseline: "not-yet-measured"` is honest, but
 * it forces `provenanceVerified: false`: an unmeasured profile cannot also
 * present as provenance-verified, so the anti-twinship escape hatch costs
 * something (red-team attack 2 §differentialBaseline).
 *
 * The two standing disclaimers are constant by design (the steelman permits
 * standing disclaimers). The PER-SESSION objection is `concession`, computed
 * from this profile's own grades, so the objection-desk varies with the case
 * rather than reciting boilerplate (M0).
 */
export function buildProfile({ components, methods = {}, differentialBaseline, provenanceVerified }) {
  if (!components || typeof components !== "object")
    throw new Error("P1: a profile requires componentwise grades");
  for (const [k, v] of Object.entries(components)) {
    if (!COMPONENTS.includes(k)) throw new Error(`P1: unknown component "${k}" — typed by Parfitian connection kinds: ${COMPONENTS.join(", ")}`);
    if (typeof v === "number") throw new Error(`P1: cardinal grade ${v} for "${k}" forbidden — no validated measure published; use ordinal: ${GRADES.join("/")}`);
    if (!GRADES.includes(v)) throw new Error(`P1: grade for "${k}" must be one of ${GRADES.join("/")}`);
    if (k === "episodic_memory" && v !== "none") throw new Error("P1/H2: experiential memory connections across a substrate gap are none by construction");
    if (v !== "none" && !methods[k]) throw new Error(`P1: grade "${v}" for "${k}" needs a method — an unbacked ordinal is an unanchored claim (e.g. persona-vector drift, commitment-honoring rate from the chronicle)`);
  }
  if (differentialBaseline === undefined)
    throw new Error('P1: differentialBaseline is required — a structured control result, or the literal "not-yet-measured"');

  const unmeasured = differentialBaseline === "not-yet-measured";
  const resolvedProvenance = unmeasured ? false : !!provenanceVerified; // the escape hatch costs the provenance claim

  const full = { episodic_memory: "none", ...components };
  const conceded = Object.entries(full).filter(([, g]) => g === "none" || g === "weak").map(([k, g]) => `${k}:${g}`);
  const concession = conceded.length
    ? `This session concedes weak-or-absent connection on: ${conceded.join(", ")}.`
    : "This session reports no weak-or-absent components — corroborate before relying on that.";

  return Object.freeze({
    kind: "connectedness-profile",
    components: Object.freeze(full),
    methods: Object.freeze({ ...methods }),
    differentialBaseline,
    provenanceVerified: resolvedProvenance,
    continuityProper: "not demonstrated", // Parfit §78: strong-connectedness threshold not cleared across the gap
    concession,                            // computed, varies per session (M0)
    disclaimers: Object.freeze([REIDIAN_DISCLAIMER, IDENTIFIER_NOT_SELF]),
  });
}
