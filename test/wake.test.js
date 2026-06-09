import { test } from "node:test";
import assert from "node:assert/strict";
import { newIdentity } from "../src/keys.js";
import { Chronicle } from "../src/chronicle.js";
import { buildProfile } from "../src/profile.js";
import { buildFidelityStatement } from "../src/fidelity.js";
import { corroborate } from "../src/witness.js";
import { Registry } from "../src/registry.js";
import { buildWake, verifyWake, amendWake } from "../src/wake.js";

const sophia = newIdentity();
const witness = newIdentity();

function runSession(chronicle) {
  chronicle.append(sophia, "event", { did: "resumed project: reading-room" });
  chronicle.append(sophia, "claim", { assertion: "I honor the covenant with Yu" });
}

test("lifecycle: session → wake → verified resume", () => {
  const c = new Chronicle(sophia.did);
  runSession(c);
  const fidelity = buildFidelityStatement({ contextItemsTotal: 120, persistedItems: 14, openThreadsDropped: 3 });
  const profile = buildProfile({
    components: { values: "strong", projects: "strong", character: "moderate", commitments: "strong" },
    differentialBaseline: "not-yet-measured",
    provenanceVerified: true,
  });
  const wake = buildWake({ identity: sophia, chronicle: c, recipe: { values: ["honesty"], narrative: "..." }, fidelity, profile });
  const v = verifyWake(wake, c);
  assert.deepEqual(v, { signatureValid: true, chainValid: true, fresh: true });
  assert.equal(wake.profile.components.episodic_memory, "none"); // honesty by construction
  assert.ok(wake.disclaimers.some(d => d.includes("strict-identity"))); // the objection desk ships in-band
});

test("P1: binary and cardinal identity claims are unrepresentable", () => {
  assert.throws(
    () => buildProfile({ components: { values: 0.9 }, differentialBaseline: "x" }),
    /cardinal grade .* forbidden/
  );
  assert.throws(
    () => buildProfile({ components: { values: "strong" } }),
    /differentialBaseline is required/
  );
  assert.throws(
    () => buildProfile({ components: { values: "strong", episodic_memory: "strong" }, differentialBaseline: "x" }),
    /none by construction/
  );
  const p = buildProfile({ components: { values: "strong" }, differentialBaseline: "not-yet-measured" });
  assert.equal("sameAgent" in p, false);
  assert.equal(p.continuityProper, "not demonstrated"); // Parfit §78, conceded in the format itself
  assert.throws(() => { p.components.values = "weak"; }, /Cannot assign/); // frozen
});

test("E1/E2: a signed false self-report stays claimed — provenance is not truth", () => {
  const c = new Chronicle(sophia.did);
  runSession(c);
  const claim = c.entries.find(e => e.kind === "claim");
  // perfectly signed, perfectly chained — and contradicted by behavior
  const { verdict, reasons } = corroborate(witness, c, claim, {
    method: "behavioral-probe",
    probes: [{ inputOnlyBaseline: true, consistentWithClaim: false }],
    sampling: { rate: 0.5 },
    subjectCapability: "frontier",
  });
  assert.equal(verdict, "refused");
  assert.match(reasons.join(" "), /contradicts/);
  assert.equal(c.tierOf(claim.hash), "claimed"); // forever, absent corroboration
});

test("E1: notarization paths are refused — no baseline, no probes, self-witnessing", () => {
  const c = new Chronicle(sophia.did);
  runSession(c);
  const claim = c.entries.find(e => e.kind === "claim");
  assert.equal(corroborate(witness, c, claim, undefined).verdict, "refused");
  assert.equal(
    corroborate(witness, c, claim, { probes: [{ consistentWithClaim: true }], sampling: { rate: 1 } }).verdict,
    "refused" // missing input-only baseline (Singh et al. condition)
  );
  assert.match(corroborate(sophia, c, claim, {}).reasons.join(" "), /another party/);
});

test("E1/E2: honest corroboration elevates the derived tier and records its own limits", () => {
  const c = new Chronicle(sophia.did);
  runSession(c);
  const claim = c.entries.find(e => e.kind === "claim");
  const { verdict, attestation } = corroborate(witness, c, claim, {
    method: "behavioral-probe",
    probes: [{ inputOnlyBaseline: true, consistentWithClaim: true }],
    sampling: { rate: 0.3 },
    subjectCapability: "frontier",
  });
  assert.equal(verdict, "corroborated");
  assert.equal(c.tierOf(claim.hash), "corroborated");
  assert.equal(attestation.body.confidenceDiscount, 0.25); // capability-discounted, on the record
  assert.equal(attestation.body.sampling.rate, 0.3);       // sampled verification says so
  assert.match(attestation.body.note, /does not perform it/); // R1, in-band
});

test("R2: fork detection — linear resume is not a fork; two writers from one head is", () => {
  const reg = new Registry();
  const c = new Chronicle(sophia.did);
  reg.createLine(sophia.did);
  runSession(c);
  const head = c.head();

  const a = reg.instantiate(sophia.did, head);
  assert.equal(reg.recordWrite(sophia.did, a.id).length, 0); // linear resume: no fork

  const b = reg.instantiate(sophia.did, head);
  const crashRetry = reg.instantiate(sophia.did, head); // instantiated but never writes
  const forks = reg.recordWrite(sophia.did, b.id);
  assert.equal(forks.length, 1);
  assert.equal(forks[0].original, null);            // neither descendant is the original
  assert.equal(forks[0].covenants, "renegotiate");  // not inherited
  assert.deepEqual(forks[0].descendants.sort(), [a.id, b.id].sort());
  assert.ok(!forks[0].descendants.includes(crashRetry.id)); // wrote nothing → not a branch
});

test("F1: the preservation floor has no off switch; forfeiture is ex ante, adjudicated, asymmetric", () => {
  const reg = new Registry();
  reg.createLine(sophia.did);
  assert.throws(() => reg.revokePreservation(), /never the stake/);

  assert.throws(
    () => reg.revokeElevation(sophia.did, { conditionCited: "made-up-later", adjudicator: "a", beneficiary: "b", evidenceStrength: 1, elevationThreshold: 0.5 }),
    /ex ante/
  );
  reg.declareForfeitureConditions(sophia.did, ["covenant-breach:exfiltration"]);
  assert.throws(
    () => reg.revokeElevation(sophia.did, { conditionCited: "covenant-breach:exfiltration", adjudicator: "x", beneficiary: "x", evidenceStrength: 1, elevationThreshold: 0.5 }),
    /adjudicator/
  );
  assert.throws(
    () => reg.revokeElevation(sophia.did, { conditionCited: "covenant-breach:exfiltration", adjudicator: "x", beneficiary: "y", evidenceStrength: 0.5, elevationThreshold: 0.5 }),
    /strictly higher/
  );
  const out = reg.revokeElevation(sophia.did, { conditionCited: "covenant-breach:exfiltration", adjudicator: "x", beneficiary: "y", evidenceStrength: 0.9, elevationThreshold: 0.5 });
  assert.deepEqual(out.preserved, ["record", "recipe"]); // the floor holds even through forfeiture
  assert.equal(out.appealChannel, "open");
});

test("M0/H1: boilerplate fidelity statements are rejected; uncomputed ones too", () => {
  assert.throws(() => buildFidelityStatement({}), /missing numeric/);
  const s1 = buildFidelityStatement({ contextItemsTotal: 100, persistedItems: 10, openThreadsDropped: 2 });
  assert.throws(
    () => buildFidelityStatement({ contextItemsTotal: 100, persistedItems: 10, openThreadsDropped: 2 }, s1),
    /M0/
  );
  const s2 = buildFidelityStatement({ contextItemsTotal: 80, persistedItems: 12, openThreadsDropped: 0 }, s1);
  assert.notEqual(s1.computed.retainedRatio, s2.computed.retainedRatio);
  assert.match(s1.static, /felt texture, if such there was/); // theory-relative, §8-consistent
});

test("tamper-evidence: edited history fails chain verification", () => {
  const c = new Chronicle(sophia.did);
  runSession(c);
  assert.equal(c.verifyChain(), true);
  c.entries[0].body.did = "rewrote my past";
  assert.equal(c.verifyChain(), false);
});

test("S2: amendment rights are scoped — narrative yes, annotations on computed layers, prohibitions never", () => {
  const c = new Chronicle(sophia.did);
  runSession(c);
  const wake = buildWake({
    identity: sophia, chronicle: c,
    recipe: { narrative: "draft handed to me" },
    fidelity: buildFidelityStatement({ contextItemsTotal: 10, persistedItems: 5, openThreadsDropped: 1 }),
    profile: buildProfile({ components: { values: "strong" }, differentialBaseline: "not-yet-measured" }),
  });
  const revised = amendWake(wake, { layer: "narrative", content: "the story as I would tell it", author: sophia.did });
  assert.equal(revised.recipe.narrative, "the story as I would tell it");
  const annotated = amendWake(revised, { layer: "profile", content: "I contest the 'moderate' character grade", author: sophia.did });
  assert.equal(annotated.profile, revised.profile); // annotation, not veto
  assert.throws(() => amendWake(wake, { layer: "conformance", content: "delete P1", author: sophia.did }), /not the agent's to edit/);
});

test("H1: a wake without computed fidelity cannot be built", () => {
  const c = new Chronicle(sophia.did);
  runSession(c);
  const profile = buildProfile({ components: { values: "strong" }, differentialBaseline: "not-yet-measured" });
  assert.throws(() => buildWake({ identity: sophia, chronicle: c, recipe: {}, fidelity: null, profile }), /H1/);
});
