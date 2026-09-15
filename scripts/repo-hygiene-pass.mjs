import { readFile, writeFile, rm, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFile(join(root, path), "utf8");
const write = (path, content) => writeFile(join(root, path), content.endsWith("\n") ? content : `${content}\n`, "utf8");
const remove = (path) => rm(join(root, path), { force: true });

// 1. Make simulation reports follow canonical rules metadata instead of a frozen release label.
await write("engine/simulate.mjs", `import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { loadGameData } from "./rules-loader.mjs";
import { Game } from "./core.mjs";
import { STRATEGIES } from "./bots.mjs";

const count = Math.max(1, Number.parseInt(process.argv[2] ?? "1000", 10));
const data = await loadGameData();
const rulesVersion = String(data.definition.rulesVersion ?? "current").replace(/[^A-Za-z0-9._-]+/g, "-");
const output = process.argv[3] ?? \`reports/simulation-\${rulesVersion}.json\`;

const baseline = { ...data, definition: structuredClone(data.definition) };
baseline.definition.economy.defensePractice.usesPerTurn = 0;

const summary = {
  rulesVersion: data.definition.rulesVersion,
  games: count,
  generatedAt: new Date().toISOString(),
  strategies: {},
  matchups: {},
  rounds: { sum: 0, average: 0, min: Infinity, max: 0, roundLimitGames: 0 },
  turns: { sum: 0, average: 0 },
  economy: {
    openingPurchasePlayers: 0,
    openingPurchaseRate: 0,
    turnOneParalysisPlayers: 0,
    withoutDefensePracticeOpeningPurchasePlayers: 0,
    withoutDefensePracticeOpeningPurchaseRate: 0,
    defensePracticeLift: 0,
    averagePurchases: 0,
    totalPurchases: 0,
  },
  cards: {},
};

for (let index = 0; index < count; index += 1) {
  const firstStrategy = STRATEGIES[index % STRATEGIES.length];
  const secondStrategy = STRATEGIES[Math.floor(index / STRATEGIES.length) % STRATEGIES.length];
  const result = new Game(data, { seed: index + 1, strategies: [firstStrategy, secondStrategy] }).run();
  const baselineResult = new Game(baseline, { seed: index + 1, strategies: [firstStrategy, secondStrategy] }).run();

  summary.economy.withoutDefensePracticeOpeningPurchasePlayers += baselineResult.players.filter((player) => player.openingPurchase).length;
  const winningStrategy = result.players[result.winner].strategy;
  const matchupKey = \`\${firstStrategy} vs \${secondStrategy}\`;
  const matchup = (summary.matchups[matchupKey] ??= { games: 0, wins: {} });
  matchup.games += 1;
  matchup.wins[winningStrategy] = (matchup.wins[winningStrategy] ?? 0) + 1;

  for (const player of result.players) {
    const strategy = (summary.strategies[player.strategy] ??= { games: 0, wins: 0, winRate: 0 });
    strategy.games += 1;
    if (player.id === result.winner) strategy.wins += 1;
    summary.economy.totalPurchases += player.purchases;
    if (player.openingPurchase) summary.economy.openingPurchasePlayers += 1;
    else summary.economy.turnOneParalysisPlayers += 1;
  }

  summary.rounds.sum += result.rounds;
  summary.rounds.min = Math.min(summary.rounds.min, result.rounds);
  summary.rounds.max = Math.max(summary.rounds.max, result.rounds);
  if (result.reason === "round-limit") summary.rounds.roundLimitGames += 1;
  summary.turns.sum += result.turns;

  for (const card of result.cards) {
    const cardSummary = (summary.cards[card.id] ??= { name: card.name, purchased: 0, played: 0, winnerGames: 0 });
    cardSummary.purchased += card.purchased;
    cardSummary.played += card.played;
    cardSummary.winnerGames += card.winnerOwned;
  }
}

for (const strategy of Object.values(summary.strategies)) strategy.winRate = +(strategy.wins / strategy.games).toFixed(4);
summary.rounds.average = +(summary.rounds.sum / count).toFixed(2);
summary.turns.average = +(summary.turns.sum / count).toFixed(2);
summary.economy.openingPurchaseRate = +(summary.economy.openingPurchasePlayers / (count * 2)).toFixed(4);
summary.economy.withoutDefensePracticeOpeningPurchaseRate = +(summary.economy.withoutDefensePracticeOpeningPurchasePlayers / (count * 2)).toFixed(4);
summary.economy.defensePracticeLift = +(summary.economy.openingPurchaseRate - summary.economy.withoutDefensePracticeOpeningPurchaseRate).toFixed(4);
summary.economy.averagePurchases = +(summary.economy.totalPurchases / (count * 2)).toFixed(2);
for (const card of Object.values(summary.cards)) {
  card.playRate = +(card.played / count).toFixed(4);
  card.purchaseRate = +(card.purchased / count).toFixed(4);
  card.winCorrelation = card.purchased ? +(card.winnerGames / card.purchased).toFixed(4) : 0;
}

await mkdir(dirname(output), { recursive: true });
await writeFile(output, \`\${JSON.stringify(summary, null, 2)}\\n\`);
const markdown = output.replace(/\\.json$/, ".md");
const strategyRows = Object.entries(summary.strategies)
  .map(([name, strategy]) => \`| \${name} | \${strategy.games} | \${strategy.wins} | \${(strategy.winRate * 100).toFixed(1)}% |\`)
  .join("\\n");
await writeFile(markdown, \`# Dojo Deckbuilder \${data.definition.rulesVersion} Simulation

\${count.toLocaleString()} deterministic Quick Duel bot games.

| Metric | Result |
|---|---:|
| Average rounds | \${summary.rounds.average} |
| Round-limit games | \${summary.rounds.roundLimitGames} |
| Opening purchase rate | \${(summary.economy.openingPurchaseRate * 100).toFixed(1)}% |
| Without Defense Practice | \${(summary.economy.withoutDefensePracticeOpeningPurchaseRate * 100).toFixed(1)}% |
| Defense Practice lift | \${(summary.economy.defensePracticeLift * 100).toFixed(1)} points |
| Average purchases per player | \${summary.economy.averagePurchases} |

## Strategy results

| Strategy | Seats | Wins | Win rate |
|---|---:|---:|---:|
\${strategyRows}

The JSON file contains matchup splits and per-card play, purchase, and winner-association statistics.
\`);

console.log(JSON.stringify({
  games: count,
  rulesVersion: data.definition.rulesVersion,
  averageRounds: summary.rounds.average,
  roundLimitGames: summary.rounds.roundLimitGames,
  openingPurchaseRate: summary.economy.openingPurchaseRate,
  withoutDefensePractice: summary.economy.withoutDefensePracticeOpeningPurchaseRate,
  defensePracticeLift: summary.economy.defensePracticeLift,
  output,
  markdown,
}, null, 2));
`);

// 2. Remove checked-in generated reports and keep future simulation/audit outputs local.
await remove("reports/card-effect-audit.json");
const gitignore = await read(".gitignore");
if (!gitignore.includes("# generated analysis reports")) {
  await write(".gitignore", `${gitignore.trimEnd()}\n\n# generated analysis reports\n/reports/*.json\n/reports/*.md\n`);
}

// 3-4. Remove inert public CSS patches that are outside the consolidated application cascade.
await remove("public/playtest-critical-hotfix.css");
await remove("public/search-dashboard-layout-fix.css");

// 5. Remove completed Phase 1-3 migration/audit paperwork.
for (const path of [
  "docs/PHASE1-COMPREHENSION.md",
  "docs/PHASE2-MECHANICAL-AUDIT.md",
  "docs/PHASE3-CARD-CHANGES.json",
  "docs/PHASE3-CHANGELOG.md",
  "docs/PHASE3-RULE-CHANGES.json",
]) await remove(path);

// 6. Remove superseded version-overhaul plans.
for (const path of ["docs/V2.0-ALPHA-REVERSAL.md", "docs/V2.0-OVERHAUL-PLAN.md"]) await remove(path);

// 7. Remove completed Playtest recovery/design ledgers that describe retired branches and CSS layers.
for (const path of ["docs/PLAYTEST-PRODUCTION-MAT.md", "docs/PLAYTEST-UI-RECOVERY.md"]) await remove(path);

// 8. Remove completed repository/site maintenance ledgers.
for (const path of ["docs/REPOSITORY-CLEANUP-LEDGER.md", "docs/site-audit-and-expansion-40.md"]) await remove(path);

// 9. Replace stale top-level architecture docs with the current source-of-truth contract.
await write("README.md", `# Dojo Deckbuilder

The official interactive companion and Quick Duel field test for **Dojo Deckbuilder**.

## Live site

<https://nullableninja.github.io/dojo-deckbuilder/>

## Source of truth

Game content is authored under \`content/\`.

- \`content/dojo-game.json\` — executable game definition and global configuration
- \`content/rules.json\` — rules and rulings content
- \`content/cards.json\` — canonical printed card catalog
- \`content/effects.json\` — reusable structured-effect vocabulary
- \`content/card-effects/*.json\` — executable card behavior by family
- \`content/card-effects.json\` — generated aggregate; do not hand-edit

\`app/data/\` is generated application data. It is a consumer of canonical content, not an authoring surface. Run \`npm run game:generate\` after canonical edits and commit the generated result.

## Local development

Requires Node.js 22.12 or newer.

\`\`\`bash
npm ci
npm run dev
\`\`\`

Useful commands:

\`\`\`bash
npm run verify          # canonical generation/check + runtime tests + production build
npm run game:generate   # regenerate application data from content/
npm run engine:local    # two-player terminal engine
npm run engine:ai       # human vs. bot terminal engine
npm run simulate -- 10000
\`\`\`

Simulation output is local/generated analysis under \`reports/\` and is intentionally not committed.

## Architecture

The maintenance rule is simple:

> **Canonical JSON defines the game. Runtime code executes it. React orchestrates it. CSS presents it.**

Do not add a mechanic to React or CSS when it belongs in canonical content or a reusable resolver. Compatibility fallbacks may still exist while older printed effects finish migrating; new mechanics should not extend those fallbacks.

See \`docs/ENGINE-ARCHITECTURE.md\` for the executable-data boundary.

## Project structure

- \`content/\` — canonical rules, cards, effects, schemas, and structured card behavior
- \`engine/\` — deterministic terminal/simulation engine
- \`app/\` — React companion, Quick Duel orchestration, shared runtime hosts, and generated \`app/data/\`
- \`src/\` — Vite entry point and Playtest event/VFX infrastructure
- \`tests/\` — small permanent architecture/runtime behavior gate
- \`scripts/\` — canonical generation/validation and production-card tooling
- \`public/\` — static web/PWA/download assets

Quick Duel presentation is intentionally consolidated into \`app/globals.css\`, \`app/card-inspector.css\`, and \`app/playtest.css\`; do not reintroduce one-off patch stylesheets.

## Deployment

\`.github/workflows/deploy-pages.yml\` runs the same \`npm run verify\` gate for pull requests and \`main\`, then deploys successful \`main\` builds to GitHub Pages.
`);

await write("docs/ENGINE-ARCHITECTURE.md", `# Dojo Deckbuilder Engine Architecture

## Authority boundary

The authoritative game model lives in \`content/\`.

1. \`content/dojo-game.json\` defines global executable configuration.
2. \`content/rules.json\` and \`content/cards.json\` define rules text and printed card identity.
3. \`content/effects.json\` defines reusable structured-effect vocabulary.
4. \`content/card-effects/*.json\` assigns structured behavior to cards.
5. \`scripts/generate-game-data.mjs\` validates those sources and generates \`content/card-effects.json\` plus \`app/data/*\`.

Generated files are checked for drift by \`npm run verify\`. Application code must consume generated data rather than inventing parallel rules.

## Runtime layers

### Deterministic engine

\`engine/\` provides the compact terminal/simulation implementation. Stable operations such as draw, attack, defend, buy, refill, discard, and progression consume the generated game definition instead of duplicating configurable rule values.

### Structured effects

\`content/effects.json\` is the shared vocabulary. Family registries under \`content/card-effects/\` reference that vocabulary and may attach dedicated resolver names when generic actions are insufficient. \`scripts/card-effect-registry.mjs\` hydrates and validates those registries into one deterministic aggregate.

Family discovery is data-driven: adding a new family source file does not require editing a filename allow-list in the generator. The family declared by the registry is validated against the canonical cards it contains.

### Quick Duel host

The Quick Duel runtime and host adapters execute structured lifecycle/combat behavior and preserve match state across React transitions. \`app/playtest.tsx\` is an orchestration/presentation shell, not a rules database. Historical compatibility helpers that remain there are migration debt; do not add new mechanics to them.

## Generated-data flow

\`\`\`text
content/dojo-game.json ─┐
content/rules.json      ├─> scripts/generate-game-data.mjs ─> app/data/*
content/cards.json      ┤                               └─> content/card-effects.json
content/effects.json    ┤
content/card-effects/* ─┘
\`\`\`

The website, Card Library, Quick Duel, terminal engine, and tests should consume this pipeline rather than maintain independent copies.

## Verification

\`npm run verify\` is the permanent repository gate. It:

1. regenerates canonical derived data;
2. validates canonical/generated consistency;
3. fails on generated-data drift;
4. runs the small permanent runtime/architecture suite;
5. type-checks and builds the production site;
6. verifies the Card Inspector is present in the production bundle.

Permanent tests protect generic behavior and architecture. They should select fixtures by canonical properties/structured effects rather than freezing individual Catalog IDs unless a test is intentionally about that specific card.

## Simulation

\`npm run simulate -- <games> [output.json]\` runs deterministic bot matches. The default output filename and report heading derive from the current canonical rules version. Reports are generated analysis and are ignored by Git.

## Presentation boundary

React owns user interaction and state orchestration. The Playtest CSS cascade is consolidated into three application stylesheets:

- \`app/globals.css\`
- \`app/card-inspector.css\`
- \`app/playtest.css\`

Do not create late hotfix stylesheets in \`public/\` or new \`playtest-*-fix.css\` layers. Correct the owning section in the consolidated stylesheet.

## Remaining migration boundary

Structured effects are the intended long-term execution path. Some older printed-text/name/identity compatibility fallbacks may still be live while migration completes. They must remain explicit and auditable, and they should shrink as canonical structured resolvers replace them.
`);

// 10a. Make effect-family discovery data-driven instead of maintaining a filename map.
let registry = await read("scripts/card-effect-registry.mjs");
registry = registry.replace(/const FAMILY_BY_FILE = new Map\(\[[\s\S]*?\]\);\n\n/, "");
registry = registry.replace(
`    const expectedFamily = FAMILY_BY_FILE.get(file);
    assert(expectedFamily, \`Unknown card-effect family filename '\${file}'. Add it to FAMILY_BY_FILE before authoring it.\`);
    assert(registry.schemaVersion === 1, \`content/card-effects/\${file} schemaVersion must be 1.\`);
    assert(registry.rulesVersion === source.rulesVersion, \`content/card-effects/\${file} rulesVersion does not match canonical rulesVersion.\`);
    assert(registry.rulesRevision === source.rulesRevision, \`content/card-effects/\${file} rulesRevision does not match canonical rulesRevision.\`);
    assert(registry.family === expectedFamily, \`content/card-effects/\${file} declares family '\${registry.family}', expected '\${expectedFamily}'.\`);
    assert(registry.cards && typeof registry.cards === "object", \`content/card-effects/\${file} is missing cards.\`);
    families.push({ file, family: expectedFamily, registry });`,
`    const family = String(registry.family ?? "").trim();
    assert(registry.schemaVersion === 1, \`content/card-effects/\${file} schemaVersion must be 1.\`);
    assert(registry.rulesVersion === source.rulesVersion, \`content/card-effects/\${file} rulesVersion does not match canonical rulesVersion.\`);
    assert(registry.rulesRevision === source.rulesRevision, \`content/card-effects/\${file} rulesRevision does not match canonical rulesRevision.\`);
    assert(family, \`content/card-effects/\${file} must declare a family.\`);
    assert(registry.cards && typeof registry.cards === "object", \`content/card-effects/\${file} is missing cards.\`);
    families.push({ file, family, registry });`);
registry = registry.replace(
  "Canonical structured-effect migration registry. Entries are keyed by Catalog ID so executable behavior can migrate independently of the large printed-card catalog without changing printed card identity.",
  "Canonical structured-effect registry. Entries are keyed by Catalog ID so executable behavior remains separate from printed card identity while sharing one validated runtime vocabulary.",
);
if (registry.includes("FAMILY_BY_FILE")) throw new Error("card-effect registry still contains the hard-coded family filename map");
await write("scripts/card-effect-registry.mjs", registry);

// 10b. Keep permanent engine tests generic by selecting canonical fixtures by properties.
await write("tests/engine.test.mjs", `import assert from "node:assert/strict";
import test from "node:test";
import { loadGameData } from "../engine/rules-loader.mjs";
import { Game } from "../engine/core.mjs";

const starterCards = (data) => data.definition.starterDeck
  .map((entry) => data.byId.get(entry.catalogId))
  .filter(Boolean);
const starterAttacks = (data) => starterCards(data).filter((card) => Number(card.stats?.["Attack Power"]) > 0);
const starterDefenses = (data) => starterCards(data).filter((card) => Number(card.stats?.Guard) > 0);

test("engine loads canonical game data without hard-coded inventory assumptions", async () => {
  const data = await loadGameData();
  assert.ok(data.definition, "canonical game definition must load");
  assert.ok(data.definition.rulesVersion, "canonical game definition must identify its rules version");
  assert.ok(Array.isArray(data.cards) && data.cards.length > 0, "canonical card catalog must load");
  assert.ok(data.byId instanceof Map && data.byId.size > 0, "canonical card lookup must be populated");
  assert.ok(data.definition.economy, "canonical economy rules must load");
});

test("seeded games are deterministic and terminate legally", async () => {
  const data = await loadGameData();
  const first = new Game(data, { seed: 42, strategies: ["economy", "aggression"] }).run();
  const second = new Game(data, { seed: 42, strategies: ["economy", "aggression"] }).run();
  assert.deepEqual(first, second);
  assert.ok(first.winner === 0 || first.winner === 1);
  assert.ok(first.rounds <= data.definition.mode.maxRounds + 1);
});

test("Defense Practice grants printed Focus without changing HP", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 3 });
  const player = game.players[0];
  const defense = player.hand.find((card) => Number(card.stats?.Guard) > 0) ?? starterDefenses(data)[0];
  assert.ok(defense, "canonical Starter deck must contain a Defense card");
  if (!player.hand.includes(defense)) player.hand.push(defense);
  const hp = player.hp;
  assert.equal(game.practice(player, defense), true);
  assert.equal(player.focus, Number(defense.focusValue));
  assert.equal(player.hp, hp);
});

test("played Defense is consumed and cannot block a second Attack", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 9 });
  const attacker = game.players[0];
  const defender = game.players[1];
  const attacks = starterAttacks(data).slice(0, 2);
  const defense = starterDefenses(data)[0];
  assert.equal(attacks.length, 2, "canonical Starter deck must contain at least two Attacks");
  assert.ok(defense, "canonical Starter deck must contain a Defense");
  attacker.hand.push(...attacks);
  defender.hand.push(defense);
  const beforeFocus = defender.focus;
  const first = game.resolveAttack(attacker, defender, attacks[0], { defenseCard: defense });
  const second = game.resolveAttack(attacker, defender, attacks[1], { defenseCard: null });
  assert.equal(defender.focus, beforeFocus + Number(defense.focusValue));
  assert.equal(first.defense, defense);
  assert.equal(second.defense, null);
  assert.ok(defender.discard.includes(defense));
  assert.ok(!defender.played.includes(defense));
});

test("Market purchase spends only the printed cost and refills one slot", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 13 });
  const player = game.players[0];
  const bought = game.market.find((card) => Number.parseInt(String(card.fpCost), 10) <= 4) ?? game.market[0];
  assert.ok(bought, "market must contain a purchasable card");
  const price = Number.parseInt(String(bought.fpCost), 10) || 0;
  player.focus = price + 3;
  const beforeDeck = game.marketDeck.length;
  assert.equal(game.buy(player, bought), true);
  assert.equal(player.focus, 3);
  assert.equal(game.market.length, data.definition.economy.market.rowSize);
  assert.equal(game.marketDeck.length, beforeDeck - 1);
  assert.equal(game.marketPurchasedThisRound, true);
  assert.ok(player.discard.includes(bought));
});

test("a turn may play every legal Attack in hand", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 21 });
  const player = game.players[0];
  const defender = game.players[1];
  const attacks = starterAttacks(data).slice(0, 3);
  assert.equal(attacks.length, 3, "canonical Starter deck must contain at least three Attacks");
  player.hand = [...attacks];
  player.deck = [];
  player.discard = [];
  defender.hp = 100;
  game.botTurn(0);
  assert.equal(game.events.filter((event) => event.type === "attack" && event.attacker === 0).length, attacks.length);
});
`);

// 10c. Runtime integration tests find representative canonical effects by behavior, not Catalog ID.
await write("tests/rules-json-runtime.test.mjs", `import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyQuickDuelPlaytestTransition,
  prepareQuickDuelPlaytestAttack,
  publishQuickDuelPlaytestLifecycleEvent,
  resolveQuickDuelPlaytestCharacterChoice,
} from "../app/quick-duel-playtest-host.ts";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const cards = (await readJson("../content/cards.json")).cards ?? [];
const comboEffects = (await readJson("../content/card-effects/combos.json")).cards ?? {};
const characterEffects = (await readJson("../content/card-effects/characters.json")).cards ?? {};
const byCatalogId = new Map(cards.map((card) => [card.catalogId, card]));
const byId = new Map(cards.map((card) => [card.id, card]));
const attack = (id, zone = "Mid") => ({ id, name: id, cardType: "Technique", subtype: "Attack", tags: [], zone });
const kata = (id) => ({ id, name: id, cardType: "Technique", subtype: "Kata", tags: [] });

function board(overrides = {}) {
  return {
    fighterId: "fighter",
    belt: 3,
    hp: 10,
    maxHp: 10,
    xp: 0,
    focus: 0,
    tempSpeed: 0,
    nextAttackBonus: 0,
    nextDefenseCardBonus: 0,
    nextAttackHasFlow: false,
    nextAttackAnyZone: false,
    damageTaken: 0,
    hand: [],
    deck: [],
    discard: [],
    destroyed: [],
    equipment: [],
    exhaustedEquipment: [],
    cardsThisTurn: [],
    zonesPlayed: [],
    attacksThisTurn: 0,
    defendedThisRound: false,
    blockedThisRound: false,
    hitThisTurn: false,
    learnedCombos: [],
    triggeredCombos: [],
    cardsBought: 0,
    usedConsumableThisRound: false,
    wasHitSinceLastTurn: false,
    damageReductionUsed: false,
    reversalAttackBonus: 0,
    nextInitiateFocus: 0,
    borrowedEquipmentId: null,
    abilityUsedRound: false,
    usedCharacterEffectIdsThisTurn: [],
    usedCharacterEffectIdsThisRound: [],
    usedCharacterEffectIdsThisGame: [],
    characterMarks: {},
    stage3cStatuses: [],
    stage3cChoices: [],
    stage3cRestrictions: [],
    ...overrides,
  };
}

function match(player = board(), ai = board({ fighterId: "ai-fighter" }), overrides = {}) {
  return {
    schema: 8,
    player,
    ai,
    market: [],
    round: 1,
    phase: "player-yell",
    turnOrder: ["player", "ai"],
    turnIndex: 0,
    lastExchange: null,
    winner: null,
    log: ["preserve-me"],
    ...overrides,
  };
}

const lookupWith = (...extra) => {
  const lookup = new Map(byId);
  for (const card of extra) lookup.set(card.id, card);
  return (id) => lookup.get(id) ?? null;
};

const operations = {
  draw: (state, amount) => ({ ...state, drawn: (state.drawn ?? 0) + Math.max(0, amount) }),
};

test("canonical Combo effects execute through the Quick Duel host", () => {
  const candidates = Object.entries(comboEffects)
    .filter(([, entry]) => entry.effects?.some((effect) => effect.effect === "combat.piercing" && effect.amount === 2 && effect.trigger === "onAttackDeclared"))
    .map(([catalogId]) => byCatalogId.get(catalogId))
    .filter(Boolean);
  assert.ok(candidates.length, "canonical structured effects must contain a piercing Combo fixture");

  const form = kata("form");
  const strike = attack("strike", "Mid");
  let executed = null;
  for (const combo of candidates) {
    const current = match(board({ learnedCombos: [combo.id], cardsThisTurn: [form.id] }));
    const prepared = prepareQuickDuelPlaytestAttack(current, "player", strike, "Mid", lookupWith(form, strike), operations);
    if (prepared.attackFacts.piercing === 2 && prepared.match.player.triggeredCombos.includes(combo.id)) {
      executed = { combo, prepared };
      break;
    }
  }
  assert.ok(executed, "a canonical piercing Combo must execute through the host for the representative Kata → Attack sequence");
  assert.equal(executed.prepared.match.ai.triggeredCombos.length, 0);
});

test("structured lifecycle effects mutate the acting board only", () => {
  const deferred = {
    sourceEffectId: "deferred-focus",
    effect: "core.gainFocus",
    target: "self",
    amount: 2,
    duration: "nextInitiate",
    qualifier: { activateAt: "nextInitiate" },
    appliedImmediately: false,
  };
  const current = match(board({ focus: 1 }), board({ fighterId: "ai-fighter", focus: 0, stage3cStatuses: [deferred] }), {
    phase: "ai-ready",
    turnIndex: 1,
  });
  const published = publishQuickDuelPlaytestLifecycleEvent(current, "ai", "onInitiate", operations, lookupWith());
  assert.equal(published.match.ai.focus, 2);
  assert.equal(published.match.player.focus, 1);
  assert.equal(published.match.ai.stage3cStatuses.length, 0);
});

test("canonical Character choices cross the Quick Duel host and resume through structured selection", () => {
  const borrowerCatalogId = Object.entries(characterEffects).find(([, entry]) =>
    entry.effects?.some((effect) => effect.resolver === "character.equipDiscardPermanentUntilHide"))?.[0];
  assert.ok(borrowerCatalogId, "canonical structured effects must contain the temporary discard-equipment Character resolver");
  const permanent = cards.find((card) => ["Weapon", "Defense Equipment", "Gear"].includes(card.subtype));
  assert.ok(permanent, "canonical catalog must contain permanent Equipment");
  const opponent = cards.find((card) => card.cardType === "Character" && card.catalogId !== borrowerCatalogId);
  const current = match(
    board({ fighterId: borrowerCatalogId, discard: [permanent.id] }),
    board({ fighterId: opponent?.catalogId ?? "ai-fighter" }),
    { phase: "player-initiate", turnIndex: 0 },
  );
  const offered = publishQuickDuelPlaytestLifecycleEvent(current, "player", "onInitiate", operations, lookupWith());
  assert.equal(offered.characterPublished, true);
  assert.equal(offered.characterConflict, false);
  assert.equal(offered.characterChoices.length, 1);
  const resolved = resolveQuickDuelPlaytestCharacterChoice(
    offered.match,
    "player",
    offered.characterEvent,
    offered.characterChoices[0],
    permanent.id,
  );
  assert.equal(resolved.match.player.borrowedEquipmentId, permanent.id);
  assert.ok(resolved.match.player.equipment.includes(permanent.id));
  const hidden = publishQuickDuelPlaytestLifecycleEvent(resolved.match, "player", "onHide", operations, lookupWith());
  assert.equal(hidden.match.player.borrowedEquipmentId, null);
  assert.ok(!hidden.match.player.equipment.includes(permanent.id));
  assert.ok(hidden.match.player.discard.includes(permanent.id));
});

test("Quick Duel transition adapter preserves unrelated match state", () => {
  const form = kata("form-played");
  const previous = match(board({ hand: [form.id] }));
  const next = {
    ...previous,
    player: { ...previous.player, hand: [], cardsThisTurn: [form.id] },
    selectedZone: "Low",
    pendingStrike: null,
  };
  const hosted = applyQuickDuelPlaytestTransition(previous, next, lookupWith(form));
  assert.equal(hosted.selectedZone, "Low");
  assert.equal(hosted.pendingStrike, null);
  assert.deepEqual(hosted.log, ["preserve-me"]);
});
`);

// Safety checks for the ten-item pass.
const forbiddenFiles = [
  "reports/card-effect-audit.json",
  "public/playtest-critical-hotfix.css",
  "public/search-dashboard-layout-fix.css",
  "docs/PHASE1-COMPREHENSION.md",
  "docs/V2.0-OVERHAUL-PLAN.md",
  "docs/PLAYTEST-UI-RECOVERY.md",
  "docs/REPOSITORY-CLEANUP-LEDGER.md",
];
const rootEntries = new Set(await readdir(root));
for (const path of forbiddenFiles) {
  try { await read(path); throw new Error(`${path} should have been removed`); } catch (error) { if (error.code !== "ENOENT") throw error; }
}
if ((await read("engine/simulate.mjs")).includes("simulation-v2.3")) throw new Error("simulator still hard-codes v2.3 output");
if (/DDB-(?:STA|CMB|CHR)-CORE-\d+/.test(await read("tests/engine.test.mjs"))) throw new Error("engine tests still pin specific canonical fixture IDs");
if (/DDB-(?:STA|CMB|CHR)-CORE-\d+/.test(await read("tests/rules-json-runtime.test.mjs"))) throw new Error("runtime tests still pin specific canonical fixture IDs");
console.log("Applied ten meaningful repository hygiene cleanups.");
