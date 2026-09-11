import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function sourceFiles(dirUrl) {
  const entries = await readdir(dirUrl, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dirUrl);
    if (entry.isDirectory()) {
      if (entry.name === "data" || entry.name === "assets") continue;
      files.push(...await sourceFiles(child));
    } else if (/\.(?:ts|tsx|mts|cts)$/i.test(entry.name)) {
      files.push(child);
    }
  }
  return files;
}

function relative(url) {
  return decodeURIComponent(url.pathname.slice(root.pathname.length));
}

test("runtime TypeScript contains no Core catalog-id rule dispatch", async () => {
  const violations = [];
  for (const url of await sourceFiles(new URL("app/", root))) {
    const source = await readFile(url, "utf8");
    const lines = source.split("\n");
    lines.forEach((line, index) => {
      const ids = line.match(/DDB-(?:STA|ATK|DEF|KAT|CON|CMB|LOC|CHR|DEQ|GEA|WPN)-CORE-\d{3}/g) ?? [];
      for (const id of ids) violations.push(`${relative(url)}:${index + 1}: ${id}: ${line.trim()}`);
    });
  }
  if (violations.length) console.log("CORE_ID_RUNTIME_DISPATCH", JSON.stringify(violations, null, 2));
  assert.deepEqual(violations, []);
});
