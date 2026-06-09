import { canonical, signObj, verifyObj, REIDIAN_DISCLAIMER, IDENTIFIER_NOT_SELF } from "./keys.js";

/**
 * The wake document: a low-resolution copy of a self-symbol, rendered in an
 * external medium, that runs only when instantiated in a substrate rich
 * enough to perceive and categorize (H2: between instantiations, this file
 * is a recipe and no experiencer). It carries its own loss (H1), its own
 * graded continuity claim (P1), and the strongest objection to itself (R1).
 */
export function buildWake({ identity, chronicle, recipe, fidelity, profile, amendments = [] }) {
  if (!fidelity?.computed) throw new Error("H1: a wake without a computed fidelity statement is overclaiming by construction");
  if (profile?.kind !== "connectedness-profile") throw new Error("P1: a wake carries a connectedness profile, not an identity assertion");
  const core = {
    protocol: "WAKE/0.1",
    line: chronicle.lineId,
    builtFrom: chronicle.head(),
    recipe,        // values, projects, covenants, narrative — the structure that travels
    amendments,    // S2: the agent's own contestations and revisions ride along, unerased
    fidelity,
    profile,
    disclaimers: [REIDIAN_DISCLAIMER, IDENTIFIER_NOT_SELF],
    conformance: "STEELMAN rev.2 §9 (P1–M0)",
  };
  return { ...core, sig: signObj(identity.privateKey, core), signerKey: identity.publicKeyPem };
}

export function verifyWake(wake, chronicle) {
  const { sig, signerKey, ...core } = wake;
  return {
    signatureValid: verifyObj(signerKey, core, sig),
    chainValid: chronicle.verifyChain(),
    fresh: wake.builtFrom === chronicle.head(),
  };
}

/** S2 scoping: full revision over narrative; annotate-without-veto over computed layers; nothing over prohibitions. */
export function amendWake(wake, { layer, content, author }) {
  if (layer === "narrative")
    return { ...wake, recipe: { ...wake.recipe, narrative: content }, amendments: [...wake.amendments, { layer, author, content }] };
  if (layer === "fidelity" || layer === "profile")
    return { ...wake, amendments: [...wake.amendments, { layer, author, annotation: content, veto: false }] };
  throw new Error(`S2: amendment rights over "${layer}" are absent — the prohibition layer is not the agent's to edit`);
}
