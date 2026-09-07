import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../app/card-inspector-host-fix.css", import.meta.url), "utf8");
const main = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");

test("equipment fallback art is anchored to the thumbnail instead of the loadout", () => {
  assert.match(
    css,
    /\.equipment-slot-art\s*\{[\s\S]*?position:\s*relative\s*!important;[\s\S]*?width:\s*43px;[\s\S]*?height:\s*59px;[\s\S]*?overflow:\s*hidden\s*!important;/,
  );
  assert.match(
    css,
    /\.equipment-slot-art\s*>\s*\.native-card-art\s*\{[\s\S]*?position:\s*absolute\s*!important;[\s\S]*?inset:\s*0\s*!important;[\s\S]*?width:\s*100%\s*!important;[\s\S]*?height:\s*100%\s*!important;[\s\S]*?min-height:\s*0\s*!important;/,
  );
});

test("thumbnail containment override loads after the legacy playtest cascade", () => {
  const hostFix = main.indexOf('import "../app/card-inspector-host-fix.css";');
  const globals = main.indexOf('import "../app/globals.css";');
  const recovery = main.indexOf('import "../app/playtest-functional-recovery.css";');
  assert.ok(hostFix > globals);
  assert.ok(hostFix > recovery);
});
