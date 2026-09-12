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

  assert.doesNotMatch(companion, /draw five/i);
  assert.doesNotMatch(companion, /Max HP increases and promotion healing/i);
  assert.doesNotMatch(companion, /full vitality reward from promotion/i);

  assert.match(presentation, /BLACK_BELT_XP/);
  assert.match(presentation, /Reach 55 XP/g);
  assert.match(presentation, /Reach \$\{BLACK_BELT_XP\} XP/);
  assert.match(presentation, /Belt rewards do not change current or maximum HP/);
});
