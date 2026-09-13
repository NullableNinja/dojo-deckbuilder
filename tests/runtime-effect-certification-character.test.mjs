import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  characterResolverHostEvidence,
  classifyCharacterResolver,
  parseCharacterCompatibilityOwnership,
  parseCharacterResolverEvents,
} from "../scripts/runtime-effect-certification-character.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [characterRuntime, migration, playtest, quickDuelHost] = await Promise.all([
  read("app/character-runtime.ts"),
  read("app/quick-duel-character-migration.ts"),
  read("app/playtest.tsx"),
  read("app/quick-duel-playtest-host.ts"),
]);

test("Character certification derives events from resolverEvents instead of canonical trigger prose", () => {
  const resolverEvents = parseCharacterResolverEvents(characterRuntime);
  assert.deepEqual(resolverEvents.get("character.equipDiscardPermanentUntilHide"), ["initiate"]);
  assert.deepEqual(resolverEvents.get("character.revealReplacementOnceGame"), ["sceneChange", "purchaseAttempt"]);
  assert.deepEqual(resolverEvents.get("character.green.linkedChosenCardOutcomeCycle"), ["hit", "block"]);
});

test("Character certification respects explicit compatibility-helper ownership", () => {
  const ownership = parseCharacterCompatibilityOwnership(migration);
  assert.equal(ownership.get("character.firstUnarmedAttack"), "characterAttackModifier");
  assert.equal(ownership.get("character.cannotEquipWeapons"), "characterCanEquip");
  assert.equal(ownership.get("character.firstHitDamagePrevention"), "characterDamageReduction");

  assert.deepEqual(
    classifyCharacterResolver("character.firstUnarmedAttack", characterRuntime, migration),
    {
      resolver: "character.firstUnarmedAttack",
      events: ["attackDeclared"],
      owner: "compatibility-helper",
      helper: "characterAttackModifier",
    },
  );
});

test("live Character host evidence distinguishes compatibility helpers from event-runtime publication", () => {
  const compatible = characterResolverHostEvidence({
    resolver: "character.firstUnarmedAttack",
    characterRuntimeSource: characterRuntime,
    migrationSource: migration,
    playtestSource: playtest,
    quickDuelHostSource: quickDuelHost,
  });
  assert.equal(compatible.owner, "compatibility-helper");
  assert.equal(compatible.hostLive, true);

  const ducktape = characterResolverHostEvidence({
    resolver: "character.equipDiscardPermanentUntilHide",
    characterRuntimeSource: characterRuntime,
    migrationSource: migration,
    playtestSource: playtest,
    quickDuelHostSource: quickDuelHost,
  });
  assert.equal(ducktape.owner, "event-runtime");
  assert.deepEqual(ducktape.events, ["initiate"]);
  assert.deepEqual(ducktape.liveEvents, ["initiate"]);
  assert.equal(ducktape.hostLive, true);

  const hitRuntime = characterResolverHostEvidence({
    resolver: "character.xpTrailFirstHit",
    characterRuntimeSource: characterRuntime,
    migrationSource: migration,
    playtestSource: playtest,
    quickDuelHostSource: quickDuelHost,
  });
  assert.equal(hitRuntime.owner, "event-runtime");
  assert.deepEqual(hitRuntime.events, ["hit"]);
  assert.deepEqual(hitRuntime.liveEvents, ["hit"]);
  assert.equal(hitRuntime.hostLive, true);

  const blockRuntime = characterResolverHostEvidence({
    resolver: "character.reversalAfterBlock",
    characterRuntimeSource: characterRuntime,
    migrationSource: migration,
    playtestSource: playtest,
    quickDuelHostSource: quickDuelHost,
  });
  assert.equal(blockRuntime.owner, "event-runtime");
  assert.deepEqual(blockRuntime.events, ["block"]);
  assert.deepEqual(blockRuntime.liveEvents, ["block"]);
  assert.equal(blockRuntime.hostLive, true);
});
