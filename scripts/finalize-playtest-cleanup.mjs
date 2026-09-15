import { readFile, writeFile } from "node:fs/promises";

const path = "app/playtest.tsx";
let source = await readFile(path, "utf8");

source = source.replace(
  '          const attack = isAttack(card); const defense = isDefense(card); const permanent = isPermanent(card);           const choosingDiscard = Boolean(match.pendingDiscard);',
  '          const attack = isAttack(card);\n          const defense = isDefense(card);\n          const permanent = isPermanent(card);\n          const choosingDiscard = Boolean(match.pendingDiscard);',
);
source = source.replace(
  'const plan = equipmentActivationPlan(item);  const ownLoadout = inspectedBoard === player;',
  'const plan = equipmentActivationPlan(item); const ownLoadout = inspectedBoard === player;',
);
source = source.replace(
  '}\n\n\n// -----------------------------------------------------------------------------\n// PRESENTATION COMPONENTS',
  '}\n\n// -----------------------------------------------------------------------------\n// PRESENTATION COMPONENTS',
);

await writeFile(path, source, "utf8");
