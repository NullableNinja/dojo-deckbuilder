# Dojo Deckbuilder

The official interactive companion for **Dojo Deckbuilder**: Quick Start, full rules, card library, rulings and errata, glossary, backstory, and house rules.

## Live site

After GitHub Pages is enabled for this repository, the site is published at:

<https://nullableninja.github.io/dojo-deckbuilder/>

## Run locally

Install [Node.js 22](https://nodejs.org/), then open a terminal in this repository and run:

```bash
npm install
npm run dev
```

Open the local address printed by Vite. Stop the local server with `Ctrl+C`.

## Production build

```bash
npm run build
```

The deployable static website is written to `dist/`, including a real `dist/index.html`.

## Play and simulate the rules engine

The engine uses the canonical `app/data/game-definition.json`, `rules.json`, and `cards.json` files. No installation beyond Node.js is required.

```bash
npm run engine:local       # two-player pass-and-play
npm run engine:ai          # human vs. balanced bot
npm run simulate -- 10000  # headless batch; writes reports/simulation-v2.3.json
```

See `docs/ENGINE-ARCHITECTURE.md` for the rules-as-data contract, supported rule coverage, and extension boundary.

## GitHub Pages deployment

`.github/workflows/deploy-pages.yml` automatically builds and publishes the site whenever `main` changes. In GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions** once. Future pushes to `main` deploy automatically.

## Project structure

- `app/companion-app.tsx` — interactive site interface
- `app/globals.css` — Paper-Fu visual system and responsive layout
- `app/data/` — searchable cards and rules data
- `app/assets/` — site artwork and character images
- `src/main.tsx` — static React entry point
- `index.html` — Vite document entry point
