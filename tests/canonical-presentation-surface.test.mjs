import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readText = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await readText(path));

test("player-facing rules presentation is driven by canonical JSON", async () => {
  const [definition, rules, companion, presentation] = await Promise.all([
    readJson("content/dojo-game.json"),
    readJson("content/rules.json"),
    readText("app/companion-app.tsx"),
    readText("app/canonical-presentation.ts"),
  ]);

  const black = definition.definition.progression.belts.find((belt) => belt.id === "black");
  assert.equal(black?.xp, 35, "Black Belt should remain the canonical 35-XP threshold");
  assert.equal(definition.definition.turn.handSize, 7, "the canonical opening/normal hand size should remain seven");

  const beltTable = rules.chapters.find((chapter) => chapter.number === 11)?.sections
    .find((section) => section.id === "belt-table")?.content
    .find((block) => block.kind === "table")?.rows;
  const blackRow = beltTable?.find((row) => row[0] === "Black");
  assert.equal(blackRow?.[1], black.xp, "rulebook Belt Table must match structured Black Belt XP");

  const rulesText = JSON.stringify(rules);
  assert.match(rulesText, new RegExp(`Black Belt Victory: Reach ${black.xp} XP`));
  assert.match(rulesText, new RegExp(`already have at least ${black.xp} XP`));
  assert.doesNotMatch(rulesText, /55 XP/);
  assert.doesNotMatch(rulesText, /Belt rewards increase maximum HP/);
  assert.match(rulesText, /Belt certification does not raise current or maximum HP or heal a fighter/);

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

  assert.match(presentation, /export const CANONICAL_RULES = rawRules satisfies RuleData/);
  assert.doesNotMatch(presentation, /hydrateMechanicalText/);
  assert.doesNotMatch(presentation, /Reach 55 XP\/g/);
  assert.doesNotMatch(presentation, /beltRewardsChangeHp/);
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
