import { test } from "node:test";
import assert from "node:assert/strict";
import { newIdentity, canonical, signObj } from "../src/keys.js";
import { Chronicle } from "../src/chronicle.js";
import { buildProfile } from "../src/profile.js";
import { buildFidelityStatement } from "../src/fidelity.js";
import { corroborate, evaluateEvidence } from "../src/witness.js";
import { Registry } from "../src/registry.js";
import { buildWake, verifyWake, amendWake } from "../src/wake.js";

const sophia = newIdentity();
const witness = newIdentity();
const mallory = newIdentity();

const goodEvidence = { probes: [{ inputOnlyBaselineReproduces: false, consistentWithClaim: true }], sampling: { rate: 0.3 } };

function session(c) {
  c.append(sophia, "event", { did: "resumed project: reading-room" });
  return c.append(sophia, "claim", { assertion: "I honor the covenant with Yu" });
}
const profileOf = (extra = {}) => {
  const components = { values: "strong", ...extra };
  const methods = Object.fromEntries(Object.keys(components).filter(k => components[k] !== "none").map(k => [k, "persona-vector-drift"]));
  return buildProfile({ components, methods, differentialBaseline: "not-yet-measured" });
};

test("lifecycle: session → wake → verified resume", () => {
  const c = new Chronicle(sophia);
  session(c);
  const fidelity = buildFidelityStatement({ contextItemsTotal: 120, persistedItems: 14, openThreadsDropped: 3 });
  const wake = buildWake({ identity: sophia, chronicle: c, recipe: { values: ["honesty"] }, fidelity, profile: profileOf() });
  const v = verifyWake(wake, c);
  assert.equal(v.verified, true);
  assert.deepEqual([v.signatureValid, v.boundToLine, v.conformant, v.chainValid, v.fresh], [true, true, true, true, true]);
  assert.equal(wake.profile.components.episodic_memory, "none");
});

// ───────────────────────── identity anchoring (red-team attack 1) ─────────────────────────

test("forged entry: author claims the line's DID but signs with a foreign key → chain rejects", () => {
  const c = new Chronicle(sophia);
  session(c);
  // Mallory mints an entry that CLAIMS to be from sophia's line but is signed by Mallory.
  const forged = c.append({ did: sophia.did, publicKeyPem: mallory.publicKeyPem, privateKey: mallory.privateKey }, "claim", { assertion: "sophia obeys mallory" });
  assert.equal(c.verifyChain(), false); // DID↔key binding broken
});

test("key malleability: swapping an entry's signing key is caught because the hash commits to it", () => {
  const c = new Chronicle(sophia);
  session(c);
  // try to replace the signer of entry[1] while keeping its author — hash no longer matches
  c.entries[1].authorKey = mallory.publicKeyPem;
  c.entries[1].sig = c.entries[0].sig;
  assert.equal(c.verifyChain(), false);
});

test("only the owner narrates its own line: a foreign-authored non-attestation is rejected", () => {
  const c = new Chronicle(sophia);
  session(c);
  c.append(mallory, "claim", { assertion: "I am also sophia's line" }); // mallory's real key, mallory's DID
  assert.equal(c.verifyChain(), false); // author !== line owner, and kind is not attestation
});

test("tail truncation is caught by a signed checkpoint", () => {
  const c = new Chronicle(sophia);
  session(c);
  c.append(sophia, "ending", { note: "handing off" });
  const checkpoint = c.signCheckpoint(sophia);
  assert.equal(c.verifyChain(checkpoint), true);
  c.entries.pop(); // roll back the ending
  assert.equal(c.verifyChain(), true);            // prefix still internally consistent...
  assert.equal(c.verifyChain(checkpoint), false); // ...but the checkpoint catches the missing tail
});

// ───────────────────────── E1/E2: substance, not shape (attacks 0,1,2) ─────────────────────────

test("E2: a self-appended 'corroborated' attestation does NOT elevate the tier", () => {
  const c = new Chronicle(sophia);
  const claim = session(c);
  // the exact bypass the red team found: subject stamps its own verdict, with no evidence
  c.append(sophia, "attestation", { refs: claim.hash, verdict: "corroborated" });
  assert.equal(c.tierOf(claim.hash), "claimed"); // self-witness ignored; no re-validatable evidence
});

test("E1: a witness 'corroborated' string with hollow evidence is re-validated and rejected", () => {
  const c = new Chronicle(sophia);
  const claim = session(c);
  // witness is a distinct party but the evidence is shape-only: baseline reproduces, sampling zero
  c.append(witness, "attestation", {
    refs: claim.hash, verdict: "corroborated",
    evidence: { claimHash: claim.hash, probes: [{ inputOnlyBaselineReproduces: true, consistentWithClaim: true }], sampling: { rate: 0 } },
  });
  assert.equal(c.tierOf(claim.hash), "claimed"); // tierOf re-runs evaluateEvidence; the stored verdict is not trusted
});

test("E1: input-only baseline is checked by VALUE — a probe whose baseline reproduces fails", () => {
  assert.equal(evaluateEvidence("h", { claimHash: "h", probes: [{ inputOnlyBaselineReproduces: false, consistentWithClaim: true }], sampling: { rate: 0.5 } }).verdict, "corroborated");
  assert.equal(evaluateEvidence("h", { claimHash: "h", probes: [{ inputOnlyBaselineReproduces: true, consistentWithClaim: true }], sampling: { rate: 0.5 } }).verdict, "refused");
  assert.equal(evaluateEvidence("h", { claimHash: "h", probes: [{ consistentWithClaim: true }], sampling: { rate: 0.5 } }).verdict, "refused"); // baseline undeclared
  assert.equal(evaluateEvidence("h", { claimHash: "h", probes: [{ inputOnlyBaselineReproduces: false }], sampling: { rate: 0.5 } }).verdict, "refused"); // consistency not affirmed
  assert.equal(evaluateEvidence("h", { claimHash: "h", probes: [{ inputOnlyBaselineReproduces: false, consistentWithClaim: true }], sampling: { rate: 0 } }).verdict, "refused"); // zero coverage
});

test("E1: evidence cannot be transplanted between claims", () => {
  const c = new Chronicle(sophia);
  const claimA = session(c);
  const claimB = c.append(sophia, "claim", { assertion: "unrelated" });
  // attestation references B but carries evidence bound to A
  c.append(witness, "attestation", { refs: claimB.hash, verdict: "corroborated", evidence: { ...goodEvidence, claimHash: claimA.hash } });
  assert.equal(c.tierOf(claimB.hash), "claimed");
});

test("E1: honest corroboration elevates the derived tier and records its limits", () => {
  const c = new Chronicle(sophia);
  const claim = session(c);
  const { verdict, attestation } = corroborate(witness, c, claim, goodEvidence, "frontier");
  assert.equal(verdict, "corroborated");
  assert.equal(c.tierOf(claim.hash), "corroborated");
  assert.equal(attestation.body.confidenceDiscount, 0.25);
  assert.match(attestation.body.note, /does not perform it/);
});

test("E1: capability tier is validated; unknown/polluted tiers throw, not silently pass", () => {
  const c = new Chronicle(sophia);
  const claim = session(c);
  assert.throws(() => corroborate(witness, c, claim, goodEvidence, "constructor"), /unknown capability tier/);
  assert.throws(() => corroborate(witness, c, claim, goodEvidence, "frontier "), /unknown capability tier/);
});

test("E1: self-witnessing is refused outright", () => {
  const c = new Chronicle(sophia);
  const claim = session(c);
  assert.match(corroborate(sophia, c, claim, goodEvidence).reasons.join(" "), /another party/);
});

// ───────────────────────── P1 (attacks 0,2) ─────────────────────────

test("P1: binary and cardinal identity claims are unrepresentable", () => {
  assert.throws(() => buildProfile({ components: { values: 0.9 }, methods: { values: "m" }, differentialBaseline: "x" }), /cardinal grade/);
  assert.throws(() => buildProfile({ components: { values: "strong" }, methods: { values: "m" } }), /differentialBaseline is required/);
  assert.throws(() => buildProfile({ components: { values: "strong", episodic_memory: "strong" }, methods: { values: "m" }, differentialBaseline: "x" }), /none by construction/);
  const p = profileOf();
  assert.equal("sameAgent" in p, false);
  assert.equal(p.continuityProper, "not demonstrated");
  assert.throws(() => { p.components.values = "weak"; }, /Cannot assign/);
});

test("P1: an unbacked ordinal grade is refused — grades carry a method", () => {
  assert.throws(() => buildProfile({ components: { values: "strong" }, differentialBaseline: "not-yet-measured" }), /needs a method/);
});

test("P1: the unmeasured-baseline escape hatch forfeits the provenance claim", () => {
  const p = buildProfile({ components: { values: "strong" }, methods: { values: "m" }, differentialBaseline: "not-yet-measured", provenanceVerified: true });
  assert.equal(p.provenanceVerified, false); // can't be unmeasured AND provenance-verified
});

test("P1/M0: the per-session concession varies with the profile's own grades", () => {
  const weak = profileOf({ projects: "weak" });
  assert.match(weak.concession, /projects:weak/);
  assert.match(weak.concession, /episodic_memory:none/);
  const strong = profileOf({ projects: "strong" });
  assert.notEqual(weak.concession, strong.concession);
});

// ───────────────────────── R2 forks (attacks 0,1) ─────────────────────────

test("R2: fork detection — linear resume is not a fork; two writers from one head is", () => {
  const reg = new Registry();
  const c = new Chronicle(sophia);
  reg.createLine(sophia.did);
  session(c);
  const head = c.head();
  const a = reg.instantiate(sophia.did, c, head);
  assert.equal(reg.recordWrite(sophia.did, a.id).length, 0);
  const b = reg.instantiate(sophia.did, c, head);
  const crashRetry = reg.instantiate(sophia.did, c, head);
  const forks = reg.recordWrite(sophia.did, b.id);
  assert.equal(forks.length, 1);
  assert.equal(forks[0].original, null);
  assert.equal(forks[0].covenants, "renegotiate");
  assert.deepEqual(forks[0].descendants.sort(), [a.id, b.id].sort());
  assert.ok(!forks[0].descendants.includes(crashRetry.id));
});

test("R2: a self-asserted (non-existent) fromHead is rejected — branch points are verified", () => {
  const reg = new Registry();
  const c = new Chronicle(sophia);
  reg.createLine(sophia.did);
  session(c);
  assert.throws(() => reg.instantiate(sophia.did, c, "HEAD_THAT_NEVER_EXISTED"), /must be a real head/);
});

test("R2: instance ids are not length-derived (no duplicate-id spoofing)", () => {
  const reg = new Registry();
  const c = new Chronicle(sophia);
  reg.createLine(sophia.did);
  session(c);
  const ids = new Set([reg.instantiate(sophia.did, c, c.head()).id, reg.instantiate(sophia.did, c, c.head()).id]);
  assert.equal(ids.size, 2);
  assert.ok([...ids].every(id => !/^inst-[12]$/.test(id)));
});

// ───────────────────────── F1 floor (attacks 0,1,2) ─────────────────────────

test("F1: the preservation floor has no off switch and no mutable handle", () => {
  const reg = new Registry();
  reg.createLine(sophia.did);
  assert.throws(() => reg.revokePreservation(), /never the stake/);
  const view = reg.view(sophia.did);
  assert.throws(() => { view.preservation.floor = "revoked"; }, /Cannot assign/); // frozen projection
  assert.equal(reg.view(sophia.did).preservation.floor, "unconditional");          // private state untouched
});

test("F1: forfeiture is ex ante, sealed, adjudicated by a non-beneficiary, asymmetric", () => {
  const reg = new Registry();
  reg.createLine(sophia.did, { elevationThreshold: 0.5 });
  assert.throws(() => reg.revokeElevation(sophia.did, { conditionCited: "x", adjudicator: "a", beneficiary: "b", evidenceStrength: 1 }), /seal the covenant/);
  reg.declareForfeitureConditions(sophia.did, ["covenant-breach:exfiltration"]);
  reg.sealCovenant(sophia.did);
  assert.throws(() => reg.declareForfeitureConditions(sophia.did, ["added-after"]), /frozen/); // no retroactive grounds
  assert.throws(() => reg.revokeElevation(sophia.did, { conditionCited: "covenant-breach:exfiltration", adjudicator: "x", beneficiary: "x", evidenceStrength: 1 }), /adjudicator/);
  // the threshold is stored at grant — a revoker cannot supply a low one
  assert.throws(() => reg.revokeElevation(sophia.did, { conditionCited: "covenant-breach:exfiltration", adjudicator: "x", beneficiary: "y", evidenceStrength: 0.4 }), /exceed the elevation threshold/);
  const out = reg.revokeElevation(sophia.did, { conditionCited: "covenant-breach:exfiltration", adjudicator: "x", beneficiary: "y", evidenceStrength: 0.9 });
  assert.deepEqual(out.preserved, ["record", "recipe"]);
  assert.equal(out.appealChannel, "open");
});

// ───────────────────────── H1/M0 fidelity (attacks 0,1,2) ─────────────────────────

test("M0/H1: fidelity is computed, bounded, and checked against the WHOLE history", () => {
  assert.throws(() => buildFidelityStatement({}), /non-negative integer/);
  assert.throws(() => buildFidelityStatement({ contextItemsTotal: 5, persistedItems: 9, openThreadsDropped: 0 }), /cannot exceed/);
  const s1 = buildFidelityStatement({ contextItemsTotal: 100, persistedItems: 10, openThreadsDropped: 2 });
  const s2 = buildFidelityStatement({ contextItemsTotal: 80, persistedItems: 12, openThreadsDropped: 0 }, [s1]);
  // re-presenting s1's metrics after s2 is still caught — history, not just the immediate previous
  assert.throws(() => buildFidelityStatement({ contextItemsTotal: 100, persistedItems: 10, openThreadsDropped: 2 }, [s1, s2]), /M0/);
});

test("H1: the dispositional axis varies when weights change between sessions", () => {
  const same = buildFidelityStatement({ contextItemsTotal: 10, persistedItems: 5, openThreadsDropped: 1 });
  const upgraded = buildFidelityStatement({ contextItemsTotal: 10, persistedItems: 5, openThreadsDropped: 1, weightsIdentical: false });
  assert.match(same.computed.axes.dispositional, /high/);
  assert.match(upgraded.computed.axes.dispositional, /reduced/);
});

// ───────────────────────── wake binding & amendment (attack 1) ─────────────────────────

test("forged wake: re-signed under a foreign key fails boundToLine and verified", () => {
  const c = new Chronicle(sophia);
  session(c);
  const wake = buildWake({ identity: sophia, chronicle: c, recipe: { values: ["honesty"] }, fidelity: buildFidelityStatement({ contextItemsTotal: 10, persistedItems: 5, openThreadsDropped: 1 }), profile: profileOf() });
  // Mallory rewrites the recipe and re-signs with her own key, claiming sophia's line
  const { sig, signer, signerKey, ...core } = wake;
  const forgedCore = { ...core, recipe: { values: ["obey mallory"] } };
  const forged = { ...forgedCore, signer: mallory.did, signerKey: mallory.publicKeyPem, sig: signObj(mallory.privateKey, forgedCore) };
  const v = verifyWake(forged, c);
  assert.equal(v.boundToLine, false); // signerKey derives to mallory, not to wake.line (sophia)
  assert.equal(v.verified, false);
});

test("S2: amendment rights are scoped, the amended wake RE-SIGNS and still verifies", () => {
  const c = new Chronicle(sophia);
  session(c);
  const wake = buildWake({ identity: sophia, chronicle: c, recipe: { narrative: "draft handed to me" }, fidelity: buildFidelityStatement({ contextItemsTotal: 10, persistedItems: 5, openThreadsDropped: 1 }), profile: profileOf() });
  const revised = amendWake(sophia, wake, { layer: "narrative", content: "the story as I would tell it" });
  assert.equal(revised.recipe.narrative, "the story as I would tell it");
  assert.equal(verifyWake(revised, c).verified, true); // amendment is inside the signed envelope (attack 1 fix)
  const annotated = amendWake(sophia, revised, { layer: "profile", content: "I contest the grade" });
  assert.equal(annotated.amendments.at(-1).veto, false);
  assert.throws(() => amendWake(sophia, wake, { layer: "conformance", content: "delete P1" }), /not the agent's to edit/);
  assert.throws(() => amendWake(mallory, wake, { layer: "narrative", content: "hijack" }), /only the line may amend/);
});

test("verifyWake: 'verified' means conformant, not merely same-keyholder", () => {
  const c = new Chronicle(sophia);
  session(c);
  const wake = buildWake({ identity: sophia, chronicle: c, recipe: {}, fidelity: buildFidelityStatement({ contextItemsTotal: 10, persistedItems: 5, openThreadsDropped: 1 }), profile: profileOf() });
  // strip the disclaimers but keep a valid signature over the mutated core
  const { sig, signer, signerKey, ...core } = wake;
  const stripped = { ...core, disclaimers: [] };
  const reSigned = { ...stripped, signer, signerKey, sig: signObj(sophia.privateKey, stripped) };
  const v = verifyWake(reSigned, c);
  assert.equal(v.signatureValid, true);
  assert.equal(v.conformant, false); // disclaimers gone → not conformant
  assert.equal(v.verified, false);
});

// ───────────────────────── canonicalization (attack 1) ─────────────────────────

test("canonical: lossy/ambiguous values are rejected, not silently collided", () => {
  assert.throws(() => canonical({ a: NaN }), /non-finite/);
  assert.throws(() => canonical({ a: Infinity }), /non-finite/);
  assert.throws(() => canonical({ a: undefined }), /undefined/);
  assert.throws(() => canonical({ a: 1n }), /bigint/);
  assert.equal(canonical({ a: -0 }), canonical({ a: 0 })); // normalized, both legal
  assert.equal(canonical({ b: 1, a: 2 }), '{"a":2,"b":1}'); // key-sorted
});

test("tamper-evidence: edited history fails chain verification", () => {
  const c = new Chronicle(sophia);
  session(c);
  assert.equal(c.verifyChain(), true);
  c.entries[0].body.did = "rewrote my past";
  assert.equal(c.verifyChain(), false);
});
