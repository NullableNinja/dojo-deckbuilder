import { readFile, writeFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const write = (path, content) => writeFile(path, content, "utf8");
const replaceOnce = (source, before, after, label) => {
  const at = source.indexOf(before);
  if (at < 0) throw new Error(`Missing patch target: ${label}`);
  if (source.indexOf(before, at + before.length) >= 0) throw new Error(`Ambiguous patch target: ${label}`);
  return source.slice(0, at) + after + source.slice(at + before.length);
};

const effectsPath = "content/card-effects.json";
const effectsRegistry = JSON.parse(await read(effectsPath));

const additions = {
  "DDB-ATK-CORE-036": {
    name: "Loading-Dock Lunge",
    effects: [
      {
        id: "attack-loading-dock-weapon-flow",
        trigger: "onAttackDeclared",
        action: "custom",
        target: "source",
        conditions: [
          { kind: "hasWeaponEquipped", operator: "eq", value: true },
        ],
        resolver: "attack.currentAttackFlow",
      },
    ],
  },
  "DDB-ATK-CORE-048": {
    name: "Refundable Elbow",
    effects: [
      {
        id: "attack-refundable-elbow-reversal-power",
        trigger: "onAttackDeclared",
        action: "modifyAttackPower",
        target: "source",
        amount: 2,
        duration: "immediate",
        conditions: [
          { kind: "playedAsReversal", operator: "eq", value: true },
        ],
        resolver: "attack.conditionalPower",
      },
      {
        id: "attack-refundable-elbow-next-attack-penalty",
        trigger: "onHit",
        action: "modifyAttackPower",
        target: "opponent",
        amount: -1,
        duration: "nextAttack",
        resolver: "attack.targetNextAttackPenalty",
      },
    ],
  },
  "DDB-ATK-CORE-069": {
    name: "Uppercut",
    effects: [
      {
        id: "attack-uppercut-spent-tempo-power",
        trigger: "onAttackDeclared",
        action: "modifyAttackPower",
        target: "source",
        amount: 2,
        duration: "immediate",
        conditions: [
          { kind: "targetTempoUsed", operator: "eq", value: true },
        ],
        resolver: "attack.conditionalPower",
      },
    ],
  },
};

for (const [catalogId, entry] of Object.entries(additions)) {
  if (effectsRegistry.cards[catalogId]) throw new Error(`${catalogId} is already structured`);
  effectsRegistry.cards[catalogId] = entry;
}
effectsRegistry.cards = Object.fromEntries(Object.entries(effectsRegistry.cards).sort(([left], [right]) => left.localeCompare(right)));
await write(effectsPath, JSON.stringify(effectsRegistry, null, 2) + "\n");

let cardEffects = await read("app/card-effects.ts");
cardEffects = replaceOnce(
  cardEffects,
  '  "attack.grantNextAttackFlow",\n]);',
  '  "attack.grantNextAttackFlow",\n  "attack.currentAttackFlow",\n]);',
  "dedicated resolver whitelist",
);
await write("app/card-effects.ts", cardEffects);

let resolvers = await read("app/effect-resolvers.ts");
resolvers = replaceOnce(
  resolvers,
  'export function conditionalAttackPowerBonus(card: EffectCardLike, context: {\n  playedKata: boolean;',
  `export function structuredCurrentAttackFlow(card: EffectCardLike, context: { hasWeaponEquipped: boolean }) {\n  const effects = structuredResolvers(card, "attack.currentAttackFlow");\n  if (!effects.length) return { handled: false, hasFlow: false };\n  const values = { hasWeaponEquipped: context.hasWeaponEquipped };\n  return {\n    handled: true,\n    hasFlow: effects.some((effect) => effect.trigger === "onAttackDeclared" && structuredConditionsMatch(effect, values)),\n  };\n}\n\nexport function conditionalAttackPowerBonus(card: EffectCardLike, context: {\n  playedKata: boolean;`,
  "current Attack Flow resolver",
);
resolvers = replaceOnce(
  resolvers,
  '  priorSpinAttack?: boolean;\n}) {',
  '  priorSpinAttack?: boolean;\n  targetTempoUsed?: boolean;\n  playedAsReversal?: boolean;\n}) {',
  "conditional power context type",
);
resolvers = replaceOnce(
  resolvers,
  '      priorSpinAttack: Boolean(context.priorSpinAttack),\n    };',
  '      priorSpinAttack: Boolean(context.priorSpinAttack),\n      targetTempoUsed: Boolean(context.targetTempoUsed),\n      playedAsReversal: Boolean(context.playedAsReversal),\n    };',
  "conditional power structured values",
);
await write("app/effect-resolvers.ts", resolvers);

let playtest = await read("app/playtest.tsx");
playtest = replaceOnce(
  playtest,
  'structuredFocusIfFastest, structuredNextAttackFlow, type DeckLookPlan',
  'structuredCurrentAttackFlow, structuredFocusIfFastest, structuredNextAttackFlow, type DeckLookPlan',
  "playtest resolver import",
);
playtest = replaceOnce(
  playtest,
  'function printedAttackRuleModifier(attacker: Board, defender: Board, card: CardEntry, zone: string): AttackModifier {',
  'function printedAttackRuleModifier(attacker: Board, defender: Board, card: CardEntry, zone: string, isReversal = false): AttackModifier {',
  "printed Attack modifier signature",
);
playtest = replaceOnce(
  playtest,
  '    hasTempo: attacker.tempo,\n    hasFewerCardsThanTarget:',
  '    hasTempo: attacker.tempo,\n    targetTempoUsed: !defender.tempo,\n    playedAsReversal: isReversal,\n    hasFewerCardsThanTarget:',
  "printed Attack live state",
);
playtest = replaceOnce(
  playtest,
  '    const printedModifier = printedAttackRuleModifier(current.player, current.ai, card, zone);\n    const incomingModifier = incomingAttackEquipmentModifier(current.ai);\n    const comboModifier = comboAttackModifier(current.player, card, zone, true);',
  '    const printedModifier = printedAttackRuleModifier(current.player, current.ai, card, zone, true);\n    const incomingModifier = incomingAttackEquipmentModifier(current.ai);\n    const comboModifier = comboAttackModifier(current.player, card, zone, true);',
  "Reversal printed Attack modifier",
);
playtest = replaceOnce(
  playtest,
  `function attackHasFlow(board: Board, card: CardEntry, combo: ComboModifier) {\n  if (board.nextAttackHasFlow || combo.grantsFlow) return true;\n  if (/this Attack gains Flow/i.test(card.rulesText ?? "")) {\n    return !/Weapon equipped/i.test(card.rulesText ?? "") || board.equipment.some((id) => { const item = cardFor(id); return item ? isWeapon(item) : false; });\n  }`,
  `function attackHasFlow(board: Board, card: CardEntry, combo: ComboModifier) {\n  if (board.nextAttackHasFlow || combo.grantsFlow) return true;\n  const hasWeaponEquipped = board.equipment.some((id) => { const item = cardFor(id); return item ? isWeapon(item) : false; });\n  const structuredFlow = structuredCurrentAttackFlow(card, { hasWeaponEquipped });\n  if (structuredFlow.handled) return structuredFlow.hasFlow;\n  if (/this Attack gains Flow/i.test(card.rulesText ?? "")) {\n    return !/Weapon equipped/i.test(card.rulesText ?? "") || hasWeaponEquipped;\n  }`,
  "current Attack Flow execution",
);
await write("app/playtest.tsx", playtest);

let tests = await read("tests/attack-structured-resolvers-batch.test.mjs");
tests = replaceOnce(
  tests,
  '  readyEquipmentOnHit,\n  structuredNextAttackFlow,',
  '  readyEquipmentOnHit,\n  structuredCurrentAttackFlow,\n  structuredNextAttackFlow,',
  "resolver test import",
);
tests = replaceOnce(
  tests,
  '  assert.ok(attackIds.length >= 35, "Attack migration should not regress below the completed structured batches");',
  '  assert.ok(attackIds.length >= 38, "Attack migration should not regress below the completed structured batches");',
  "Attack migration floor",
);
tests += `\n\ntest("state-backed Attack batch is structured and executable", () => {\n  const ids = ["DDB-ATK-CORE-036", "DDB-ATK-CORE-048", "DDB-ATK-CORE-069"];\n  for (const catalogId of ids) {\n    const plan = effectPlanForCard(card(catalogId), registry);\n    assert.equal(plan.source, "structured", catalogId + " should prefer structured behavior");\n    assert.deepEqual(plan.unsupported, [], catalogId + " should have no queued clauses");\n  }\n\n  const loadingDock = card("DDB-ATK-CORE-036");\n  assert.deepEqual(structuredCurrentAttackFlow(loadingDock, { hasWeaponEquipped: false }), { handled: true, hasFlow: false });\n  assert.deepEqual(structuredCurrentAttackFlow(loadingDock, { hasWeaponEquipped: true }), { handled: true, hasFlow: true });\n\n  const refundable = card("DDB-ATK-CORE-048");\n  assert.equal(conditionalAttackPowerBonus(refundable, powerContext({ playedAsReversal: true })).amount, 2);\n  assert.equal(conditionalAttackPowerBonus(refundable, powerContext({ playedAsReversal: false })).amount, 0);\n  assert.equal(targetNextAttackPenalty(refundable), 1);\n\n  const uppercut = card("DDB-ATK-CORE-069");\n  assert.equal(conditionalAttackPowerBonus(uppercut, powerContext({ targetTempoUsed: true })).amount, 2);\n  assert.equal(conditionalAttackPowerBonus(uppercut, powerContext({ targetTempoUsed: false })).amount, 0);\n});\n`;
await write("tests/attack-structured-resolvers-batch.test.mjs", tests);

console.log("Applied Stage 3B state-backed Attack migration patch.");
