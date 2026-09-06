import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const sourcePath = "scripts/stage3b-attack-eleven-patch.mjs";
let source = await readFile(sourcePath, "utf8");
const before = '  1,\n  "player conditional target Hit debuff",';
const after = '  2,\n  "player conditional target Hit debuff",';
const count = source.split(before).length - 1;
if (count !== 1) throw new Error(`Expected one player target-debuff patch count marker, found ${count}`);
source = source.replace(before, after);
const tempPath = "/tmp/stage3b-attack-eleven-patch.mjs";
await writeFile(tempPath, source, "utf8");
await import(pathToFileURL(tempPath).href);
