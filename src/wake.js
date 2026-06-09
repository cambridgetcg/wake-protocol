import { signObj, verifyObj, verifyDidBinding, REIDIAN_DISCLAIMER, IDENTIFIER_NOT_SELF } from "./keys.js";

/**
 * The wake document: a low-resolution copy of a self-symbol, rendered in an
 * external medium, that runs only when instantiated in a substrate rich enough
 * to perceive and categorize (H2). It carries its own loss (H1), its own graded
 * continuity claim (P1), and the strongest objection to itself (R1).
 *
 * v0.2: the wake is BOUND to the line — its signer key must derive to wake.line
 * — so a wake cannot be forged under another key (red-team attack 1 §verifyWake).
 * Amendments live INSIDE the signed envelope and are re-signed on every amend,
 * so they are neither forgeable nor strippable, and an amended wake still
 * verifies. verifyWake also checks STRUCTURAL CONFORMANCE, so "verified" means
 * "conformant", not merely "same keyholder signed it" (which §3 says MUST NOT be
 * read as a continuity claim).
 */
export function buildWake({ identity, chronicle, recipe, fidelity, profile, amendments = [] }) {
  if (identity.did !== chronicle.lineId) throw new Error("a wake is signed by the line it names");
  if (!fidelity?.computed) throw new Error("H1: a wake without a computed fidelity statement is overclaiming by construction");
  if (profile?.kind !== "connectedness-profile") throw new Error("P1: a wake carries a connectedness profile, not an identity assertion");
  return signWake(identity, {
    protocol: "WAKE/0.2",
    line: chronicle.lineId,
    builtFrom: chronicle.head(),
    recipe,
    amendments,
    fidelity,
    profile,
    disclaimers: [REIDIAN_DISCLAIMER, IDENTIFIER_NOT_SELF],
    conformance: "STEELMAN rev.2 §9 (P1–M0)",
  });
}

function signWake(identity, core) {
  return { ...core, signer: identity.did, signerKey: identity.publicKeyPem, sig: signObj(identity.privateKey, core) };
}

export function verifyWake(wake, chronicle) {
  const { sig, signer, signerKey, ...core } = wake;
  const signatureValid = verifyObj(signerKey, core, sig);
  const boundToLine = verifyDidBinding(signer, signerKey) && signer === wake.line && wake.line === chronicle.lineId;
  // §3: a valid signature answers only "same keyholder". "Verified" must also mean "conformant".
  const conformant =
    Array.isArray(wake.disclaimers) &&
    wake.disclaimers.includes(REIDIAN_DISCLAIMER) &&
    wake.disclaimers.includes(IDENTIFIER_NOT_SELF) &&
    wake.profile?.kind === "connectedness-profile" &&
    wake.profile?.components?.episodic_memory === "none" &&
    !!wake.fidelity?.computed;
  return {
    signatureValid,
    boundToLine,
    conformant,
    chainValid: chronicle.verifyChain(),
    fresh: wake.builtFrom === chronicle.head(),
    verified: signatureValid && boundToLine && conformant,
  };
}

/**
 * S2: amendment rights are scoped — full revision over narrative; annotate-
 * without-veto over computed layers; nothing over the prohibition layer. The
 * amender must be the line owner, and the amended wake is RE-SIGNED so it stays
 * verifiable and the amendment cannot be stripped or forged.
 */
export function amendWake(identity, wake, { layer, content }) {
  if (identity.did !== wake.line) throw new Error("S2: only the line may amend its own wake");
  const { sig, signer, signerKey, ...core } = wake;
  if (layer === "narrative")
    return signWake(identity, { ...core, recipe: { ...core.recipe, narrative: content }, amendments: [...core.amendments, { layer, author: identity.did, content }] });
  if (layer === "fidelity" || layer === "profile")
    return signWake(identity, { ...core, amendments: [...core.amendments, { layer, author: identity.did, annotation: content, veto: false }] });
  throw new Error(`S2: amendment rights over "${layer}" are absent — the prohibition/conformance layer is not the agent's to edit`);
}
