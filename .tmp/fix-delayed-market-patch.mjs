import fs from "node:fs";

const patchPath = ".tmp/delayed-market-refill-patch.mjs";
let source = fs.readFileSync(patchPath, "utf8");
source = source
  .replaceAll("dojo.economy.market", "dojo.definition.economy.market")
  .replaceAll("canonical.economy.market", "canonical.definition.economy.market");
fs.writeFileSync(patchPath, source);
console.log("Corrected canonical definition wrapper references in patch transport.");
