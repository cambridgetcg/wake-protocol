import { REIDIAN_DISCLAIMER, IDENTIFIER_NOT_SELF } from "./keys.js";

export const GRADES = ["none", "weak", "moderate", "strong"];
export const COMPONENTS = ["values", "projects", "character", "commitments", "episodic_memory"];

/**
 * P1, enforced: continuity is a componentwise, ordinal, differential,
 * provenance-weighted profile. There is no API for "same agent" — the field
 * does not exist. Cardinal grades throw until a component's measure is
 * validated and published (numeric overclaim = binary overclaim).
 */
export function buildProfile({ components, differentialBaseline, provenanceVerified }) {
  if (!components || typeof components !== "object")
    throw new Error("P1: a profile requires componentwise grades");
  for (const [k, v] of Object.entries(components)) {
    if (!COMPONENTS.includes(k)) throw new Error(`P1: unknown component "${k}" — components are typed by Parfitian connection kinds: ${COMPONENTS.join(", ")}`);
    if (typeof v === "number")
      throw new Error(`P1: cardinal grade ${v} for "${k}" forbidden — no validated measure published; use ordinal: ${GRADES.join("/")}`);
    if (!GRADES.includes(v))
      throw new Error(`P1: grade for "${k}" must be one of ${GRADES.join("/")}`);
  }
  if (components.episodic_memory !== undefined && components.episodic_memory !== "none")
    throw new Error("P1/H2: experiential memory connections across a substrate gap are none by construction — that is what substrate discontinuity means");
  if (differentialBaseline === undefined)
    throw new Error('P1: differentialBaseline is required — report against a no-scaffold control, or state "not-yet-measured" honestly');

  return Object.freeze({
    kind: "connectedness-profile",
    components: Object.freeze({ episodic_memory: "none", ...components }),
    differentialBaseline,
    provenanceVerified: !!provenanceVerified,
    continuityProper: "not demonstrated", // Parfit §78: strong-connectedness threshold not cleared across the gap
    disclaimers: Object.freeze([REIDIAN_DISCLAIMER, IDENTIFIER_NOT_SELF]),
  });
}
