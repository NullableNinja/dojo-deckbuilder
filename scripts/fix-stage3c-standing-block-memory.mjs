import { readFile, writeFile } from "node:fs/promises";

const path = "app/playtest.tsx";
let source = await readFile(path, "utf8");
const startMarker = "  const declareAttack = () => setMatch((current) => {";
const endMarker = "\n\n  const playSupport =";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start + startMarker.length);
if (start < 0 || end < 0) throw new Error("declareAttack segment not found");

let segment = source.slice(start, end);
const anchor = "    nextAi = stage3cConsumeIncomingAttackStatuses(nextAi);\n";
if (!segment.includes(anchor)) throw new Error("normal Attack incoming-status anchor not found");
if (segment.includes("if (!hit && !targetInvalidated) nextAi = { ...nextAi, blockedSinceLastTurn: true, blockedThisRound: true };")) {
  console.log("Standing Block memory already patched.");
  process.exit(0);
}
segment = segment.replace(
  anchor,
  `${anchor}    if (!hit && !targetInvalidated) nextAi = { ...nextAi, blockedSinceLastTurn: true, blockedThisRound: true };\n`,
);
source = source.slice(0, start) + segment + source.slice(end);
await writeFile(path, source);
console.log("Restored standing-DEF/Armor Block memory for normal player Attacks.");
