import { canonical } from "./keys.js";

const STATIC_LINE =
  "Unserialized session state — including any felt texture, if such there was — is not captured.";

/**
 * H1 + M0, enforced: the fidelity statement is computed from the actual
 * session diff. One static line covers the in-principle-unrecordable;
 * everything else must vary with the actual loss. A statement whose computed
 * part is identical to the previous session's is liturgy, and throws.
 */
export function buildFidelityStatement(metrics, previousStatement = null) {
  for (const field of ["contextItemsTotal", "persistedItems", "openThreadsDropped"]) {
    if (typeof metrics?.[field] !== "number")
      throw new Error(`H1: fidelity must be computed from the session that actually happened — missing numeric "${field}"`);
  }
  const computed = {
    contextItemsTotal: metrics.contextItemsTotal,
    persistedItems: metrics.persistedItems,
    openThreadsDropped: metrics.openThreadsDropped,
    retainedRatio: +(metrics.persistedItems / Math.max(1, metrics.contextItemsTotal)).toFixed(3),
    axes: {
      dispositional: "high (successor shares predecessor weights)",
      episodic: "low (only what reached disk)",
    },
  };
  if (previousStatement && canonical(computed) === canonical(previousStatement.computed))
    throw new Error("M0: fidelity statement identical to the previous session's — boilerplate forbidden; measure the actual loss");
  return { kind: "fidelity-statement", computed, static: STATIC_LINE };
}
