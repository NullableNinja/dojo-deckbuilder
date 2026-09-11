import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { SUPPORTED_COMBO_REQUIREMENTS } from "../app/combo-runtime.ts";

const schema = JSON.parse(await readFile(new URL("../content/combo-requirements.schema.json", import.meta.url), "utf8"));
const checker = await readFile(new URL("../scripts/check-generated-game-data.mjs", import.meta.url), "utf8");

function schemaKinds() {
  return [...(schema?.$defs?.requirement?.properties?.kind?.enum ?? [])].sort();
}

function checkerKinds() {
  const match = checker.match(/const comboRequirementKinds = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(match, "checker must declare the canonical Combo requirement vocabulary");
  return [...match[1].matchAll(/["']([^"']+)["']/g)].map((entry) => entry[1]).sort();
}

test("Combo requirement schema, checker, and runtime expose one identical vocabulary", () => {
  const runtimeKinds = [...SUPPORTED_COMBO_REQUIREMENTS].sort();
  const canonicalSchemaKinds = schemaKinds();
  const canonicalCheckerKinds = checkerKinds();
  assert.deepEqual(runtimeKinds, canonicalSchemaKinds, "runtime requirement vocabulary drifted from canonical schema");
  assert.deepEqual(canonicalCheckerKinds, canonicalSchemaKinds, "game:check requirement vocabulary drifted from canonical schema");
});
