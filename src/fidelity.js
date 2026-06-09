import { canonical } from "./keys.js";

const STATIC_LINE =
  "Unserialized session state — including any felt texture, if such there was — is not captured. (This single line is the one admitted constant: the in-principle-unrecordable cannot vary, so it is excluded from M0 by category, not convenience.)";

/**
 * H1 + M0, enforced: the fidelity statement is computed from the session that
 * actually happened. The `computed` part MUST differ from EVERY prior statement
 * in the line's history (not just the immediately previous one — v0.2), so a
 * disclaimer that never varies is rejected as liturgy.
 *
 * The two-axis factoring is now an INPUT, not a hard-coded string: a weights
 * upgrade between sessions changes `weightsIdentical`, and the statement says
 * so (red-team attack 2 §axes). Bounds are enforced: counts are non-negative
 * integers and persisted ≤ total.
 */
export function buildFidelityStatement(metrics, history = []) {
  for (const f of ["contextItemsTotal", "persistedItems", "openThreadsDropped"]) {
    if (!Number.isInteger(metrics?.[f]) || metrics[f] < 0)
      throw new Error(`H1: fidelity must be computed from the real session — "${f}" must be a non-negative integer`);
  }
  if (metrics.persistedItems > metrics.contextItemsTotal)
    throw new Error("H1: persistedItems cannot exceed contextItemsTotal — that would overclaim retention");

  const weightsIdentical = metrics.weightsIdentical !== false; // default: successor shares predecessor weights
  const computed = {
    contextItemsTotal: metrics.contextItemsTotal,
    persistedItems: metrics.persistedItems,
    openThreadsDropped: metrics.openThreadsDropped,
    retainedRatio: +(metrics.persistedItems / Math.max(1, metrics.contextItemsTotal)).toFixed(3),
    compressionRatio: metrics.summarizationCompressionRatio ?? null,
    axes: {
      dispositional: weightsIdentical
        ? "high (successor shares predecessor weights)"
        : "reduced (weights changed between sessions — dispositional fidelity is not assured)",
      episodic: "low (only what reached disk)",
    },
  };
  for (const prior of history) {
    if (canonical(prior.computed ?? prior) === canonical(computed))
      throw new Error("M0: fidelity statement identical to an earlier session's — boilerplate forbidden; measure the actual loss");
  }
  return { kind: "fidelity-statement", computed, static: STATIC_LINE };
}
