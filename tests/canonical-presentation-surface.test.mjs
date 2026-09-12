import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readText = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await readText(path));

test("player-facing rules presentation is driven by canonical JSON", async () => {
  const [definition, companion, presentation] = await Promise.all([
    readJson("content/dojo-game.json"),
    readText("app/companion-app.tsx"),
    readText("app/canonical-presentation.ts"),
  ]);

  const black = definition.definition.progression.belts.find((belt) => belt.id === "black");
  assert.equal(black?.xp, 35, "Black Belt should remain the canonical 35-XP threshold");
  assert.equal(definition.definition.turn.handSize, 7, "the canonical opening/normal hand size should remain seven");

  assert.match(companion, /from "\.\/canonical-presentation"/);
  assert.match(companion, /const rulesData = CANONICAL_RULES/);
  assert.match(companion, /const setup = SETUP_STEPS/);
  assert.match(companion, /draw \{HAND_SIZE\}/);
  assert.match(companion, /CANONICAL_GAME_MODES\.map/);
  assert.match(companion, /CANONICAL_PHASES\.map/);
  assert.match(companion, /STARTER_EXAMPLES\.basicJab/);
  assert.match(companion, /STARTER_EXAMPLES\.highGuard/);
  assert.match(companion, /ROUND_STRUCTURE_SUMMARY/);
  assert.match(companion, /COMBAT_SEQUENCE\.map/);
  assert.match(companion, /COMBAT_FORMULA_TEXT/);
  assert.match(companion, /DEFENSE_WITHOUT_CARD_RULE/);
  assert.match(companion, /COMBAT_XP_RULE/);
  assert.match(companion, /RULE_PRIORITY\.map/);
  assert.match(companion, /TABLE_JUDGE_STEPS\.map/);
  assert.match(companion, /const RULES_REVISION_NOTES = CURRENT_RULE_HIGHLIGHTS/);

  assert.doesNotMatch(companion, /draw five/i);
  assert.doesNotMatch(companion, /Max HP increases and promotion healing/i);
  assert.doesNotMatch(companion, /full vitality reward from promotion/i);
  assert.doesNotMatch(companion, /Scenario or mode rules<\/li>/);
  assert.doesNotMatch(companion, /Pause for no more than two minutes\.<\/li>/);
  assert.doesNotMatch(companion, /Attack Power<\/b> = printed Attack Power/);

  assert.match(presentation, /BLACK_BELT_XP/);
  assert.match(presentation, /Reach 55 XP/g);
  assert.match(presentation, /Reach \$\{BLACK_BELT_XP\} XP/);
  assert.match(presentation, /Belt rewards do not change current or maximum HP/);
  assert.match(presentation, /COMBAT_XP_RULE/);
  assert.match(presentation, /CURRENT_RULE_HIGHLIGHTS/);
});

test("homepage immediately explains the product and first-game path", async () => {
  const companion = await readText("app/companion-app.tsx");
  assert.match(companion, /A martial-arts deckbuilder with fixed packs\./);
  assert.match(companion, /builds a stronger deck during the fight/);
  assert.match(companion, /attacks High, Mid, and Low zones/);
  assert.match(companion, /earns belts as the match escalates/);
  assert.match(companion, /First Game: Quick Start/);
  assert.match(companion, /Fixed packs<\/strong> · Build during play · High \/ Mid \/ Low combat · White Belt → Black Belt/);
});
