import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");

test("Quick Duel exposes generic Character runtime choices instead of a Ducktape-specific UI", () => {
  assert.match(source, /resolveQuickDuelPlaytestCharacterChoice/);
  assert.match(source, /kind: "character-runtime"/);
  assert.match(source, /withPlayerCharacterChoice/);
  assert.ok(
    (source.match(/"onHide"/g) ?? []).length >= 2,
    "player and AI Hide must publish through the Character runtime"
  );
  assert.doesNotMatch(source, /const borrowEquipment\s*=/);
  assert.doesNotMatch(source, /playerFighter\.name === "Sensei Ducktape"/);
  assert.doesNotMatch(source, /ducktape-tray/);
});

test("player Character choices block Initiate progression and use the shared pending-choice interaction layer", () => {
  assert.match(source, /current\?\.phase === "player-initiate" && !current\.pendingChoice/);
  assert.match(source, /type CharacterRuntimePendingChoice = Extract<PendingChoice, \{ kind: "character-runtime" \}>/);
  assert.match(source, /characterRuntimePendingChoice\(match\.pendingChoice\)/);
  assert.match(source, /const applyCharacterRuntimeChoice =/);
  assert.match(source, /current\.pendingChoice\.kind === "character-runtime"/);
  assert.match(source, /return applyCharacterRuntimeChoice\(current, selection\)/);
  assert.match(source, /onClick=\{skipPendingChoice\}>Skip this optional effect/);
});

test("Character choices survive round transitions and take precedence over reveal reactions", () => {
  assert.match(source, /pendingChoice: hostedInitiate\.pendingChoice \?\? null/);
  assert.match(source, /!advanced\.pendingChoice && sceneChanges && lucky/);
  assert.match(source, /!advanced\.pendingChoice && marketRefreshes && lucky/);
});

// This seam is intentionally source-checked after reconciling the recovery branch with current main.
