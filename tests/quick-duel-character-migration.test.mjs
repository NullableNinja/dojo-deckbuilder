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

test("temporary compatibility ownership only names real canonical structured resolvers", () => {
  for (const [helper, resolvers] of Object.entries(QUICK_DUEL_CHARACTER_COMPATIBILITY_RESOLVERS)) {
    assert.ok(resolvers.length > 0, `${helper} must own at least one resolver while it remains in Quick Duel`);
    for (const resolver of resolvers) assert.ok(canonicalResolvers.includes(resolver), `${helper} owns unknown resolver ${resolver}`);
  }
});

test("compatibility ownership mirrors the four direct Character helpers still used by Playtest", () => {
  for (const helper of Object.keys(QUICK_DUEL_CHARACTER_COMPATIBILITY_RESOLVERS)) {
    assert.match(playtestSource, new RegExp(`\\b${helper}\\s*\\(`), `${helper} should remain compatibility-owned only while Playtest calls it directly`);
  }
});

test("events that would double-apply current helpers are explicitly blocked from blind event publication", () => {
  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("attackDeclared"), true);
  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("damageIncoming"), true);
  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("equip"), true);
  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("cardPlayed"), false);
  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("hit"), false);
  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("block"), false);
});

test("Character migration ownership contains no fighter/card identity dispatch or printed-rules parsing", () => {
  assert.doesNotMatch(migrationSource, /DDB-CHR-CORE-|rulesText|fighterId\s*===|\.name\s*===/);
  assert.match(migrationSource, /characterRuntimeCoverage/);
});
