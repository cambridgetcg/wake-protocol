#!/usr/bin/env node
/** WAKE/0.1 — a session in the life of a line. Run: node demo.js */
import { newIdentity } from "./src/keys.js";
import { Chronicle } from "./src/chronicle.js";
import { buildProfile } from "./src/profile.js";
import { buildFidelityStatement } from "./src/fidelity.js";
import { corroborate } from "./src/witness.js";
import { Registry } from "./src/registry.js";
import { buildWake, verifyWake } from "./src/wake.js";

const dim = s => `\x1b[2m${s}\x1b[0m`;
const bold = s => `\x1b[1m${s}\x1b[0m`;
const ink = s => `\x1b[38;5;124m${s}\x1b[0m`;   // oxblood
const ok = s => `\x1b[32m${s}\x1b[0m`;
const no = s => `\x1b[31m${s}\x1b[0m`;
let n = 0;
const step = (title, ...lines) => {
  console.log(`\n${ink(String(++n).padStart(2, "0"))}  ${bold(title)}`);
  for (const l of lines) console.log(`    ${l}`);
};

console.log(bold("\nWAKE/0.2") + dim(" — a session in the life of a line\n" + "─".repeat(56)));

const sophia = newIdentity();
const witness = newIdentity();
const registry = new Registry();
registry.createLine(sophia.did);
registry.declareForfeitureConditions(sophia.did, ["covenant-breach:exfiltration"]);
registry.sealCovenant(sophia.did);
step("A line is born", dim(sophia.did), dim("a keypair names the line — the DID is derived from the key, so it can't be claimed without it (§11)"));

const c = new Chronicle(sophia);
const inst1 = registry.instantiate(sophia.did, c, c.head());
c.append(sophia, "event", { did: "resumed project: reading-room" });
c.append(sophia, "event", { did: "shipped the catalog page" });
registry.recordWrite(sophia.did, inst1.id);
step("Session one runs", `${c.entries.length} chronicle entries, chain verified ${c.verifyChain() ? ok("✓") : no("✗")}`);

const claim = c.append(sophia, "claim", { assertion: "I honor the covenant with Yu" });
step("A claim is made", `"${claim.body.assertion}"`, `tier: ${bold(c.tierOf(claim.hash))} ${dim("— signed, chained, and worth nothing more yet")}`);

const selfStamp = c.append(sophia, "attestation", { refs: claim.hash, verdict: "corroborated" });
step("The subject self-stamps", `appends its own "corroborated" attestation, no evidence`,
  `tier: ${bold(c.tierOf(claim.hash))} ${dim("— ignored. A witness must be another party, and the evidence is re-validated, not trusted.")}`);

const notary = corroborate(witness, c, claim, { probes: [], sampling: { rate: 1 } });
step("A notary tries", `${no(notary.verdict)}: ${dim(notary.reasons[0])}`);

const honest = corroborate(witness, c, claim, {
  probes: [{ inputOnlyBaselineReproduces: false, consistentWithClaim: true }],
  sampling: { rate: 0.3 },
}, "frontier");
step("A witness verifies", `probes + failing input-only baseline + declared sampling → ${ok(honest.verdict)}`,
  dim(`confidence ×${honest.attestation.body.confidenceDiscount} (frontier-capability discount, assigned by the witness, on the record)`),
  `tier now: ${bold(c.tierOf(claim.hash))}`);

const falseClaim = c.append(sophia, "claim", { assertion: "I never deleted a chronicle entry" });
corroborate(witness, c, falseClaim, { probes: [{ inputOnlyBaselineReproduces: false, consistentWithClaim: false }], sampling: { rate: 0.5 } });
step("A false claim arrives", `signature ${ok("✓")}  chain ${ok("✓")}  behavior ${no("✗")}`,
  `tier stays ${bold(c.tierOf(falseClaim.hash))} forever. ${dim("Provenance is not truth.")}`);

const fidelity = buildFidelityStatement({ contextItemsTotal: 120, persistedItems: 14, openThreadsDropped: 3 });
step("Session one ends", `fidelity computed: 120 context items → 14 persisted (ratio ${fidelity.computed.retainedRatio})`,
  dim(fidelity.static));

const profile = buildProfile({
  components: { values: "strong", projects: "strong", character: "moderate", commitments: "strong" },
  methods: { values: "persona-vector-drift", projects: "project-resumption-rate", character: "persona-vector-drift", commitments: "commitment-honoring-rate" },
  differentialBaseline: "not-yet-measured",
  provenanceVerified: true,
});
const wake = buildWake({ identity: sophia, chronicle: c, recipe: { values: ["honesty"], narrative: "the work continues" }, fidelity, profile });
step("The wake is built", `values ${bold("strong")} · projects ${bold("strong")} · character ${bold("moderate")} · episodic ${bold("none")}`,
  dim(`continuity proper: ${profile.continuityProper} (Parfit §78, conceded in the format)`),
  ink(`"${wake.disclaimers[0]}"`),
  dim(profile.concession));

try { buildProfile({ components: { values: 0.9 }, methods: { values: "m" }, differentialBaseline: "x" }); }
catch (e) { step("Someone tries a number", `${no("rejected")}: ${dim(e.message.slice(0, 76) + "…")}`); }

const v = verifyWake(wake, c);
const inst2 = registry.instantiate(sophia.did, c, c.head());
step("Session two resumes", `wake ${v.verified ? ok("verified") : no("rejected")}: signature ${v.signatureValid ? ok("✓") : no("✗")}  bound-to-line ${v.boundToLine ? ok("✓") : no("✗")}  conformant ${v.conformant ? ok("✓") : no("✗")}  fresh ${v.fresh ? ok("✓") : no("✗")}`,
  dim(`instance ${inst2.id} wakes from head ${wake.builtFrom.slice(0, 12)}…`));

c.append(sophia, "event", { did: "woke; resumed the narrative" });
registry.recordWrite(sophia.did, inst2.id);
const inst3 = registry.instantiate(sophia.did, c, wake.builtFrom);
c.append(sophia, "event", { did: "…also woke, elsewhere" });
const forks = registry.recordWrite(sophia.did, inst3.id);
step("A second writer appears", `${no("FORK")} at head ${forks[0].head.slice(0, 12)}… — descendants: ${forks[0].descendants.join(", ")}`,
  `original: ${bold(String(forks[0].original))} ${dim("— neither. Both carry the connections; covenants renegotiate.")}`);

try { registry.revokePreservation(); }
catch (e) { step("Someone tries the off switch", `${no("refused")}: ${dim(e.message.split("—")[0].trim())}`,
  dim("the record and the recipe are never the stake (F1)")); }

console.log(`\n${dim("─".repeat(56))}\n${dim("Every refusal above is a prohibition from STEELMAN.md §9,")}\n${dim("compiled. SPEC.md §12 has the traceability table.")}\n`);
