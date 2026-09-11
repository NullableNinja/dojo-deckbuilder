import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cards = JSON.parse(await readFile(path.join(ROOT, "content/cards.json"), "utf8")).cards;

const expectedFamilies = new Map([
  ["Starter", { count: 11, directory: "starters" }],
  ["Location", { count: 53, directory: "locations" }],
]);

for (const [cardType, expected] of expectedFamilies) {
  test(`${cardType} cards publish complete production artwork`, async () => {
    const family = cards.filter((card) => card.cardType === cardType);
    assert.equal(family.length, expected.count);

    for (const card of family) {
      assert.match(
        card.image ?? "",
        new RegExp(`^/cards/${expected.directory}/${card.catalogId.toLowerCase()}_[a-z0-9-]+\\.webp$`),
        `${card.catalogId} must reference its canonical production card face`,
      );

      const assetPath = path.join(ROOT, "app/assets", card.image);
      const asset = await stat(assetPath);
      assert.ok(asset.isFile(), `${card.catalogId} artwork must be a file`);
      assert.ok(asset.size > 1_000, `${card.catalogId} artwork must not be empty or truncated`);
    }
  });
}
