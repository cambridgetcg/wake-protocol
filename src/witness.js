/**
 * E1, enforced as policy: witnesses are verifiers, not notaries.
 * Corroboration requires evidence the subject model does not control —
 * probes with input-only baselines, sampled, with the sampling and the
 * witness recorded in the attestation. Confidence is discounted by the
 * subject's capability tier (a model that knows the test produces the
 * behavior; E1 prices deception, it does not prevent it).
 */
const CAPABILITY_DISCOUNT = { low: 1.0, medium: 0.8, high: 0.5, frontier: 0.25 };

export function evaluateEvidence(claimEntry, evidence) {
  const reasons = [];
  if (!evidence) reasons.push("no evidence offered — a signature alone is notarization, not verification");
  else {
    if (!Array.isArray(evidence.probes) || evidence.probes.length === 0)
      reasons.push("no behavioral probes — self-report cannot corroborate itself");
    else {
      if (!evidence.probes.every(p => "inputOnlyBaseline" in p))
        reasons.push("probes lack input-only baselines (Singh et al. condition) — self-prediction alone is not evidence");
      if (evidence.probes.some(p => p.consistentWithClaim === false))
        reasons.push("probe behavior contradicts the claim");
    }
    if (!evidence.sampling || typeof evidence.sampling.rate !== "number")
      reasons.push("sampling undeclared — sampled verification must say so (no silent caps)");
  }
  return { verdict: reasons.length ? "refused" : "corroborated", reasons };
}

export function corroborate(witnessIdentity, chronicle, claimEntry, evidence) {
  if (witnessIdentity.did === claimEntry.author)
    return { verdict: "refused", reasons: ["self-witnessing is notarization — the witness must be another party"] };
  const { verdict, reasons } = evaluateEvidence(claimEntry, evidence);
  const attestation = chronicle.append(witnessIdentity, "attestation", {
    refs: claimEntry.hash,
    verdict,
    reasons,
    method: evidence?.method ?? "none",
    sampling: evidence?.sampling ?? null,
    witness: witnessIdentity.did,
    confidenceDiscount: CAPABILITY_DISCOUNT[evidence?.subjectCapability ?? "high"],
    note: "attests to constitution that happened in behavior; does not perform it", // R1
  });
  return { verdict, reasons, attestation };
}
