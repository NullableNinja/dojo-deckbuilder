import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  QUICK_DUEL_CHARACTER_COMPATIBILITY_RESOLVERS,
  quickDuelCharacterEventHasCompatibilityConflict,
  quickDuelCharacterResolverOwnership,
  quickDuelCompatibilityOwnedResolvers,
  quickDuelEventRuntimeOwnedResolvers,
} from "../app/quick-duel-character-migration.ts";
import { characterRuntimeCoverage } from "../app/character-runtime.ts";

const migrationSource = await readFile(new URL("../app/quick-duel-character-migration.ts", import.meta.url), "utf8");
const playtestSource = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");

const canonicalResolvers = [...new Set(characterRuntimeCoverage().flatMap((entry) => entry.resolvers))].sort();

test("every canonical Core Character resolver has exactly one migration owner", () => {
  const ownership = quickDuelCharacterResolverOwnership();
  assert.deepEqual(ownership.map((entry) => entry.resolver), canonicalResolvers);
  assert.equal(new Set(ownership.map((entry) => entry.resolver)).size, ownership.length);
  assert.ok(ownership.every((entry) => entry.owner === "compatibility-helper" || entry.owner === "event-runtime"));

  const compatibility = quickDuelCompatibilityOwnedResolvers();
  const eventRuntime = quickDuelEventRuntimeOwnedResolvers();
  assert.deepEqual([...compatibility, ...eventRuntime].sort(), canonicalResolvers);
  assert.deepEqual(compatibility.filter((resolver) => eventRuntime.includes(resolver)), []);
});

test("Stage 3E leaves no Character resolver in temporary compatibility ownership", () => {
  assert.deepEqual(QUICK_DUEL_CHARACTER_COMPATIBILITY_RESOLVERS, {});
  assert.deepEqual(quickDuelCompatibilityOwnedResolvers(), []);
  assert.deepEqual(quickDuelEventRuntimeOwnedResolvers(), canonicalResolvers);
});

test("Playtest no longer calls the temporary Character compatibility helpers", () => {
  assert.doesNotMatch(playtestSource, /characterAllowedAttackZones\s*\(/);
  assert.doesNotMatch(playtestSource, /characterAttackModifier\s*\(/);
});

test("events that would double-apply current helpers are explicitly blocked from blind event publication", () => {
  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("attackDeclared"), false);
  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("damageIncoming"), false);
  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("equip"), false);
  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("cardPlayed"), false);
  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("hit"), false);
  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("block"), false);
});

test("Character migration ownership contains no fighter/card identity dispatch or printed-rules parsing", () => {
  assert.doesNotMatch(migrationSource, /DDB-CHR-CORE-|rulesText|fighterId\s*===|\.name\s*===/);
  assert.match(migrationSource, /characterRuntimeCoverage/);
});
