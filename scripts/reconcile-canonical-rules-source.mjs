import { readFile, writeFile } from "node:fs/promises";

const replaceOnce = (source, from, to, label) => {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(from, to);
};

const rulesPath = new URL("../content/rules.json", import.meta.url);
let rules = await readFile(rulesPath, "utf8");
rules = replaceOnce(
  rules,
  "Black Belt Victory: Reach 55 XP, complete the Black Belt promotion task, and promote during Ascend. Quick Duel does not use this victory condition.",
  "Black Belt Victory: Reach 35 XP, complete the Black Belt promotion task, and promote during Ascend. Quick Duel does not use this victory condition.",
  "Black Belt victory threshold",
);
rules = replaceOnce(
  rules,
  "Win: KO the Final Boss. If that KO completes your Black Belt task and you already have at least 55 XP, promote to Black Belt immediately before Scenario Victory is checked.",
  "Win: KO the Final Boss. If that KO completes your Black Belt task and you already have at least 35 XP, promote to Black Belt immediately before Scenario Victory is checked.",
  "Boss Blitz Black Belt threshold",
);
rules = replaceOnce(
  rules,
  "Every Character begins at 25 HP. Damage reduces current HP. Healing cannot raise a fighter above maximum HP. At 0 HP, the fighter is Knocked Out. Belt rewards increase maximum HP except in Quick Duel, where Max HP remains 25 unless a card or scenario explicitly changes it.",
  "Every Character begins at 25 HP. Damage reduces current HP. Healing cannot raise a fighter above maximum HP. At 0 HP, the fighter is Knocked Out. Belt certification does not raise current or maximum HP or heal a fighter. Max HP remains 25 unless a card or scenario explicitly changes it.",
  "Belt HP rule",
);
await writeFile(rulesPath, rules, "utf8");

const presentationPath = new URL("../app/canonical-presentation.ts", import.meta.url);
let presentation = await readFile(presentationPath, "utf8");
const presentationStart = presentation.indexOf("const beltRewardsChangeHp =");
const presentationEndMarker = "} satisfies RuleData;";
const presentationEndStart = presentation.indexOf(presentationEndMarker, presentationStart);
if (presentationStart < 0 || presentationEndStart < 0) {
  throw new Error("Could not locate the presentation-time canonical repair shim");
}
const presentationEnd = presentationEndStart + presentationEndMarker.length;
presentation = `${presentation.slice(0, presentationStart)}export const CANONICAL_RULES = rawRules satisfies RuleData;${presentation.slice(presentationEnd)}`;
if (presentation.includes("hydrateMechanicalText") || presentation.includes("Reach 55 XP/g") || presentation.includes("beltRewardsChangeHp")) {
  throw new Error("Presentation-time canonical repair shim was not fully removed");
}
await writeFile(presentationPath, presentation, "utf8");

const testPath = new URL("../tests/canonical-presentation-surface.test.mjs", import.meta.url);
let test = await readFile(testPath, "utf8");
const testStart = test.indexOf('test("player-facing rules presentation is driven by canonical JSON"');
const nextTest = test.indexOf('\ntest("homepage immediately explains the product and first-game path"', testStart);
if (testStart < 0 || nextTest < 0) {
  throw new Error("Could not locate canonical presentation regression test");
}
const replacementTest = `test("player-facing rules presentation is driven by canonical JSON", async () => {\n  const [definition, rules, companion, presentation] = await Promise.all([\n    readJson("content/dojo-game.json"),\n    readJson("content/rules.json"),\n    readText("app/companion-app.tsx"),\n    readText("app/canonical-presentation.ts"),\n  ]);\n\n  const black = definition.definition.progression.belts.find((belt) => belt.id === "black");\n  assert.equal(black?.xp, 35, "Black Belt should remain the canonical 35-XP threshold");\n  assert.equal(definition.definition.turn.handSize, 7, "the canonical opening/normal hand size should remain seven");\n\n  const beltTable = rules.chapters.find((chapter) => chapter.number === 11)?.sections\n    .find((section) => section.id === "belt-table")?.content\n    .find((block) => block.kind === "table")?.rows;\n  const blackRow = beltTable?.find((row) => row[0] === "Black");\n  assert.equal(blackRow?.[1], black.xp, "rulebook Belt Table must match structured Black Belt XP");\n\n  const rulesText = JSON.stringify(rules);\n  assert.match(rulesText, new RegExp(\`Black Belt Victory: Reach \${black.xp} XP\`));\n  assert.match(rulesText, new RegExp(\`already have at least \${black.xp} XP\`));\n  assert.doesNotMatch(rulesText, /55 XP/);\n  assert.doesNotMatch(rulesText, /Belt rewards increase maximum HP/);\n  assert.match(rulesText, /Belt certification does not raise current or maximum HP or heal a fighter/);\n\n  assert.match(companion, /from "\\.\\/canonical-presentation"/);\n  assert.match(companion, /const rulesData = CANONICAL_RULES/);\n  assert.match(companion, /const setup = SETUP_STEPS/);\n  assert.match(companion, /draw \\{HAND_SIZE\\}/);\n  assert.match(companion, /CANONICAL_GAME_MODES\\.map/);\n  assert.match(companion, /CANONICAL_PHASES\\.map/);\n  assert.match(companion, /STARTER_EXAMPLES\\.basicJab/);\n  assert.match(companion, /STARTER_EXAMPLES\\.highGuard/);\n  assert.match(companion, /ROUND_STRUCTURE_SUMMARY/);\n  assert.match(companion, /COMBAT_SEQUENCE\\.map/);\n  assert.match(companion, /COMBAT_FORMULA_TEXT/);\n  assert.match(companion, /DEFENSE_WITHOUT_CARD_RULE/);\n  assert.match(companion, /COMBAT_XP_RULE/);\n  assert.match(companion, /RULE_PRIORITY\\.map/);\n  assert.match(companion, /TABLE_JUDGE_STEPS\\.map/);\n  assert.match(companion, /const RULES_REVISION_NOTES = CURRENT_RULE_HIGHLIGHTS/);\n\n  assert.doesNotMatch(companion, /draw five/i);\n  assert.doesNotMatch(companion, /Max HP increases and promotion healing/i);\n  assert.doesNotMatch(companion, /full vitality reward from promotion/i);\n  assert.doesNotMatch(companion, /Scenario or mode rules<\\/li>/);\n  assert.doesNotMatch(companion, /Pause for no more than two minutes\\.<\\/li>/);\n  assert.doesNotMatch(companion, /Attack Power<\\/b> = printed Attack Power/);\n\n  assert.match(presentation, /export const CANONICAL_RULES = rawRules satisfies RuleData/);\n  assert.doesNotMatch(presentation, /hydrateMechanicalText/);\n  assert.doesNotMatch(presentation, /Reach 55 XP\\/g/);\n  assert.doesNotMatch(presentation, /beltRewardsChangeHp/);\n  assert.match(presentation, /COMBAT_XP_RULE/);\n  assert.match(presentation, /CURRENT_RULE_HIGHLIGHTS/);\n});\n`;
test = `${test.slice(0, testStart)}${replacementTest}${test.slice(nextTest + 1)}`;
if (!test.includes("rulebook Belt Table must match structured Black Belt XP")) {
  throw new Error("Canonical presentation test replacement failed");
}
await writeFile(testPath, test, "utf8");

console.log("Reconciled canonical rules source and removed presentation-time repair shims.");
