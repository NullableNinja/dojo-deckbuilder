import { readFile, writeFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const write = (path, content) => writeFile(path, content, "utf8");

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing patch target: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Patch target is ambiguous: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const registryPath = "content/card-effects.json";
const runtimeRegistryPath = "app/data/card-effects.json";
const registry = JSON.parse(await read(registryPath));

const flowCards = {
  "DDB-ATK-CORE-005": {
    name: "Back Kick",
    effects: [
      {
        id: "attack-back-kick-first-attack-power",
        trigger: "onAttackDeclared",
        action: "modifyAttackPower",
        target: "source",
        amount: 2,
        duration: "immediate",
        conditions: [{ kind: "firstAttackThisTurn", operator: "eq", value: true }],
        resolver: "attack.conditionalPower",
      },
      {
        id: "attack-back-kick-next-flow",
        trigger: "afterResolve",
        action: "custom",
        target: "self",
        resolver: "attack.grantNextAttackFlow",
      },
    ],
  },
  "DDB-ATK-CORE-053": {
    name: "Snap Front Kick",
    effects: [
      {
        id: "attack-snap-front-kick-next-flow",
        trigger: "onHit",
        action: "custom",
        target: "self",
        conditions: [{ kind: "flowUnusedThisTurn", operator: "eq", value: true }],
        resolver: "attack.grantNextAttackFlow",
      },
    ],
  },
  "DDB-ATK-CORE-054": {
    name: "Spinning Backfist",
    effects: [
      {
        id: "attack-spinning-backfist-next-flow",
        trigger: "afterResolve",
        action: "custom",
        target: "self",
        conditions: [{ kind: "differentZoneFromPreviousAttack", operator: "eq", value: true }],
        resolver: "attack.grantNextAttackFlow",
      },
    ],
  },
  "DDB-ATK-CORE-061": {
    name: "The Blitz",
    effects: [
      {
        id: "attack-the-blitz-next-flow",
        trigger: "afterResolve",
        action: "custom",
        target: "self",
        resolver: "attack.grantNextAttackFlow",
      },
    ],
  },
};

for (const [catalogId, entry] of Object.entries(flowCards)) {
  if (registry.cards[catalogId]) throw new Error(`${catalogId} is already structured; aborting one-shot patch`);
  registry.cards[catalogId] = entry;
}
registry.cards = Object.fromEntries(Object.entries(registry.cards).sort(([left], [right]) => left.localeCompare(right)));
const registryText = `${JSON.stringify(registry, null, 2)}\n`;
await write(registryPath, registryText);
await write(runtimeRegistryPath, registryText);

let cardEffects = await read("app/card-effects.ts");
cardEffects = replaceOnce(
  cardEffects,
  '  "attack.optionalDiscardDraw",\n]);',
  '  "attack.optionalDiscardDraw",\n  "attack.grantNextAttackFlow",\n]);',
  "register structured next-Flow resolver",
);
await write("app/card-effects.ts", cardEffects);

let resolvers = await read("app/effect-resolvers.ts");
const focusHelper = `export function structuredFocusIfFastest(card: EffectCardLike, selfSpeed: number, opponentSpeed: number) {\n  const effect = structuredResolver(card, "starter.gainFocusIfFastest");\n  if (!effect) return 0;\n  const hasFastestCondition = (effect.conditions ?? []).some((condition) => condition.kind === "isFastest" && condition.value === true);\n  if (!hasFastestCondition || selfSpeed <= opponentSpeed) return 0;\n  return Number(effect.amount ?? 0);\n}\n`;
const flowHelper = `${focusHelper}\nexport function structuredNextAttackFlow(card: EffectCardLike, context: {\n  timing: "onPlay" | "onHit" | "onBlock" | "afterResolve";\n  differentZoneFromPreviousAttack?: boolean;\n  flowUsedThisTurn?: boolean;\n}) {\n  const effects = structuredResolvers(card, "attack.grantNextAttackFlow");\n  if (!effects.length) return { handled: false, grant: false };\n  const values = {\n    differentZoneFromPreviousAttack: Boolean(context.differentZoneFromPreviousAttack),\n    flowUnusedThisTurn: !context.flowUsedThisTurn,\n  };\n  return {\n    handled: true,\n    grant: effects.some((effect) => effect.trigger === context.timing && structuredConditionsMatch(effect, values)),\n  };\n}\n`;
resolvers = replaceOnce(resolvers, focusHelper, flowHelper, "add structured next-Flow resolver");
await write("app/effect-resolvers.ts", resolvers);

let playtest = await read("app/playtest.tsx");
playtest = replaceOnce(
  playtest,
  "targetSpeedPenaltyUntilHonor, structuredFocusIfFastest, type DeckLookPlan",
  "targetSpeedPenaltyUntilHonor, structuredFocusIfFastest, structuredNextAttackFlow, type DeckLookPlan",
  "import structured next-Flow resolver",
);

const legacyFlowBlock = `  const text = card.rulesText ?? "";\n  if (timing === "onPlay" && /After your first Attack resolves[^.]*next Attack gains Flow/i.test(text) && board.attacksThisTurn === 0) {\n    next.flowAfterFirstAttack = true;\n  } else if (timing === "onPlay" && /(?:^|[.!?]\\s+)(?:Your|The) next [^.]*Attack[^.]*gains Flow/i.test(text)) {\n    next.nextAttackHasFlow = true;\n  } else if (timing === "onPlay" && card.name === "Second Wind Form" && board.hp > board.maxHp / 2) {\n    next.nextAttackHasFlow = true;\n  } else if (timing === "onHit" && /(?:On Hit|If (?:this Attack|it|that Attack) Hits?)[^.]*next [^.]*Attack[^.]*gains Flow/i.test(text)) {\n    next.nextAttackHasFlow = true;\n  } else if (timing === "afterResolve" && /After (?:this|it|that) Attack resolves[^.]*next [^.]*Attack[^.]*gains Flow/i.test(text)) {\n    next.nextAttackHasFlow = true;\n  }\n  return next;\n`;
const structuredFlowBlock = `  const structuredFlow = structuredNextAttackFlow(card, {\n    timing,\n    differentZoneFromPreviousAttack: new Set(board.zonesPlayed.map((zone) => zone.toLocaleLowerCase())).size > 1,\n    flowUsedThisTurn: board.flowUsedThisTurn,\n  });\n  if (structuredFlow.handled) {\n    if (structuredFlow.grant) next.nextAttackHasFlow = true;\n    return next;\n  }\n  const text = card.rulesText ?? "";\n  if (timing === "onPlay" && /After your first Attack resolves[^.]*next Attack gains Flow/i.test(text) && board.attacksThisTurn === 0) {\n    next.flowAfterFirstAttack = true;\n  } else if (timing === "onPlay" && /(?:^|[.!?]\\s+)(?:Your|The) next [^.]*Attack[^.]*gains Flow/i.test(text)) {\n    next.nextAttackHasFlow = true;\n  } else if (timing === "onPlay" && card.name === "Second Wind Form" && board.hp > board.maxHp / 2) {\n    next.nextAttackHasFlow = true;\n  } else if (timing === "onHit" && /(?:On Hit|If (?:this Attack|it|that Attack) Hits?)[^.]*next [^.]*Attack[^.]*gains Flow/i.test(text)) {\n    next.nextAttackHasFlow = true;\n  } else if (timing === "afterResolve" && /After (?:this|it|that) Attack resolves[^.]*next [^.]*Attack[^.]*gains Flow/i.test(text)) {\n    next.nextAttackHasFlow = true;\n  }\n  return next;\n`;
playtest = replaceOnce(playtest, legacyFlowBlock, structuredFlowBlock, "prefer structured Flow grants in playtest");
await write("app/playtest.tsx", playtest);

let tests = await read("tests/attack-structured-resolvers-batch.test.mjs");
tests = replaceOnce(
  tests,
  "  readyEquipmentOnHit,\n  targetNextAttackPenalty,",
  "  readyEquipmentOnHit,\n  structuredNextAttackFlow,\n  targetNextAttackPenalty,",
  "import structured Flow helper in tests",
);
tests = replaceOnce(
  tests,
  'assert.ok(attackIds.length >= 31, "Attack migration should not regress below the completed structured batches");',
  'assert.ok(attackIds.length >= 35, "Attack migration should not regress below the completed structured batches");',
  "raise structured Attack coverage floor",
);

tests += `\nconst nextFlowContext = (overrides = {}) => ({\n  timing: "afterResolve",\n  differentZoneFromPreviousAttack: false,\n  flowUsedThisTurn: false,\n  ...overrides,\n});\n\ntest("Flow-granting Attack batch is structured and executable", () => {\n  const ids = ["DDB-ATK-CORE-005", "DDB-ATK-CORE-053", "DDB-ATK-CORE-054", "DDB-ATK-CORE-061"];\n  for (const catalogId of ids) {\n    const plan = effectPlanForCard(card(catalogId), registry);\n    assert.equal(plan.source, "structured", \\`${catalogId} should prefer structured behavior\\`);\n    assert.deepEqual(plan.unsupported, [], \\`${catalogId} should have no queued clauses\\`);\n    assert.ok(plan.dedicated.includes("attack.grantNextAttackFlow"), \\`${catalogId} should use the structured Flow resolver\\`);\n  }\n\n  const backKick = card("DDB-ATK-CORE-005");\n  assert.equal(conditionalAttackPowerBonus(backKick, powerContext({ firstAttack: true })).amount, 2);\n  assert.equal(conditionalAttackPowerBonus(backKick, powerContext({ firstAttack: false })).amount, 0);\n  assert.deepEqual(structuredNextAttackFlow(backKick, nextFlowContext()), { handled: true, grant: true });\n\n  const snapFrontKick = card("DDB-ATK-CORE-053");\n  assert.deepEqual(structuredNextAttackFlow(snapFrontKick, nextFlowContext({ timing: "onHit" })), { handled: true, grant: true });\n  assert.deepEqual(structuredNextAttackFlow(snapFrontKick, nextFlowContext({ timing: "onHit", flowUsedThisTurn: true })), { handled: true, grant: false });\n\n  const spinningBackfist = card("DDB-ATK-CORE-054");\n  assert.deepEqual(structuredNextAttackFlow(spinningBackfist, nextFlowContext({ differentZoneFromPreviousAttack: false })), { handled: true, grant: false });\n  assert.deepEqual(structuredNextAttackFlow(spinningBackfist, nextFlowContext({ differentZoneFromPreviousAttack: true })), { handled: true, grant: true });\n\n  const blitz = card("DDB-ATK-CORE-061");\n  assert.deepEqual(structuredNextAttackFlow(blitz, nextFlowContext()), { handled: true, grant: true });\n});\n`;
await write("tests/attack-structured-resolvers-batch.test.mjs", tests);

console.log("Stage 3B Flow batch patched: 4 Attacks moved to structured next-Attack Flow behavior.");
