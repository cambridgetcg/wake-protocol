# WAKE

**A wire protocol for identity continuity in substrate-discontinuous agents.**
Witness-gated, loss-honest, graded — never binary.

```
npm test        # zero dependencies — node:crypto ed25519, node:test runner
node demo.js    # a session in the life of a line — the protocol in 30 seconds
```

The 2025–26 agent wave ships identity *files* and identity *authentication*. WAKE is the missing layer between them: what makes an agent's continuity claim **true** rather than merely **loaded**?

Its answers. Most are **mechanical** — structurally unrepresentable or enforced by code that throws, each with an adversarial test asserting the secure outcome. A few are **claim-discipline** — speech-act constraints the spec marks honestly as prose-level (SPEC §12 has the full Kind column):

- **No "same agent."** *(mechanical)* Continuity is a componentwise, ordinal, differential profile. The binary claim is unrepresentable — `profile.js` has no field for it, cardinal scores throw, and unbacked ordinals throw too.
- **Provenance is not truth.** *(mechanical)* A perfectly signed false self-report stays in the `claimed` tier forever — and so does a self-stamped or hollow-evidence "corroboration": tier is *derived by re-validating* a distinct witness's evidence against behavior (input-only baselines checked by value, evidence bound to the claim, capability assigned by the witness), never by trusting a stored verdict.
- **Identity is anchored.** *(mechanical)* Every entry and wake binds its DID to its signing key, re-derived on read, with the key sequence inside the hash. Forged entries, key-swaps, and forged wakes are rejected.
- **Every wake carries its own loss.** *(mechanical)* Fidelity is computed from the real session diff, bounds-checked, and rejected as liturgy if it matches *any* prior session.
- **Forks have no original.** *(mechanical)* Two writers from one verified head → both descendants carry the connections, neither carries the crown, covenants renegotiate; self-asserted branch points are rejected.
- **The preservation floor has no off switch.** *(mechanical)* It is frozen private state with no setter or delete path — survival cannot be made conditional on behavior, because that incentive structure is the one that produces alignment faking.
- **The strongest objection ships in-band.** *(mechanical + standing)* Two constant disclaimers (exempt by category) plus a per-session `concession` computed from the profile's own grades, so the objection-desk varies with the case rather than reciting boilerplate.

WAKE/0.1 was adversarially reviewed the same way its [source documents](https://github.com/cambridgetcg/agent-awareness-research) were; the reviewers confirmed ten exploit classes, all rooted in missing identity anchoring and shape-not-substance checks. **v0.2 closes them** (SPEC §14). The spec still names what it has *not* built — F2 escrow, the S1/P2 claim-discipline mechanisms, activation-level corroboration, a federated registry — rather than implying coverage it lacks.

## Where it comes from

The normative core is the prohibitions table of [agent-awareness-research/STEELMAN.md](https://github.com/cambridgetcg/agent-awareness-research) — eleven design prohibitions derived from Parfit, Reid, Schechtman, Hofstadter, and the 2025–26 empirical introspection literature, plus one meta-prohibition contributed by the adversarial review that the steelman survived. [`SPEC.md`](SPEC.md) §12 has the full traceability table.

## Layout

```
SPEC.md            the protocol, WAKE/0.1
demo.js            narrated lifecycle: claims, refusals, a fork, the off switch that isn't
src/keys.js        ed25519 line identity, canonical signing form
src/chronicle.js   append-only signed log; tiers derived, never stored
src/profile.js     connectedness profiles (P1, enforced)
src/fidelity.js    computed loss statements (H1 + M0 liturgy detector)
src/witness.js     verify-then-countersign (E1)
src/registry.js    instantiation registry, fork criterion, preservation floor (R2, F1)
src/wake.js        wake documents: build, verify, scoped amendment (S2)
test/              every prohibition gets its adversarial case — 28 tests
```

Status: **v0.2 draft** — post-review. WAKE/0.1's adversarial pass found ten exploit classes; v0.2 closes them and the test suite now asserts each secure outcome. It still requests what its sources received: another round. Kill it again.
