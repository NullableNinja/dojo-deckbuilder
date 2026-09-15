# Dojo Deckbuilder

The official interactive companion and Quick Duel field test for **Dojo Deckbuilder**.

## Live site

<https://nullableninja.github.io/dojo-deckbuilder/>

## Source of truth

Game content is authored under `content/`.

- `content/dojo-game.json` — executable game definition and global configuration
- `content/rules.json` — rules and rulings content
- `content/cards.json` — canonical printed card catalog
- `content/effects.json` — reusable structured-effect vocabulary
- `content/card-effects/*.json` — executable card behavior by family
- `content/card-effects.json` — generated aggregate; do not hand-edit

`app/data/` is generated application data. It is a consumer of canonical content, not an authoring surface. Run `npm run game:generate` after canonical edits and commit the generated result.

## Local development

Requires Node.js 22.12 or newer.

```bash
npm ci
npm run dev
```

Useful commands:

```bash
npm run verify          # canonical generation/check + runtime tests + production build
npm run game:generate   # regenerate application data from content/
npm run engine:local    # two-player terminal engine
npm run engine:ai       # human vs. bot terminal engine
npm run simulate -- 10000
```

Simulation output is local/generated analysis under `reports/` and is intentionally not committed.

## Architecture

The maintenance rule is simple:

> **Canonical JSON defines the game. Runtime code executes it. React orchestrates it. CSS presents it.**

Do not add a mechanic to React or CSS when it belongs in canonical content or a reusable resolver. Compatibility fallbacks may still exist while older printed effects finish migrating; new mechanics should not extend those fallbacks.

See `docs/ENGINE-ARCHITECTURE.md` for the executable-data boundary.

## Project structure

- `content/` — canonical rules, cards, effects, schemas, and structured card behavior
- `engine/` — deterministic terminal/simulation engine
- `app/` — React companion, Quick Duel orchestration, shared runtime hosts, and generated `app/data/`
- `src/` — Vite entry point and Playtest event/VFX infrastructure
- `tests/` — small permanent architecture/runtime behavior gate
- `scripts/` — canonical generation/validation and production-card tooling
- `public/` — static web/PWA/download assets

Quick Duel presentation is intentionally consolidated into `app/globals.css`, `app/card-inspector.css`, and `app/playtest.css`; do not reintroduce one-off patch stylesheets.

## Deployment

`.github/workflows/deploy-pages.yml` runs the same `npm run verify` gate for pull requests and `main`, then deploys successful `main` builds to GitHub Pages.
