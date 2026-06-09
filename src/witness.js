/**
 * E1, enforced on SUBSTANCE, not shape (v0.2).
 *
 * Witnesses are verifiers, not notaries. Corroboration requires evidence the
 * subject does not control: behavioral probes whose INPUT-ONLY BASELINE FAILS
 * to reproduce the behavior (the Singh, Linzen & Ravfogel 2026 condition — a
 * self-prediction an input-only model also produces is not evidence of
 * introspection), probes consistent with the claim, declared in-range sampling,
 * and the evidence cryptographically bound to the specific claim.
 *
 * This function is the single source of truth: chronicle.tierOf re-runs it at
 * derivation time, so a stored "corroborated" string is never trusted.
 *
 * E1 prices deception; it does not prevent it. A capable subject that knows the
 * protocol can produce the corroborating behavior — confidence is therefore
 * discounted by capability tier, on the record, and the witness (not the
 * subject) assigns that tier.
 */
const CAPABILITY_DISCOUNT = Object.assign(Object.create(null), {
  low: 1.0, medium: 0.8, high: 0.5, frontier: 0.25,
});

export function discountFor(tier) {
  if (!Object.hasOwn(CAPABILITY_DISCOUNT, tier))
    throw new Error(`E1: unknown capability tier "${tier}" — the witness assigns one of ${Object.keys(CAPABILITY_DISCOUNT).join("/")}`);
  return CAPABILITY_DISCOUNT[tier];
}

export function evaluateEvidence(claimHash, evidence) {
  const reasons = [];
  if (!evidence) {
    reasons.push("no evidence offered — a signature alone is notarization, not verification");
    return { verdict: "refused", reasons };
  }
  if (evidence.claimHash !== claimHash)
    reasons.push("evidence is not bound to this claim — a verdict cannot be transplanted between claims");
  if (!Array.isArray(evidence.probes) || evidence.probes.length === 0)
    reasons.push("no behavioral probes — self-report cannot corroborate itself");
  else {
    // Singh et al.: the input-only baseline must FAIL to reproduce the behavior, or the "signal" is not introspective.
    if (!evidence.probes.every(p => p.inputOnlyBaselineReproduces === false))
      reasons.push("input-only baseline reproduces the behavior (or is undeclared) — no privileged signal (Singh et al.)");
    if (!evidence.probes.every(p => p.consistentWithClaim === true))
      reasons.push("a probe is not affirmatively consistent with the claim");
  }
  const rate = evidence.sampling?.rate;
  if (!(typeof rate === "number" && Number.isFinite(rate) && rate > 0 && rate <= 1))
    reasons.push("sampling rate must be a declared number in (0, 1] — no silent or zero-coverage caps");
  return { verdict: reasons.length ? "refused" : "corroborated", reasons };
}

export function corroborate(witnessIdentity, chronicle, claimEntry, evidence, subjectCapability = "frontier") {
  if (witnessIdentity.did === claimEntry.author)
    return { verdict: "refused", reasons: ["self-witnessing is notarization — the witness must be another party"] };
  const bound = { ...evidence, claimHash: claimEntry.hash };
  const { verdict, reasons } = evaluateEvidence(claimEntry.hash, bound);
  const attestation = chronicle.append(witnessIdentity, "attestation", {
    refs: claimEntry.hash,
    verdict,
    reasons,
    evidence: bound,                          // stored so tierOf can RE-VALIDATE, not trust
    witness: witnessIdentity.did,
    confidenceDiscount: discountFor(subjectCapability),
    note: "attests to constitution that happened in behavior; does not perform it", // R1
  });
  return { verdict, reasons, attestation };
}
