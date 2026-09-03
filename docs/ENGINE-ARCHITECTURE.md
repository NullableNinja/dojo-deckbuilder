# Dojo Deckbuilder Engine Architecture

## Contract

`app/data/game-definition.json` is the executable global-rules contract. It points at the same v2.3 rules record used by the website and declares setup, turn limits, formulas, Defense Practice, Controlled Refill, Quick Duel HP, progression, and victory limits as data. `app/data/cards.json` supplies all card identity, costs, printed Focus, stats, types, and text. `engine/rules-loader.mjs` refuses to start when those versions disagree.

The React playtest now derives its starter deck, hand size, Market size, starting HP, and Belt table from those same records. `public/rules-manifest.json` is a stable cache-busted update signal. An open page checks it once per minute. A match pins its starting rules version until the duel ends; if a new deployment appears, the UI offers a reload instead of silently changing legal moves halfway through combat.

The engine code implements stable verbs—draw, play, defend, attack, buy, refill, discard—while their numbers and permitted decks come from the definition. Routine rule-number changes therefore require data edits, not engine edits. A new kind of verb still requires a schema/engine extension; prose is never executed with `eval`.

## Modes

- `npm run engine:local`: two humans share one terminal. Each chooses Defense Practice, Attacks, Defenses, and purchases.
- `npm run engine:ai`: one human uses the same prompts against the balanced heuristic bot.
- `npm run simulate -- 10000`: deterministic bot games across balanced, aggression, economy, and fortress strategies.

The bot scores legal cards from printed Attack Power, Guard, Focus, price, and draw text. It never receives hidden information and calls the same game operations as the CLI.

## Simulation output

The JSON report includes strategy and matchup win rates, average rounds/turns, opening-purchase rate, the number of players still unable to buy in round one, average purchases, and per-card purchase rate, play rate, and winner association. The seed equals the game index, making any outlier reproducible.

The setup screen also exposes a browser-worker batch lab capped at 1,000 games. It calls the same `Game` class off the UI thread and reports strategy win rate, average length, purchase rates, top picks, and round-by-round XP/Focus curves.

## Coverage boundary

The current engine fully drives Quick Duel's starter deck, basic combat, Focus, Defense Practice, Market purchases, Controlled Refill, Hide, KO victory, and round limits. The interactive playtest also implements a growing set of Locations, Combos, Reversals, Belt Exams, and fighter abilities. Unique prose effects are still partly recognized inside `app/playtest.tsx`; moving those resolvers into a declarative shared effect registry is the next required slice before the project can truthfully claim 100% printed-text enforcement. Unsupported text must remain visible and auditable; prose is never guessed or executed with `eval`.

The checked-in 10,000-game report therefore serves two purposes: it measures the implemented economy loop, and its 89.0% round-limit rate quantifies the urgency of the next special-effect/finisher module. Strategy win rates should not be treated as card-balance conclusions until that coverage exists.
