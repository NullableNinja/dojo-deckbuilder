# Dojo Deckbuilder canonical game source

`content/dojo-game.json` is the migration target for the single authoritative definition of Dojo Deckbuilder.

## Source-of-truth policy

1. Human-authored mechanical rules belong in `content/dojo-game.json`.
2. Files listed under `sourcePolicy.generatedFiles` are generated artifacts and must not be hand-edited.
3. `app/data/rules.json` and `app/data/cards.json` are still legacy authoritative sources during the migration. They are explicitly listed under `legacySourcesPendingMigration` so the repository never pretends the migration is complete before it is.
4. `npm run game:generate` regenerates derived game data from the canonical source.
5. `npm run game:check` fails when generated data drifts from its source or when core catalog invariants break.

## Migration plan

### Stage 1 — mechanical definition

Move engine constants and global game behavior into `content/dojo-game.json`. `app/data/game-definition.json` becomes generated-only.

### Stage 2 — rules content

Move rule chapters, glossary entries, rulings, house rules, belt definitions, and quick-reference material into the canonical source. Generate `app/data/rules.json` from that source. Website rule views must render generated data rather than maintain separate prose.

### Stage 3 — card catalog and executable effects

Move card identity, printed fields, rules text inputs, flavor text, stats, tags, and structured executable effects into the canonical source. Generate `app/data/cards.json`. The playtest must execute structured effects rather than infer game behavior from English prose.

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

## Current migration status

The first migration slice establishes `content/dojo-game.json` as the authority for `app/data/game-definition.json`. `rules.json` and `cards.json` remain explicitly marked as pending migration rather than silently acting as additional sources of truth.
