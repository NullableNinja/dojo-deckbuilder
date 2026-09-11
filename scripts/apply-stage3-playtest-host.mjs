import { readFile, writeFile } from "node:fs/promises";

// One-time guarded authoring migration for the isolated Stage 3 feature branch.
const path = new URL("../app/playtest.tsx", import.meta.url);
let source = await readFile(path, "utf8");

function replaceOnce(label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: expected source fragment was not found; refusing to edit playtest.tsx`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: source fragment matched more than once; refusing an ambiguous edit`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  "React SetStateAction import",
  'import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties, type DragEvent } from "react";',
  'import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties, type DragEvent, type SetStateAction } from "react";',
);

replaceOnce(
  "Quick Duel Playtest host import",
  'import { characterAllowedAttackZones, characterAttackModifier, characterCanEquip, characterDamageReduction } from "./character-runtime";\n',
  'import { characterAllowedAttackZones, characterAttackModifier, characterCanEquip, characterDamageReduction } from "./character-runtime";\nimport { applyQuickDuelPlaytestTransition } from "./quick-duel-playtest-host";\n',
);

const oldMatchState = `  const [match, setMatch] = useState<Match | null>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("ddb-field-match") ?? "null") as Match | null;
      const validSavedMatch = saved?.schema === 8 && saved?.player?.fighterId && saved?.ai?.fighterId && saved.turnOrder?.length === 2 && cardFor(saved.player.fighterId) && cardFor(saved.ai.fighterId) ? saved : null;
      return validSavedMatch ? normalizePendingDamageChoice(validSavedMatch) : null;
    } catch { return null; }
  });`;

const hostedMatchState = `  const [match, setRawMatch] = useState<Match | null>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("ddb-field-match") ?? "null") as Match | null;
      const validSavedMatch = saved?.schema === 8 && saved?.player?.fighterId && saved?.ai?.fighterId && saved.turnOrder?.length === 2 && cardFor(saved.player.fighterId) && cardFor(saved.ai.fighterId) ? saved : null;
      return validSavedMatch ? normalizePendingDamageChoice(validSavedMatch) : null;
    } catch { return null; }
  });
  const setMatch = (update: SetStateAction<Match | null>) => setRawMatch((previous) => {
    const next = typeof update === "function" ? update(previous) : update;
    return previous && next ? applyQuickDuelPlaytestTransition(previous, next, cardFor) : next;
  });`;

replaceOnce("central Match transition host", oldMatchState, hostedMatchState);

if (!source.includes("applyQuickDuelPlaytestTransition(previous, next, cardFor)")) {
  throw new Error("Playtest transition host was not installed");
}

await writeFile(path, source);
console.log("Applied guarded Stage 3 Playtest transition-host migration.");
