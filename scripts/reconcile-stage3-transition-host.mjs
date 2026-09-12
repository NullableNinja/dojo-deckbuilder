import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../app/playtest.tsx", import.meta.url);
let source = await readFile(path, "utf8");

function replaceOnce(label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: expected source fragment not found`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: source fragment matched more than once`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  "React SetStateAction import",
  'import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties, type DragEvent } from "react";',
  'import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties, type DragEvent, type SetStateAction } from "react";',
);

replaceOnce(
  "Quick Duel playtest host import",
  'import { characterAllowedAttackZones, characterAttackModifier, characterCanEquip, characterDamageReduction } from "./character-runtime";\nimport type { PlaytestCombatExchange } from "../src/playtest-events";',
  'import { characterAllowedAttackZones, characterAttackModifier, characterCanEquip, characterDamageReduction } from "./character-runtime";\nimport { applyQuickDuelPlaytestTransition } from "./quick-duel-playtest-host";\nimport type { PlaytestCombatExchange } from "../src/playtest-events";',
);

replaceOnce(
  "unified match transition wrapper",
  `  const [match, setMatch] = useState<Match | null>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("ddb-field-match") ?? "null") as Match | null;
      const validSavedMatch = saved?.schema === 8 && saved?.player?.fighterId && saved?.ai?.fighterId && saved.turnOrder?.length === 2 && cardFor(saved.player.fighterId) && cardFor(saved.ai.fighterId) ? saved : null;
      return validSavedMatch ? normalizePendingDamageChoice(validSavedMatch) : null;
    } catch { return null; }
  });`,
  `  const [match, setRawMatch] = useState<Match | null>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("ddb-field-match") ?? "null") as Match | null;
      const validSavedMatch = saved?.schema === 8 && saved?.player?.fighterId && saved?.ai?.fighterId && saved.turnOrder?.length === 2 && cardFor(saved.player.fighterId) && cardFor(saved.ai.fighterId) ? saved : null;
      return validSavedMatch ? normalizePendingDamageChoice(validSavedMatch) : null;
    } catch { return null; }
  });
  const setMatch = (update: SetStateAction<Match | null>) => setRawMatch((previous) => {
    const next = typeof update === "function" ? update(previous) : update;
    return previous && next ? applyQuickDuelPlaytestTransition(previous, next, cardFor) : next;
  });`,
);

if (!source.includes("applyQuickDuelPlaytestTransition(previous, next, cardFor)")) throw new Error("transition wrapper was not installed");
if (source.includes("const [match, setMatch] = useState<Match | null>")) throw new Error("raw setMatch state setter survived transition migration");

await writeFile(path, source);
console.log("Installed unified Quick Duel transition wrapper on the current Playtest.");
