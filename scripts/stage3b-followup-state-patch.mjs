import { readFile, writeFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const write = (path, content) => writeFile(path, content, "utf8");
const replaceOnce = (source, before, after, label) => {
  const at = source.indexOf(before);
  if (at < 0) throw new Error(`Missing patch target: ${label}`);
  if (source.indexOf(before, at + before.length) >= 0) throw new Error(`Ambiguous patch target: ${label}`);
  return source.slice(0, at) + after + source.slice(at + before.length);
};

const cards = JSON.parse(await read("content/cards.json"));
const byCatalogId = new Map((cards.cards ?? []).map((card) => [card.catalogId, card]));
const expectedRules = {
  "DDB-ATK-CORE-047": "If this is your first Attack this turn and it Hits, gain 1 Focus.",
  "DDB-ATK-CORE-058": "On Hit, your next Attack this turn may be declared as Any zone.",
};
for (const [catalogId, expected] of Object.entries(expectedRules)) {
  const card = byCatalogId.get(catalogId);
  if (!card) throw new Error(`Canonical card ${catalogId} is missing`);
  if (String(card.rulesText ?? "").trim() !== expected) {
    throw new Error(`${catalogId} canonical rules text changed; expected '${expected}' but found '${card.rulesText ?? ""}'`);
  }
}

const registryPath = "content/card-effects.json";
const registry = JSON.parse(await read(registryPath));
const additions = {
  "DDB-ATK-CORE-047": {
    name: "Receipt-Roll Jab",
    effects: [
      {
        id: "attack-receipt-roll-first-hit-focus",
        trigger: "onHit",
        action: "gainFocus",
        target: "self",
        amount: 1,
        duration: "immediate",
        conditions: [
          { kind: "firstAttackThisTurn", operator: "eq", value: true },
        ],
        resolver: "attack.conditionalFocus",
      },
    ],
  },
  "DDB-ATK-CORE-058": {
    name: "Swan Kick",
    effects: [
      {
        id: "attack-swan-kick-next-any-zone",
        trigger: "onHit",
        action: "chooseZone",
        target: "self",
        duration: "nextAttack",
        resolver: "attack.grantNextAttackAnyZone",
      },
    ],
  },
};
for (const [catalogId, entry] of Object.entries(additions)) {
  if (registry.cards[catalogId]) throw new Error(`${catalogId} is already structured`);
  registry.cards[catalogId] = entry;
}
registry.cards = Object.fromEntries(Object.entries(registry.cards).sort(([left], [right]) => left.localeCompare(right)));
await write(registryPath, JSON.stringify(registry, null, 2) + "\n");

let cardEffects = await read("app/card-effects.ts");
cardEffects = replaceOnce(
  cardEffects,
  '  "attack.currentAttackFlow",\n]);',
  '  "attack.currentAttackFlow",\n  "attack.conditionalFocus",\n  "attack.grantNextAttackAnyZone",\n]);',
  "dedicated Attack resolver whitelist",
);
await write("app/card-effects.ts", cardEffects);

let resolvers = await read("app/effect-resolvers.ts");
resolvers = replaceOnce(
  resolvers,
  'export function structuredCurrentAttackFlow(card: EffectCardLike, context: { hasWeaponEquipped: boolean }) {',
  `export function structuredConditionalFocus(card: EffectCardLike, context: {\n  timing: "onPlay" | "onHit" | "onBlock" | "afterResolve";\n  attackNumber: number;\n}) {\n  const effects = structuredResolvers(card, "attack.conditionalFocus");\n  if (!effects.length) return { handled: false, amount: 0 };\n  const values = { firstAttackThisTurn: context.attackNumber === 1, attackNumber: context.attackNumber };\n  return {\n    handled: true,\n    amount: effects\n      .filter((effect) => effect.trigger === context.timing && structuredConditionsMatch(effect, values))\n      .reduce((total, effect) => total + Number(effect.amount ?? 0), 0),\n  };\n}\n\nexport function structuredNextAttackAnyZone(card: EffectCardLike, context: {\n  timing: "onPlay" | "onHit" | "onBlock" | "afterResolve";\n  attackNumber: number;\n}) {\n  const effects = structuredResolvers(card, "attack.grantNextAttackAnyZone");\n  if (!effects.length) return { handled: false, grant: false };\n  return {\n    handled: true,\n    grant: context.attackNumber > 0 && effects.some((effect) => effect.trigger === context.timing),\n  };\n}\n\nexport function structuredCurrentAttackFlow(card: EffectCardLike, context: { hasWeaponEquipped: boolean }) {`,
  "conditional Focus and next Any-zone resolvers",
);
await write("app/effect-resolvers.ts", resolvers);

let playtest = await read("app/playtest.tsx");
playtest = replaceOnce(
  playtest,
  'structuredCurrentAttackFlow, structuredFocusIfFastest, structuredNextAttackFlow, type DeckLookPlan',
  'structuredConditionalFocus, structuredCurrentAttackFlow, structuredFocusIfFastest, structuredNextAttackAnyZone, structuredNextAttackFlow, type DeckLookPlan',
  "playtest resolver imports",
);
playtest = replaceOnce(
  playtest,
  '  nextAttackHasFlow: boolean;\n  flowAfterFirstAttack: boolean;',
  '  nextAttackHasFlow: boolean;\n  nextAttackAnyZone: boolean;\n  flowAfterFirstAttack: boolean;',
  "Board next Attack zone state",
);
playtest = replaceOnce(
  playtest,
  'flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false',
  'flowUsedThisTurn: false, nextAttackHasFlow: false, nextAttackAnyZone: false, flowAfterFirstAttack: false',
  "emptyBoard next Attack zone state",
);
playtest = replaceOnce(
  playtest,
  'flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], nextAttackBonus: 0',
  'flowUsedThisTurn: false, nextAttackHasFlow: false, nextAttackAnyZone: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], nextAttackBonus: 0',
  "Hide cleanup next Attack zone state",
);
const roundResetNeedle = 'flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: []';
let roundResetCount = 0;
while (playtest.includes(roundResetNeedle)) {
  playtest = playtest.replace(roundResetNeedle, 'flowUsedThisTurn: false, nextAttackHasFlow: false, nextAttackAnyZone: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: []');
  roundResetCount += 1;
}
if (roundResetCount !== 2) throw new Error(`Expected two round reset patches; found ${roundResetCount}`);
playtest = replaceOnce(
  playtest,
  'function attackHasFlexibleZone(board: Board, card: CardEntry) {\n  if (card.zone?.includes("Any")) return true;',
  'function attackHasFlexibleZone(board: Board, card: CardEntry) {\n  if (board.nextAttackAnyZone) return true;\n  if (card.zone?.includes("Any")) return true;',
  "next Attack Any-zone consumption lookup",
);
playtest = replaceOnce(
  playtest,
  '  const structuredFlow = structuredNextAttackFlow(card, {\n    timing,\n    differentZoneFromPreviousAttack: new Set(board.zonesPlayed.map((zone) => zone.toLocaleLowerCase())).size > 1,\n  });\n  if (structuredFlow.handled) {\n    if (structuredFlow.grant) next.nextAttackHasFlow = true;\n    return next;\n  }',
  `  const structuredFocus = structuredConditionalFocus(card, { timing, attackNumber: board.attacksThisTurn });\n  if (structuredFocus.handled && structuredFocus.amount) next.focus += structuredFocus.amount;\n  const structuredAnyZone = structuredNextAttackAnyZone(card, { timing, attackNumber: board.attacksThisTurn });\n  if (structuredAnyZone.grant) next.nextAttackAnyZone = true;\n  const structuredFlow = structuredNextAttackFlow(card, {\n    timing,\n    differentZoneFromPreviousAttack: new Set(board.zonesPlayed.map((zone) => zone.toLocaleLowerCase())).size > 1,\n  });\n  if (structuredFlow.grant) next.nextAttackHasFlow = true;\n  if (structuredAnyZone.handled || structuredFlow.handled) return next;`,
  "structured follow-up effects",
);
const consumeNeedle = 'nextAttackBonus: 0, nextAttackHasFlow: false,';
let consumeCount = 0;
while (playtest.includes(consumeNeedle)) {
  playtest = playtest.replace(consumeNeedle, 'nextAttackBonus: 0, nextAttackHasFlow: false, nextAttackAnyZone: false,');
  consumeCount += 1;
}
if (consumeCount !== 2) throw new Error(`Expected two normal Attack consumption patches; found ${consumeCount}`);
playtest = replaceOnce(
  playtest,
  'cardsThisTurn: [...current.player.cardsThisTurn, card.id], reversalUsedRound: true, reversalAttackBonus: 0,',
  'cardsThisTurn: [...current.player.cardsThisTurn, card.id], nextAttackAnyZone: false, reversalUsedRound: true, reversalAttackBonus: 0,',
  "Reversal next Attack zone consumption",
);
await write("app/playtest.tsx", playtest);

let tests = await read("tests/attack-structured-resolvers-batch.test.mjs");
tests = replaceOnce(
  tests,
  '  structuredCurrentAttackFlow,\n  structuredNextAttackFlow,',
  '  structuredConditionalFocus,\n  structuredCurrentAttackFlow,\n  structuredNextAttackAnyZone,\n  structuredNextAttackFlow,',
  "follow-up resolver test imports",
);
tests = replaceOnce(
  tests,
  '  assert.ok(attackIds.length >= 38, "Attack migration should not regress below the completed structured batches");',
  '  assert.ok(attackIds.length >= 40, "Attack migration should not regress below the completed structured batches");',
  "Attack migration floor",
);
tests += `\n\ntest("first-Hit Focus and next-Any-zone Attack effects are structured", () => {\n  const receipt = card("DDB-ATK-CORE-047");\n  const receiptPlan = effectPlanForCard(receipt, registry);\n  assert.equal(receiptPlan.source, "structured");\n  assert.deepEqual(receiptPlan.unsupported, []);\n  assert.deepEqual(structuredConditionalFocus(receipt, { timing: "onHit", attackNumber: 1 }), { handled: true, amount: 1 });\n  assert.deepEqual(structuredConditionalFocus(receipt, { timing: "onHit", attackNumber: 2 }), { handled: true, amount: 0 });\n  assert.deepEqual(structuredConditionalFocus(receipt, { timing: "afterResolve", attackNumber: 1 }), { handled: true, amount: 0 });\n\n  const swan = card("DDB-ATK-CORE-058");\n  const swanPlan = effectPlanForCard(swan, registry);\n  assert.equal(swanPlan.source, "structured");\n  assert.deepEqual(swanPlan.unsupported, []);\n  assert.equal(attackCanChooseAnyZone(swan, false, []), false, "Swan Kick itself must not become Any-zone from its next-Attack text");\n  assert.deepEqual(structuredNextAttackAnyZone(swan, { timing: "onHit", attackNumber: 1 }), { handled: true, grant: true });\n  assert.deepEqual(structuredNextAttackAnyZone(swan, { timing: "afterResolve", attackNumber: 1 }), { handled: true, grant: false });\n  assert.deepEqual(structuredNextAttackAnyZone(swan, { timing: "onHit", attackNumber: 0 }), { handled: true, grant: false });\n});\n`;
tests = replaceOnce(
  tests,
  '  attackPiercing,\n  conditionalAttackPowerBonus,',
  '  attackCanChooseAnyZone,\n  attackPiercing,\n  conditionalAttackPowerBonus,',
  "attackCanChooseAnyZone test import",
);
await write("tests/attack-structured-resolvers-batch.test.mjs", tests);

console.log("Applied Stage 3B follow-up state Attack migration patch.");
