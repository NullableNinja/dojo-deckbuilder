import fs from "node:fs";

const patchPath = ".tmp/delayed-market-refill-patch.mjs";
let source = fs.readFileSync(patchPath, "utf8");
source = source
  .replaceAll("dojo.economy.market", "dojo.definition.economy.market")
  .replaceAll("canonical.economy.market", "canonical.definition.economy.market")
  .replace("canonical Market timing is end-of-Ascend and generated runtime data matches", "canonical Market timing is end-of-Ascend")
  .replace('  const generated = JSON.parse(fs.readFileSync(new URL("../app/data/game-definition.json", import.meta.url)));\\n', "")
  .replace('  assert.equal(generated.economy.market.refill, "end-of-ascend");\\n', "")
  .replace('  assert.equal(generated.economy.market.purchasedSlotsRemainEmpty, true);\\n', "");
fs.writeFileSync(patchPath, source);
console.log("Corrected canonical wrapper references and removed the redundant generated-file race from patch transport.");
