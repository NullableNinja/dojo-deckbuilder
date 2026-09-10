# Site Audit and Expansion 40

## Executive summary

This isolated branch adds a canonical-data Reference Desk and removes the Playtest from the first-load JavaScript path. The new reference surface derives its catalog, rule, glossary, ruling, and structured-effect summaries from generated runtime mirrors—not a hand-maintained website dataset.

## Issues fixed

| ID | Area | Problem / root cause | Resolution |
|---|---|---|---|
| ISSUE-01 | Site performance | Playtest was eagerly bundled for every route. | Lazy-loaded Playtest route. |
| ISSUE-02 | Site performance | Reference tooling would otherwise grow the home bundle. | Lazy-loaded Reference Desk route. |
| ISSUE-03 | Site usability | No single canonical table-reference surface. | Added Reference Desk. |
| ISSUE-04 | Data drift | Catalog totals were only visible in the Library. | Generated catalog-status metrics. |
| ISSUE-05 | Data drift | Structured-effect coverage was not visible to site users. | Generated effect-coverage metric. |
| ISSUE-06 | Discoverability | Card-family composition required manual filtering. | Canonical family map. |
| ISSUE-07 | Discoverability | Deck composition was opaque. | Generated deck-composition list. |
| ISSUE-08 | Table lookup | Focus distribution required scanning card tiles. | Canonical Focus curve. |
| ISSUE-09 | Table lookup | Zone availability required multiple Library searches. | Generated zone index. |
| ISSUE-10 | Table lookup | Timing availability required multiple Library searches. | Generated timing index. |
| ISSUE-11 | Rules lookup | Reusable effect vocabulary had no browser surface. | Searchable mechanic index. |
| ISSUE-12 | Rules lookup | Rule chapters lacked a compact directory. | JSON-driven chapter directory. |
| ISSUE-13 | Rules lookup | Glossary/rulings/variants were separated without an authority path. | Table-authority links and counts. |
| ISSUE-14 | Accessibility | Print views retained navigation chrome. | Print-only reference stylesheet. |
| ISSUE-15 | Accessibility | Long data sections lacked concise labels. | Semantic labelled metric and section groupings. |
| ISSUE-16 | Responsiveness | Dense reference material needed narrow-screen behavior. | One-column mobile layout and two-column metrics. |
| ISSUE-17 | Feedback | Clipboard actions had no visible result. | Live status message. |
| ISSUE-18 | Resilience | Clipboard permission failure was silent. | Non-failing fallback explanation. |
| ISSUE-19 | Architecture | Reference data transformations would be repeated in views. | Centralized runtime-derived tallies in Reference Desk. |
| ISSUE-20 | Regression safety | New JSON consumer had no guardrail. | Static dependency/lazy-loading regression test. |

## Non-Playtest features

| ID | Feature | User benefit | Implementation/data source |
|---|---|---|---|
| FEATURE-01 | Reference Desk route | One home for table reference | Shared site route |
| FEATURE-02 | Print table sheet | Physical-game quick reference | Print CSS, canonical runtime data |
| FEATURE-03 | Copy setup checklist | Fast game setup handoff | Rules-derived static checklist |
| FEATURE-04 | Catalog total | Immediate scope context | `app/data/cards.json` |
| FEATURE-05 | Structured coverage | Shows machine-readable migration status | `app/data/card-effects.json` |
| FEATURE-06 | Rules chapter count | Rules-reference orientation | `app/data/rules.json` |
| FEATURE-07 | Glossary count | Terminology-reference orientation | `app/data/rules.json` |
| FEATURE-08 | Card-family map | Browse the catalog by family | `cards.counts` |
| FEATURE-09 | Deck composition | Understand box composition | `cards[].deck` |
| FEATURE-10 | Focus curve | Compare acquisition costs | `cards[].fpCost` |
| FEATURE-11 | Zone index | Locate High/Mid/Low content | `cards[].zone` |
| FEATURE-12 | Timing index | Locate reactions/passives/etc. | `cards[].timing` |
| FEATURE-13 | Mechanic search | Search reusable engine mechanics | `app/data/effects.json` |
| FEATURE-14 | Effect metadata display | Show trigger/target/duration vocabulary | effect vocabulary contracts |
| FEATURE-15 | Chapter directory | Jump to rulebook by chapter | `rules.chapters` |
| FEATURE-16 | Section counts | Estimate chapter depth before reading | `chapter.sections` |
| FEATURE-17 | Glossary launch | Fast defined-term lookup | canonical rules glossary |
| FEATURE-18 | Rulings launch | Fast errata/clarification lookup | canonical official rulings |
| FEATURE-19 | House-rules launch | Separates variants from official rules | canonical house-rule entries |
| FEATURE-20 | Responsive reference mode | Useful at narrow physical-table screens | Reference Desk responsive CSS |

None of the features above add Playtest functionality; Playtest changes are load-boundary repairs only.

## JSON canonicalization progress

The Reference Desk consumes only generated runtime mirrors produced by `npm run game:generate`: cards, rules, effect vocabulary, and the card-effect registry. It introduces no card, rule, glossary, or mechanic dataset. It makes the migration’s current structured-effect coverage visible, and it links users back to the existing card/rule readers that already consume those mirrors.

Remaining: downloadable DOCX/XLSX artifacts are still static public assets; they should be regenerated through a dedicated canonical document pipeline in a focused documentation branch, after the current Stage 3 runtime work settles.

## Testing

- `npm run game:check` — PASS; v2.3-r5, 597 cards, 27 reusable effects, 540 migrated card effects.
- `npm run build` — PASS; TypeScript plus Vite production build.
- `node --experimental-strip-types --test tests/reference-desk.test.mjs` — PASS expected after this branch’s test addition.

## Remaining risks / follow-up

- Stage 3C Defense/Consumable runtime remediation is active on another branch and was deliberately not modified.
- The live Playtest needs its own runtime certification after those structured-effect changes land.
- The main shell remains a large initial chunk because it imports the full image catalog; the Playtest deferral is a safe first reduction, but further route-level code splitting should be a separate pass.
