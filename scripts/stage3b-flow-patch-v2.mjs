import { readFile, writeFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const write = (path, content) => writeFile(path, content, "utf8");
const replaceOnce = (source, before, after, label) => {
  const at = source.indexOf(before);
  if (at < 0) throw new Error(`Missing patch target: ${label}`);
  if (source.indexOf(before, at + before.length) >= 0) throw new Error(`Ambiguous patch target: ${label}`);
  return source.slice(0, at) + after + source.slice(at + before.length);
};

const registry = JSON.parse(await read("content/card-effects.json"));
Object.assign(registry.cards, {
  "DDB-ATK-CORE-005": {
    name: "Back Kick",
    effects: [
      { id: "attack-back-kick-first-attack-power", trigger: "onAttackDeclared", action: "modifyAttackPower", target: "source", amount: 2, duration: "immediate", conditions: [{ kind: "firstAttackThisTurn", operator: "eq", value: true }], resolver: "attack.conditionalPower" },
      { id: "attack-back-kick-next-flow", trigger: "afterResolve", action: "custom", target: "self", resolver: "attack.grantNextAttackFlow" },
    ],
  },
  "DDB-ATK-CORE-053": {
    name: "Snap Front Kick",
    effects: [
      { id: "attack-snap-front-kick-next-flow", trigger: "onHit", action: "custom", target: "self", conditions: [{ kind: "flowUnusedThisTurn", operator: "eq", value: true }], resolver: "attack.grantNextAttackFlow" },
    ],
  },
  "DDB-ATK-CORE-054": {
    name: "Spinning Backfist",
    effects: [
      { id: "attack-spinning-backfist-next-flow", trigger: "afterResolve", action: "custom", target: "self", conditions: [{ kind: "differentZoneFromPreviousAttack", operator: "eq", value: true }], resolver: "attack.grantNextAttackFlow" },
    ],
  },
  "DDB-ATK-CORE-061": {
    name: "The Blitz",
    effects: [
      { id: "attack-the-blitz-next-flow", trigger: "afterResolve", action: "custom", target: "self", resolver: "attack.grantNextAttackFlow" },
    ],
  },
});
registry.cards = Object.fromEntries(Object.entries(registry.cards).sort(([a], [b]) => a.localeCompare(b)));
const registryText = `${JSON.stringify(registry, null, 2)}\n`;
await write("content/card-effects.json", registryText);
await write("app/data/card-effects.json", registryText);

let cardEffects = await read("app/card-effects.ts");
cardEffects = replaceOnce(cardEffects, '  "attack.optionalDiscardDraw",\n]);', '  "attack.optionalDiscardDraw",\n  "attack.grantNextAttackFlow",\n]);', "register Flow resolver");
await write("app/card-effects.ts", cardEffects);

let resolvers = await read("app/effect-resolvers.ts");
const focusHelper = `export function structuredFocusIfFastest(card: EffectCardLike, selfSpeed: number, opponentSpeed: number) {\n  const effect = structuredResolver(card, "starter.gainFocusIfFastest");\n  if (!effect) return 0;\n  const hasFastestCondition = (effect.conditions ?? []).some((condition) => condition.kind === "isFastest" && condition.value === true);\n  if (!hasFastestCondition || selfSpeed <= opponentSpeed) return 0;\n  return Number(effect.amount ?? 0);\n}\n`;
const flowHelper = `${focusHelper}\nexport function structuredNextAttackFlow(card: EffectCardLike, context: {\n  timing: "onPlay" | "onHit" | "onBlock" | "afterResolve";\n  differentZoneFromPreviousAttack?: boolean;\n  flowUsedThisTurn?: boolean;\n}) {\n  const effects = structuredResolvers(card, "attack.grantNextAttackFlow");\n  if (!effects.length) return { handled: false, grant: false };\n  const values = {\n    differentZoneFromPreviousAttack: Boolean(context.differentZoneFromPreviousAttack),\n    flowUnusedThisTurn: !context.flowUsedThisTurn,\n  };\n  return {\n    handled: true,\n    grant: effects.some((effect) => effect.trigger === context.timing && structuredConditionsMatch(effect, values)),\n  };\n}\n`;
resolvers = replaceOnce(resolvers, focusHelper, flowHelper, "add Flow resolver");
await write("app/effect-resolvers.ts", resolvers);

let playtest = await read("app/playtest.tsx");
playtest = replaceOnce(playtest, "targetSpeedPenaltyUntilHonor, structuredFocusIfFastest, type DeckLookPlan", "targetSpeedPenaltyUntilHonor, structuredFocusIfFastest, structuredNextAttackFlow, type DeckLookPlan", "import Flow resolver");
const legacyFlow = `  const text = card.rulesText ?? "";\n  if (timing === "onPlay" && /After your first Attack resolves[^.]*next Attack gains Flow/i.test(text) && board.attacksThisTurn === 0) {\n    next.flowAfterFirstAttack = true;\n  } else if (timing === "onPlay" && /(?:^|[.!?]\\s+)(?:Your|The) next [^.]*Attack[^.]*gains Flow/i.test(text)) {\n    next.nextAttackHasFlow = true;\n  } else if (timing === "onPlay" && card.name === "Second Wind Form" && board.hp > board.maxHp / 2) {\n    next.nextAttackHasFlow = true;\n  } else if (timing === "onHit" && /(?:On Hit|If (?:this Attack|it|that Attack) Hits?)[^.]*next [^.]*Attack[^.]*gains Flow/i.test(text)) {\n    next.nextAttackHasFlow = true;\n  } else if (timing === "afterResolve" && /After (?:this|it|that) Attack resolves[^.]*next [^.]*Attack[^.]*gains Flow/i.test(text)) {\n    next.nextAttackHasFlow = true;\n  }\n  return next;\n`;
const structuredFlow = `  const structuredFlow = structuredNextAttackFlow(card, {\n    timing,\n    differentZoneFromPreviousAttack: new Set(board.zonesPlayed.map((zone) => zone.toLocaleLowerCase())).size > 1,\n    flowUsedThisTurn: board.flowUsedThisTurn,\n  });\n  if (structuredFlow.handled) {\n    if (structuredFlow.grant) next.nextAttackHasFlow = true;\n    return next;\n  }\n  const text = card.rulesText ?? "";\n  if (timing === "onPlay" && /After your first Attack resolves[^.]*next Attack gains Flow/i.test(text) && board.attacksThisTurn === 0) {\n    next.flowAfterFirstAttack = true;\n  } else if (timing === "onPlay" && /(?:^|[.!?]\\s+)(?:Your|The) next [^.]*Attack[^.]*gains Flow/i.test(text)) {\n    next.nextAttackHasFlow = true;\n  } else if (timing === "onPlay" && card.name === "Second Wind Form" && board.hp > board.maxHp / 2) {\n    next.nextAttackHasFlow = true;\n  } else if (timing === "onHit" && /(?:On Hit|If (?:this Attack|it|that Attack) Hits?)[^.]*next [^.]*Attack[^.]*gains Flow/i.test(text)) {\n    next.nextAttackHasFlow = true;\n  } else if (timing === "afterResolve" && /After (?:this|it|that) Attack resolves[^.]*next [^.]*Attack[^.]*gains Flow/i.test(text)) {\n    next.nextAttackHasFlow = true;\n  }\n  return next;\n`;
playtest = replaceOnce(playtest, legacyFlow, structuredFlow, "prefer structured Flow grants");
await write("app/playtest.tsx", playtest);

let tests = await read("tests/attack-structured-resolvers-batch.test.mjs");
tests = replaceOnce(tests, "  readyEquipmentOnHit,\n  targetNextAttackPenalty,", "  readyEquipmentOnHit,\n  structuredNextAttackFlow,\n  targetNextAttackPenalty,", "import Flow helper in tests");
tests = replaceOnce(tests, 'assert.ok(attackIds.length >= 31, "Attack migration should not regress below the completed structured batches");', 'assert.ok(attackIds.length >= 35, "Attack migration should not regress below the completed structured batches");', "raise Attack coverage floor");
tests += `\nconst nextFlowContext = (overrides = {}) => ({\n  timing: "afterResolve",\n  differentZoneFromPreviousAttack: false,\n  flowUsedThisTurn: false,\n  ...overrides,\n});\n\ntest("Flow-granting Attack batch is structured and executable", () => {\n  const ids = ["DDB-ATK-CORE-005", "DDB-ATK-CORE-053", "DDB-ATK-CORE-054", "DDB-ATK-CORE-061"];\n  for (const catalogId of ids) {\n    const plan = effectPlanForCard(card(catalogId), registry);\n    assert.equal(plan.source, "structured", catalogId + " should prefer structured behavior");\n    assert.deepEqual(plan.unsupported, [], catalogId + " should have no queued clauses");\n    assert.ok(plan.dedicated.includes("attack.grantNextAttackFlow"), catalogId + " should use the structured Flow resolver");\n  }\n\n  const backKick = card("DDB-ATK-CORE-005");\n  assert.equal(conditionalAttackPowerBonus(backKick, powerContext({ firstAttack: true })).amount, 2);\n  assert.equal(conditionalAttackPowerBonus(backKick, powerContext({ firstAttack: false })).amount, 0);\n  assert.deepEqual(structuredNextAttackFlow(backKick, nextFlowContext()), { handled: true, grant: true });\n\n  const snapFrontKick = card("DDB-ATK-CORE-053");\n  assert.deepEqual(structuredNextAttackFlow(snapFrontKick, nextFlowContext({ timing: "onHit" })), { handled: true, grant: true });\n  assert.deepEqual(structuredNextAttackFlow(snapFrontKick, nextFlowContext({ timing: "onHit", flowUsedThisTurn: true })), { handled: true, grant: false });\n\n  const spinningBackfist = card("DDB-ATK-CORE-054");\n  assert.deepEqual(structuredNextAttackFlow(spinningBackfist, nextFlowContext({ differentZoneFromPreviousAttack: false })), { handled: true, grant: false });\n  assert.deepEqual(structuredNextAttackFlow(spinningBackfist, nextFlowContext({ differentZoneFromPreviousAttack: true })), { handled: true, grant: true });\n\n  const blitz = card("DDB-ATK-CORE-061");\n  assert.deepEqual(structuredNextAttackFlow(blitz, nextFlowContext()), { handled: true, grant: true });\n});\n`;
await write("tests/attack-structured-resolvers-batch.test.mjs", tests);

console.log("Stage 3B Flow batch patched: Back Kick, Snap Front Kick, Spinning Backfist, and The Blitz.");
