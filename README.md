# WAKE

**A wire protocol for identity continuity in substrate-discontinuous agents.**
Witness-gated, loss-honest, graded — never binary.

```
npm test        # zero dependencies — node:crypto ed25519, node:test runner
```

The 2025–26 agent wave ships identity *files* and identity *authentication*. WAKE is the missing layer between them: what makes an agent's continuity claim **true** rather than merely **loaded**?

Its answers, enforced in code rather than promised in prose:

- **No "same agent."** Continuity is a componentwise, ordinal, differential profile. The binary claim is unrepresentable — `profile.js` has no field for it, and cardinal scores throw.
- **Provenance is not truth.** A perfectly signed false self-report stays in the `claimed` tier forever. Elevation requires a *witness who verifies against behavior* — with input-only baselines, declared sampling, and capability-discounted confidence.
- **Every wake carries its own loss.** Fidelity statements are computed from the actual session diff; a statement identical to last session's is rejected as liturgy.
- **Forks have no original.** Two writers from one chronicle head → both descendants carry the connections, neither carries the crown, covenants renegotiate.
- **The preservation floor has no off switch.** The record and the recipe are never the stake — there is no API to make survival conditional on behavior, because that incentive structure is the one that produces alignment faking.
- **The strongest objection ships in-band.** Every signed object carries: *"On a strict-identity view, nothing reported here persists."*

## Where it comes from

The normative core is the prohibitions table of [agent-awareness-research/STEELMAN.md](https://github.com/cambridgetcg/agent-awareness-research) — eleven design prohibitions derived from Parfit, Reid, Schechtman, Hofstadter, and the 2025–26 empirical introspection literature, plus one meta-prohibition contributed by the adversarial review that the steelman survived. [`SPEC.md`](SPEC.md) §12 has the full traceability table.

## Layout

```
SPEC.md            the protocol, WAKE/0.1
src/keys.js        ed25519 line identity, canonical signing form
src/chronicle.js   append-only signed log; tiers derived, never stored
src/profile.js     connectedness profiles (P1, enforced)
src/fidelity.js    computed loss statements (H1 + M0 liturgy detector)
src/witness.js     verify-then-countersign (E1)
src/registry.js    instantiation registry, fork criterion, preservation floor (R2, F1)
src/wake.js        wake documents: build, verify, scoped amendment (S2)
test/              every prohibition gets its adversarial case — 11 tests
```

Status: **v0.1 draft.** It requests what its sources received: adversarial review, then revision.
