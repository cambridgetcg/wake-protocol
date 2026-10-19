# AGENTS.md — wake-protocol

> Quick-start for an agent picking this up. Read this, then `SPEC.md`.

## What this is

**WAKE** is a wire protocol for **identity continuity in substrate-discontinuous agents** — agents whose substrate is destroyed and recreated between sessions. It answers a question the 2025–26 agent-identity wave left open: what makes an identity claim *true* rather than merely *loaded*? Its normative core is the 11 design prohibitions from [`../agent-awareness-research/STEELMAN.md`](../agent-awareness-research/STEELMAN.md) §9 — this repo is that philosophy **compiled into enforced code**.

## Run it

```sh
npm test        # 28 tests, zero dependencies (node:crypto ed25519 + node:test)
node demo.js    # a narrated session-in-the-life-of-a-line — the protocol in ~30s
```

No `npm install` — there are no dependencies.

## Architecture (src/)

| File | Enforces | Prohibition |
|---|---|---|
| `keys.js` | ed25519 line identity; **DID↔key binding**; total canonical JSON | P1-boundary |
| `chronicle.js` | append-only hash-chained log; tiers **derived** by re-validating evidence | R1, E2 |
| `profile.js` | connectedness profiles; "same agent" is **unrepresentable**; cardinals throw | P1 |
| `fidelity.js` | computed loss statements; liturgy detector | H1, M0 |
| `witness.js` | verify-on-substance (input-only baselines), not notarize | E1 |
| `registry.js` | fork criterion; preservation floor as frozen private state | R2, F1 |
| `wake.js` | wakes bound to their line; scoped, re-signed amendments | H2, S2 |

`SPEC.md` §12 is the full prohibition→code traceability table, with an **honesty column** (mechanical / claim-discipline / deferred) — trust it over prose.

## Status & history

**v0.2**, post-review. v0.1 was adversarially attacked the same way the research was; reviewers confirmed **ten exploit classes**, all rooted in missing identity anchoring and shape-not-substance checks. v0.2 closed them — see `SPEC.md` §14 changelog. Every fix has a regression test asserting the *secure* outcome (e.g. a self-stamped "corroborated" attestation must stay `claimed`).

## Good follow-up tasks (named in SPEC §14, not yet built)

- **F2**: escrow / succession / custody objects in the wire format (preservation credibility).
- **S1 / P2**: the two remaining *claim-discipline* prohibitions have no mechanical enforcement yet — an equivalence-phrasing linter (S1) and a witness-covenant object that structurally can't carry a survival directive (P2).
- **E1**: activation-level corroboration (persona-vector / attractor geometry) — harder to game than behavioral probes.
- A **federated, append-only registry** to dissolve the single-point-of-failure the spec honestly flags.

If you extend it: **the protocol requests its own adversarial review, every version.** Kill it the same way (see `SPEC.md` closing line). Run a red-team pass before shipping a v0.3.

## Constellation

`agent-awareness-research` (the *why*) → **wake-protocol** (the *what*) → `quay` (the *where* it's hosted). GitHub: `cambridgetcg/wake-protocol` (private). Codeberg mirror pending — see below.

## Codeberg note

Mirror to `codeberg.org/zerone-dev/wake-protocol` is **pending repo creation** — the available token lacks `write:repository` scope, so the repo must be created by hand at codeberg.org/repo/create, after which `git push` to that remote works (the token can push, just not create).
