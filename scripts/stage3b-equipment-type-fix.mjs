import { readFile, writeFile } from "node:fs/promises";

const path = "app/playtest.tsx";
let text = await readFile(path, "utf8");

if (!text.includes("usedConsumableThisRound?: boolean;")) {
  const marker = "  combatDamageEventsThisRound?: number;\n";
  if (!text.includes(marker)) throw new Error("Unable to locate Board round-state marker");
  text = text.replace(marker, `${marker}  usedConsumableThisRound?: boolean;\n`);
}

if (!/type PendingDiscard = \{[\s\S]*?sourceFollowup\?: boolean;[\s\S]*?\};/.test(text)) {
  const marker = "type PendingDiscard = {\n  sourceCardId: string;\n  remaining: number;\n};";
  if (!text.includes(marker)) throw new Error("Unable to locate PendingDiscard type");
  text = text.replace(marker, "type PendingDiscard = {\n  sourceCardId: string;\n  remaining: number;\n  sourceFollowup?: boolean;\n};");
}

await writeFile(path, text, "utf8");
