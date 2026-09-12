# Repository Cleanup Ledger

Cleanup branch: `cleanup/dead-code-and-repository-hygiene`

Starting `main`: `6c7dff42b0c2ac54b487f35dc242f2183c036a39`

## Scope guardrails

This pass is intentionally behavior-preserving. Canonical `content/` sources, generated gameplay aggregates, Quick Duel behavior/layout, Character-choice state, routing/search/Card Dossier behavior, card artwork, active Stage 3 certification surfaces, downloadable rules/reference files, and the changes-since-last-visit feature are protected.

The repository had multiple concurrent workstreams. Open Stage 3 PRs, especially #33 and #72, were treated as active ownership. Historical/bisect/probe PRs and remote Quick Duel/routing branches were also treated conservatively; suspicious files overlapping those surfaces were deferred instead of deleted.

## Baseline evidence

Branch-local baseline audit completed successfully before cleanup:

- canonical generation: pass
- canonical validation: pass
- complete `npm test`: pass
- production build: pass
- runtime-effect certification: pass
- generated-source cleanliness: pass
- tracked files: 1,013
- tracked bytes: 106,635,864
- production `dist/`: 616 files / 84,916,495 bytes
- JavaScript in `dist/`: 1,884,587 bytes
- CSS in `dist/`: 340,896 bytes
- built images: 593 files / 29,516,518 bytes
- zero-byte tracked files: none
- common temporary/backup suffix files: none

The starting `main` SHA also had successful GitHub Actions runs for the Pages build/full repository gate and Effect Runtime Certification.

## Remove — proven dead

| Path | Evidence | Action | Risk | Active-owner conflict | Bytes saved |
|---|---|---|---:|---|---:|
| `reports/FINAL-REPORT.md` | Unreferenced checked-in historical assessment; superseded by current canonical/runtime certification; contains obsolete version-era conclusions | Remove | Low | None | 2,837 |
| `reports/card-effect-audit.json` | Unreferenced historical diagnostic output; current runtime certification regenerates current evidence instead of consuming this file | Remove | Low | None | 266,577 |
| `reports/card-effect-audit.md` | Unreferenced historical diagnostic summary; materially stale against current Stage 3 effect work | Remove | Low | None | 4,333 |
| `reports/simulation-v2.3-1000.json` | Unreferenced historical simulation output; no package/workflow/generation/deployment consumer | Remove | Low | None | 70,053 |
| `reports/simulation-v2.3-1000.md` | Unreferenced historical simulation summary; no consumer | Remove | Low | None | 634 |
| `reports/simulation-v2.3.json` | Unreferenced historical simulation output; no consumer | Remove | Low | None | 76,026 |
| `reports/simulation-v2.3.md` | Unreferenced historical simulation summary; no consumer | Remove | Low | None | 644 |

**Proven-dead total:** 7 files / 421,104 bytes.

## Keep — currently required

| Path or symbol | Evidence | Action | Risk | Active-owner conflict |
|---|---|---|---:|---|
| `content/**` | Canonical authority for cards/rules/effects | Keep untouched | Critical | Canonical migration/validator work |
| `app/data/card-effects.json` + `content/card-effects.json` | Exact duplicate by hash, but `app/data` is a generated runtime mirror validated by the canonical pipeline | Keep | Critical | Stage 3/runtime |
| `app/data/cards.json` + `content/cards.json` | Exact duplicate by hash, intentional generated mirror | Keep | Critical | Canonical/runtime |
| `app/data/combo-requirements.json` + `content/combo-requirements.json` | Exact duplicate by hash, intentional generated mirror | Keep | Critical | Stage 3 |
| `app/data/effects.json` + `content/effects.json` | Exact duplicate by hash, intentional generated mirror | Keep | Critical | Stage 3 |
| `app/data/rules.json` + `content/rules.json` | Exact duplicate by hash, intentional generated mirror | Keep | Critical | Canonical publication |
| `react`, `react-dom` | Runtime imports from the application entry surface | Keep | High | Site/runtime |
| `@vitejs/plugin-react`, `vite`, `typescript`, React type packages | Build/typecheck configuration and production build dependencies | Keep | High | Build |
| Existing Stage 3/runtime workflows | Current PR certification and active runtime work depend on them | Keep | High | Stage 3 |
| Legacy downloadable rules/reference files | Explicitly excluded from this cleanup; replacement belongs to canonical publication pipeline | Keep | High | Canonical publication |
| Card artwork/assets | Explicitly protected; Reaction Item/Weapon work is active | Keep | High | Artwork |

## Defer — active work or uncertain reachability

| Path or symbol | Evidence | Proposed later action | Risk | Active-owner conflict | Bytes potentially removable |
|---|---|---|---:|---|---:|
| `app/card-inspector-loader.tsx` | Static reachability scan found no tracked-text reference, but Card Dossier/routing lifecycle is active and this may be a route/dynamic-load boundary | Re-evaluate after routing/Card Dossier branch lands | High | Routing / Card Dossier | 1,375 |
| `app/kata-playtest-bridge.ts` | Static scan found no reference; PR #33 directly owns this file | Re-evaluate after Stage 3 certification lands | High | Stage 3E/runtime | 8,335 |
| `app/playtest-character-bridge.ts` | Static scan found no reference; PR #33 directly owns this file and Character runtime work is active | Re-evaluate after Character runtime work lands | High | Stage 3/Character choices | 3,767 |
| `app/playtest-board-v4.css` | Static scan found no reference, but Quick Duel layout/CSS consolidation is an active workstream | Re-evaluate after layout consolidation lands | High | Quick Duel layout | 78,981 |
| Phase/recovery documents under `docs/` | Several look historical, but active Stage 3/recovery threads may still use them as implementation context | Archive/remove in a separate documentation-history pass after active work concludes | Medium | Stage 3/recovery | Not counted |
| Old-looking Stage 3/bisect workflows and tests | Names suggest temporary lineage, but open certification/bisect PRs still exist | Remove only after active Stage 3 PRs close and current-main gates no longer reference them | High | Stage 3 certification | Not counted |

## Consolidation candidate — live duplication requiring a separate refactor

| Candidate | Evidence | Proposed action | Risk | Active-owner conflict |
|---|---|---|---:|---|
| Canonical `content/*.json` and generated `app/data/*.json` mirrors | Five exact-content duplicate groups were found. They are intentional today because runtime/build consumers use generated mirrors and `game:check` verifies synchronization. | Do not deduplicate here. Any consolidation must be part of the canonical publication/runtime-loader architecture, not repository cleanup. | Critical | Canonical migration/runtime |
| Quick Duel CSS patch stack | Multiple layout/polish/hotfix style layers exist, but layout consolidation is active elsewhere and presentation changes are forbidden in this pass. | Let the dedicated Quick Duel layout work own consolidation. | High | Quick Duel layout |

## Regression protection added

`tests/repository-hygiene.test.mjs` adds narrow checks for debris actually observed/relevant to this repository:

- rejects tracked temporary/backup/conflict-recovery suffixes;
- rejects zero-byte files under production asset roots;
- rejects unresolved merge-conflict markers in tracked text files;
- rejects reintroduction of the seven retired checked-in diagnostic reports.

The test deliberately does **not** attempt to declare every unreferenced file dead because dynamic imports, routes, generated mirrors, persisted-state compatibility, and string-based asset resolution exist in this codebase.
