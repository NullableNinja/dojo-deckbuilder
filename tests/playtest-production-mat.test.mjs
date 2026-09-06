import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const [source, styles, runtime, events] = await Promise.all([
  readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/playtest-production-mat.css", import.meta.url), "utf8"),
  readFile(new URL("../src/playtest-vfx-runtime.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/playtest-events.ts", import.meta.url), "utf8"),
]);

test("production mat implements the approved tabletop, fighter, and combat-stage structure", () => {
  assert.match(source, /import\.meta\.glob<string>\("\.\/assets\/fighters\/\*\.webp"/);
  assert.match(source, /function FighterPanel/);
  assert.match(source, /living-fighter-card/);
  assert.match(source, /fighter-card-illustration/);
  assert.match(source, /fighter-hp-track/);
  assert.match(source, /fighter-equipment-tabs/);
  assert.match(source, /function CombatStage/);
  assert.match(source, /className="clash-field"/);
  assert.match(styles, /\.playtest-shell--live \.playtest-table \{[^}]*height: 560px/);
  assert.match(styles, /\.fighter-column \{[^}]*overflow-y: auto/);
  assert.match(styles, /\.playtest-shell--live \.combat-stage \{[^}]*overflow: hidden/);
  assert.match(styles, /\.living-fighter-card\.is-enemy/);
});

test("cards support click-first play, optional drag, and inspectable hybrid records", () => {
  assert.match(source, /draggable=\{canDrag\}/);
  assert.match(source, /dataTransfer\.setData\("application\/x-dojo-card", card\.id\)/);
  assert.match(source, /onDrop=\{handleDrop\}/);
  assert.match(source, /aria-label=\{`Use \$\{card\.name\}`\}/);
  assert.match(source, /className="play-card-art-window"/);
  assert.match(source, /className="play-card-fallback"/);
  assert.match(source, /className="play-card-inspect"/);
});

test("Market, Location, receipts, grouped logs, coaching, and motion remain visible systems", () => {
  assert.match(source, /function AcquisitionRail/);
  assert.match(source, /match\.market\.map\(\(id, index\)/);
  assert.match(styles, /\.market-rail-cards \{[^}]*repeat\(7/);
  assert.match(source, /location-\$\{locationTheme\(currentLocation\)\}/);
  assert.match(source, /function ImpactReadout/);
  assert.match(source, /match\.lastExchange/);
  assert.match(source, /function groupedFightLog/);
  assert.match(source, /contextual-coach-slip/);
  assert.match(source, /motion-\$\{settings\.motion\}/);
  assert.match(styles, /\.playtest-shell\.motion-off \*/);
});

test("combat VFX anchors and semantic events use the typed living-fighter contract", () => {
  assert.match(runtime, /living-fighter-card\[data-side="\$\{side\}"\]/);
  assert.match(events, /export type PlaytestCombatExchange/);
  assert.match(events, /exchange\.id !== previous\.lastExchange\?\.id/);
});

test("every canonical fighter has a supplied transparent-stage illustration", async () => {
  const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
  const fighterNames = cards.filter((card) => card.cardType === "Character").map((card) => card.name);
  const expectedSlugs = fighterNames.map((name) => name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  const assets = await readdir(new URL("../app/assets/fighters/", import.meta.url));
  const assetSlugs = new Set(assets.filter((file) => file.endsWith(".webp")).map((file) => file.replace(/\.webp$/i, "")));
  const missing = expectedSlugs.filter((slug) => !assetSlugs.has(slug));

  assert.deepEqual(missing, []);
  assert.equal(assetSlugs.size, expectedSlugs.length);
});
