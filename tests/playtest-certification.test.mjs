import assert from "node:assert/strict";
import test from "node:test";
import { certifyPlaytest } from "../scripts/playtest-certification.mjs";

test("Playtest certifies every catalog card through canonical structured execution", async () => {
  const report = await certifyPlaytest();
  assert.deepEqual(report.failures, []);
  assert.equal(report.catalogCards, report.registeredCards);
  assert.equal(report.catalogCards, report.fullyPlannedCards);
  assert.equal(report.structuredEffects, report.supportedEffects);
  assert.equal(report.unsupportedEffects, 0);
  assert.equal(report.emptyCanonicalEntries, report.emptyStarterEntries);
  assert.equal(report.unsupportedCombos.length, 0);
});
