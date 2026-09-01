# Dojo Deckbuilder Engine Architecture

## Contract

`app/data/game-definition.json` is the executable global-rules contract. It points at the same v2.3 rules record used by the website and declares setup, turn limits, formulas, Defense Practice, Controlled Refill, Quick Duel HP, progression, and victory limits as data. `app/data/cards.json` supplies all card identity, costs, printed Focus, stats, types, and text. `engine/rules-loader.mjs` refuses to start when those versions disagree.

The engine code implements stable verbs—draw, play, defend, attack, buy, refill, discard—while their numbers and permitted decks come from the definition. Routine rule-number changes therefore require data edits, not engine edits. A new kind of verb still requires a schema/engine extension; prose is never executed with `eval`.

## Modes

- `npm run engine:local`: two humans share one terminal. Each chooses Defense Practice, Attacks, Defenses, and purchases.
- `npm run engine:ai`: one human uses the same prompts against the balanced heuristic bot.
- `npm run simulate -- 10000`: deterministic bot games across balanced, aggression, economy, and fortress strategies.

The bot scores legal cards from printed Attack Power, Guard, Focus, price, and draw text. It never receives hidden information and calls the same game operations as the CLI.

## Simulation output

The JSON report includes strategy and matchup win rates, average rounds/turns, opening-purchase rate, the number of players still unable to buy in round one, average purchases, and per-card purchase rate, play rate, and winner association. The seed equals the game index, making any outlier reproducible.

## Coverage boundary

The v1 engine fully drives Quick Duel's starter deck, basic combat, Focus, Defense Practice, Market purchases, Controlled Refill, Hide, KO victory, and round limits. It models all catalog cards through structured printed values. Unique prose effects, Combos, Locations, Belt task evaluation, multiplayer tagging, and Boss automation remain explicit future DSL modules; they are not silently guessed or `eval`uated.

The checked-in 10,000-game report therefore serves two purposes: it measures the implemented economy loop, and its 89.0% round-limit rate quantifies the urgency of the next special-effect/finisher module. Strategy win rates should not be treated as card-balance conclusions until that coverage exists.
