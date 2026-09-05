# Dojo Deckbuilder canonical game source

The `content/` directory is the canonical authoring layer for Dojo Deckbuilder. It is intentionally split into focused source files rather than one giant multi-megabyte document:

- `content/dojo-game.json` — mechanical definition, revision metadata, source policy, mode/economy/combat/progression configuration.
- `content/rules.json` — canonical human-facing rules content: chapters, glossary, rulings, house rules, belt table, and quick-reference prose.
- `content/cards.json` — canonical printed card catalog: identity, rules/flavor text, stats, tags, image references, and other card-facing fields.
- `content/card-effects.json` — canonical executable-behavior migration registry keyed by Catalog ID.
- `content/card-effect.schema.json` — the Stage 3B machine-readable effect contract.

Everything under `app/data/` that is listed in `sourcePolicy.generatedFiles` is a generated runtime artifact and must not be hand-edited.

## Source-of-truth policy

1. Human-authored global mechanics belong in `content/dojo-game.json`.
2. Human-authored rules prose belongs in `content/rules.json`.
3. Human-authored printed card catalog data belongs in `content/cards.json`.
4. Machine-readable card behavior belongs in `content/card-effects.json` during the Stage 3B migration and is keyed by the card's unique Catalog ID. English `rulesText` is presentation text, not executable source code.
5. `content/card-effect.schema.json` defines the allowed structured effect vocabulary.
6. `app/data/game-definition.json`, `app/data/rules.json`, `app/data/cards.json`, and `app/data/card-effects.json` are generated-only runtime files.
7. There are no remaining legacy authoritative JSON data sources after Stage 3A.
8. `npm run game:generate` regenerates all four derived runtime data files from `content/`.
9. `npm run game:check` fails when generated data drifts from canonical source, when core catalog/effect invariants break, or when retired r5 rules reappear.

## Current enforcement

The canonical-source checker verifies:

- exact equality between `content/dojo-game.json`'s `definition` and `app/data/game-definition.json`;
- exact equality between `content/rules.json` and `app/data/rules.json`;
- exact equality between `content/cards.json` and `app/data/cards.json`;
- exact equality between `content/card-effects.json` and `app/data/card-effects.json`;
- matching v2.3 / v2.3-r5 metadata across canonical rules, cards, effects, definition, and generated runtime data;
- canonical card count integrity, unique Catalog IDs, named cards, and presence of every Starter Deck card;
- the fixed Starter Deck still totals 15 cards;
- every structured-effect entry resolves to a real Catalog ID and matching card name;
- valid structured triggers/actions, unique effect IDs within each card, and named resolvers for custom effects;
- all eleven Starter card identities have structured migration entries;
- unique rule chapter IDs, section IDs, glossary terms, ruling IDs, and house-rule names;
- the full nine-rank Belt Table;
- required r5 rules including seven-card hands, unlimited legal Attacks, Flow draw, Market Mercy, and the Bad Habit Focus action;
- absence of retired two-Attack-limit and Controlled Refill rules;
- source-policy declarations for every canonical and generated data file;
- absence of legacy authoritative data files.

Because `npm test` begins with `npm run game:check`, these invariants also gate GitHub Pages deployment.

## Migration plan

### Stage 1 — mechanical definition — COMPLETE

`content/dojo-game.json` is authoritative for `app/data/game-definition.json`.

### Stage 2 — rules content — COMPLETE

`content/rules.json` is authoritative for rule chapters, glossary entries, rulings, house rules, belt definitions, and quick-reference material. `app/data/rules.json` is generated-only. The website renders the generated runtime rules file, so the online rulebook, glossary, rulings, and house-rule views consume canonical rule content.

### Stage 3A — card catalog authority — COMPLETE

`content/cards.json` is authoritative for the existing printed card catalog. `app/data/cards.json` is generated-only. This migration intentionally changed no card behavior, balance, printed text, IDs, field names, ordering, or runtime schema; it eliminated the last independently maintained JSON source of truth.

The catalog currently contains some legacy internal `id` collisions that predate this migration. Catalog IDs remain the enforced unique public/game identity. Stage 3A deliberately does not rewrite those existing internal IDs because this stage is source canonicalization, not schema cleanup.

### Stage 3B — structured executable card effects — IN PROGRESS

The structured-effect contract exists in `content/card-effect.schema.json`. `content/card-effects.json` is now the canonical migration registry for executable behavior, keyed by Catalog ID, and `app/data/card-effects.json` is generated from it.

**Starter family migration is complete at the data-contract layer:** all eleven Starter identities have structured entries. No-effect Starter cards explicitly carry empty effect arrays; Breathing Drill carries an executable next-Attack modifier; Footwork Drill carries its Speed modifier plus a named pending resolver for the fastest-fighter Focus check; and Wild Swing carries a named zone-choice resolver.

`app/card-effects.ts` can now resolve structured effects from either an inline card record or the generated registry. Structured data takes precedence over prose and unsupported structured clauses remain explicitly queued rather than silently falling back to regex interpretation.

The next Stage 3B slice is to pass the generated registry through the live Quick Duel playtest so `applyCardEffects` and attack declaration use `effectPlanForCard(card, registry)`. Then finish the two Starter dedicated resolvers (Footwork Drill fastest-Focus and Wild Swing zone choice) and remove Starter dependence on prose parsing entirely. After that, migrate Attacks, Defenses, Katas, Items, Combos, Locations, and Characters family by family.

Do not remove the compatibility layer until every supported card has structured behavior and semantic parity has been verified.

### Stage 4 — downloadable publications

Generate Full Rules, Quick Start, Glossary, and Card Catalog downloads from the same canonical source. Download files stop being independently edited sources.

### Stage 5 — hard enforcement

CI must reject:

- direct drift in generated files;
- duplicate or missing Catalog IDs;
- references to nonexistent cards/rules/effects;
- unsupported executable card effects once their migration family is declared complete;
- engine constants that duplicate canonical mechanical values;
- mismatched rules revisions across the site, playtest, simulator, and publications.

## Editing workflow

For canonical game-data changes:

1. Edit the appropriate source under `content/`: `dojo-game.json`, `rules.json`, `cards.json`, and/or `card-effects.json`.
2. Run `npm run game:generate`.
3. Run `npm test`.
4. Commit canonical source changes and regenerated runtime artifacts.

For card behavior changes, update the structured effect registry alongside printed rules text whenever the printed mechanic changes. Do not add new regex parsing rules as the long-term implementation for new card mechanics.

Do not edit files listed in `sourcePolicy.generatedFiles` directly.
