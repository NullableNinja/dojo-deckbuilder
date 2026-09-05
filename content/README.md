# Dojo Deckbuilder canonical game source

The `content/` directory is the canonical authoring layer for Dojo Deckbuilder. It is intentionally split into focused source files rather than one giant multi-megabyte document:

- `content/dojo-game.json` — mechanical definition, revision metadata, source policy, mode/economy/combat/progression configuration.
- `content/rules.json` — canonical human-facing rules content: chapters, glossary, rulings, house rules, belt table, and quick-reference prose.

Everything under `app/data/` that is listed in `sourcePolicy.generatedFiles` is a generated runtime artifact and must not be hand-edited.

## Source-of-truth policy

1. Human-authored global mechanics belong in `content/dojo-game.json`.
2. Human-authored rules prose belongs in `content/rules.json`.
3. `app/data/game-definition.json` and `app/data/rules.json` are generated-only runtime files.
4. `app/data/cards.json` remains the only legacy authoritative data source still pending migration.
5. `npm run game:generate` regenerates derived runtime game data from `content/`.
6. `npm run game:check` fails when generated data drifts from canonical source, when core catalog invariants break, or when retired r5 rules reappear.

## Current enforcement

The canonical-source checker now verifies:

- exact equality between `content/dojo-game.json`'s `definition` and `app/data/game-definition.json`;
- exact equality between `content/rules.json` and `app/data/rules.json`;
- matching v2.3 versions across canonical rules, generated rules, definition, and card catalog;
- unique card Catalog IDs and presence of every Starter Deck card;
- unique rule chapter IDs, section IDs, glossary terms, ruling IDs, and house-rule names;
- the full nine-rank Belt Table;
- required r5 rules including seven-card hands, unlimited legal Attacks, Flow draw, Market Mercy, and the Bad Habit Focus action;
- absence of retired two-Attack-limit and Controlled Refill rules.

Because `npm test` begins with `npm run game:check`, these invariants also gate GitHub Pages deployment.

## Migration plan

### Stage 1 — mechanical definition — COMPLETE

`content/dojo-game.json` is authoritative for `app/data/game-definition.json`.

### Stage 2 — rules content — COMPLETE

`content/rules.json` is authoritative for rule chapters, glossary entries, rulings, house rules, belt definitions, and quick-reference material. `app/data/rules.json` is generated-only. The website already renders the generated runtime rules file, so the online rulebook, glossary, rulings, and house-rule views now consume canonical rule content.

### Stage 3 — card catalog and executable effects — NEXT

Move card identity, printed fields, rules text inputs, flavor text, stats, tags, and structured executable effects into canonical source under `content/`. Generate `app/data/cards.json`. The playtest must execute structured effects rather than infer game behavior from English prose.

This stage should be incremental: first promote the existing catalog to canonical source without changing gameplay, then add structured effect definitions card family by card family while retaining compatibility until coverage reaches 100%.

### Stage 4 — downloadable publications

Generate Full Rules, Quick Start, Glossary, and Card Catalog downloads from the same canonical source. Download files stop being independently edited sources.

### Stage 5 — hard enforcement

CI must reject:

- direct drift in generated files;
- duplicate or missing Catalog IDs;
- references to nonexistent cards/rules/effects;
- unsupported executable card effects;
- engine constants that duplicate canonical mechanical values;
- mismatched rules revisions across the site, playtest, simulator, and publications.

## Editing workflow

For canonical rules changes:

1. Edit `content/dojo-game.json` and/or `content/rules.json`.
2. Run `npm run game:generate`.
3. Run `npm test`.
4. Commit both canonical source changes and regenerated runtime artifacts.

Do not edit `app/data/game-definition.json` or `app/data/rules.json` directly.
