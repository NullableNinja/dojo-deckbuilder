import { readFile, writeFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const write = (path, content) => writeFile(path, content, "utf8");
const replaceOnce = (source, before, after, label) => {
  const at = source.indexOf(before);
  if (at < 0) throw new Error(`Missing patch target: ${label}`);
  if (source.indexOf(before, at + before.length) >= 0) throw new Error(`Ambiguous patch target: ${label}`);
  return source.slice(0, at) + after + source.slice(at + before.length);
};

for (const path of ["content/card-effects.json", "app/data/card-effects.json"]) {
  const registry = JSON.parse(await read(path));
  const snap = registry.cards?.["DDB-ATK-CORE-053"];
  if (!snap?.effects?.length) throw new Error(`${path}: Snap Front Kick structured entry missing`);
  const flow = snap.effects.find((effect) => effect.resolver === "attack.grantNextAttackFlow");
  if (!flow) throw new Error(`${path}: Snap Front Kick Flow effect missing`);
  delete flow.conditions;
  await write(path, `${JSON.stringify(registry, null, 2)}\n`);
}

let resolvers = await read("app/effect-resolvers.ts");
resolvers = replaceOnce(
  resolvers,
  `export function structuredNextAttackFlow(card: EffectCardLike, context: {\n  timing: "onPlay" | "onHit" | "onBlock" | "afterResolve";\n  differentZoneFromPreviousAttack?: boolean;\n  flowUsedThisTurn?: boolean;\n}) {\n  const effects = structuredResolvers(card, "attack.grantNextAttackFlow");\n  if (!effects.length) return { handled: false, grant: false };\n  const values = {\n    differentZoneFromPreviousAttack: Boolean(context.differentZoneFromPreviousAttack),\n    flowUnusedThisTurn: !context.flowUsedThisTurn,\n  };\n`,
  `export function structuredNextAttackFlow(card: EffectCardLike, context: {\n  timing: "onPlay" | "onHit" | "onBlock" | "afterResolve";\n  differentZoneFromPreviousAttack?: boolean;\n}) {\n  const effects = structuredResolvers(card, "attack.grantNextAttackFlow");\n  if (!effects.length) return { handled: false, grant: false };\n  const values = {\n    differentZoneFromPreviousAttack: Boolean(context.differentZoneFromPreviousAttack),\n  };\n`,
  "remove Flow-draw state from next-Flow resolver",
);
await write("app/effect-resolvers.ts", resolvers);

let playtest = await read("app/playtest.tsx");
playtest = replaceOnce(
  playtest,
  `    differentZoneFromPreviousAttack: new Set(board.zonesPlayed.map((zone) => zone.toLocaleLowerCase())).size > 1,\n    flowUsedThisTurn: board.flowUsedThisTurn,\n`,
  `    differentZoneFromPreviousAttack: new Set(board.zonesPlayed.map((zone) => zone.toLocaleLowerCase())).size > 1,\n`,
  "stop suppressing Flow grants after the Flow draw",
);
await write("app/playtest.tsx", playtest);

let tests = await read("tests/attack-structured-resolvers-batch.test.mjs");
tests = replaceOnce(
  tests,
  `  flowUsedThisTurn: false,\n`,
  ``,
  "remove Flow draw state from test context",
);
tests = replaceOnce(
  tests,
  `  assert.deepEqual(structuredNextAttackFlow(snapFrontKick, nextFlowContext({ timing: "onHit" })), { handled: true, grant: true });\n  assert.deepEqual(structuredNextAttackFlow(snapFrontKick, nextFlowContext({ timing: "onHit", flowUsedThisTurn: true })), { handled: true, grant: false });\n`,
  `  assert.deepEqual(structuredNextAttackFlow(snapFrontKick, nextFlowContext({ timing: "onHit" })), { handled: true, grant: true });\n`,
  "align Snap Front Kick with Flow rules",
);
await write("tests/attack-structured-resolvers-batch.test.mjs", tests);

console.log("Corrected Snap Front Kick: Flow grant is independent of the once-per-turn Flow draw.");
