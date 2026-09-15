import { readFile, writeFile, unlink, readdir } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const read = (file) => readFile(path.join(root, file), "utf8");
const write = (file, value) => writeFile(path.join(root, file), value, "utf8");

function section(title, source, content) {
  return `\n\n/* ==========================================================================\n   ${title}\n   Consolidated from ${source}. Keep future rules in canonical JSON/runtime;\n   this section owns presentation only.\n   ========================================================================== */\n\n${content.trim()}\n`;
}

function insertBefore(source, anchor, marker, block) {
  if (source.includes(marker)) return source;
  const index = source.indexOf(anchor);
  if (index < 0) throw new Error(`Could not find comment anchor: ${anchor}`);
  return `${source.slice(0, index)}${block}\n\n${source.slice(index)}`;
}

async function removeUnusedPlaytestSymbols(source) {
  // Keep the public helper signature stable while making the intentionally-unused
  // parameter explicit to TypeScript and future readers.
  source = source.replace(
    "function stage3cDefenseContext(defender: Board, attacker: Board, defense: CardEntry, incomingAttack: CardEntry,",
    "function stage3cDefenseContext(defender: Board, attacker: Board, _defense: CardEntry, incomingAttack: CardEntry,",
  );

  const configPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");
  if (!configPath) throw new Error("tsconfig.json not found");
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath), {
    noUnusedLocals: true,
    noUnusedParameters: true,
  }, configPath);
  const playtestPath = path.join(root, "app/playtest.tsx");
  let version = 0;
  let current = source;

  const host = {
    getScriptFileNames: () => parsed.fileNames,
    getScriptVersion: (fileName) => fileName === playtestPath ? String(version) : "0",
    getScriptSnapshot: (fileName) => {
      if (fileName === playtestPath) return ts.ScriptSnapshot.fromString(current);
      if (!ts.sys.fileExists(fileName)) return undefined;
      return ts.ScriptSnapshot.fromString(ts.sys.readFile(fileName));
    },
    getCurrentDirectory: () => root,
    getCompilationSettings: () => parsed.options,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  };
  const languageService = ts.createLanguageService(host, ts.createDocumentRegistry());
  const unusedCodes = new Set([6133, 6192, 6196]);

  for (let pass = 0; pass < 30; pass += 1) {
    const diagnostics = languageService.getSemanticDiagnostics(playtestPath).filter((d) => unusedCodes.has(d.code));
    if (!diagnostics.length) break;
    const diagnostic = diagnostics[0];
    const fixes = languageService.getCodeFixesAtPosition(
      playtestPath,
      diagnostic.start ?? 0,
      (diagnostic.start ?? 0) + (diagnostic.length ?? 0),
      [diagnostic.code],
      {},
      {},
    );
    const fix = fixes.find((candidate) => candidate.changes.every((change) => path.resolve(change.fileName) === playtestPath));
    if (!fix) {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
      throw new Error(`No safe single-file TypeScript fix for unused diagnostic TS${diagnostic.code}: ${message}`);
    }
    const edits = fix.changes.flatMap((change) => change.textChanges).sort((a, b) => b.span.start - a.span.start);
    for (const edit of edits) {
      current = `${current.slice(0, edit.span.start)}${edit.newText}${current.slice(edit.span.start + edit.span.length)}`;
    }
    version += 1;
  }

  const remaining = languageService.getSemanticDiagnostics(playtestPath).filter((d) => unusedCodes.has(d.code));
  if (remaining.length) {
    throw new Error(`Unused playtest diagnostics remain: ${remaining.map((d) => `TS${d.code}`).join(", ")}`);
  }
  return current;
}

async function cleanPlaytest() {
  let source = await read("app/playtest.tsx");
  source = await removeUnusedPlaytestSymbols(source);

  // CSS is now owned by the single application entrypoint. Component files do
  // not establish cascade order by importing historical patch sheets.
  source = source.replace(/^import "\.\/combo-rack\.css";\r?\n/m, "");
  source = source.replace(/^import "\.\/playtest-production-mat\.css";\r?\n/m, "");

  source = insertBefore(
    source,
    "const CardInspector = lazy(",
    "QUICK DUEL REACT SHELL",
    `/**\n * QUICK DUEL REACT SHELL\n *\n * This file coordinates the browser experience; it is not the rules database.\n *\n * What belongs here:\n * - React state, dialogs, controls, and turn/phase orchestration.\n * - Translating player/AI actions into generic runtime and host calls.\n * - Presenting the canonical state returned by those hosts.\n *\n * What does NOT belong here:\n * - New card-specific rules, costs, stats, or effect definitions.\n * - New identity-specific mechanics that can be expressed in canonical JSON plus\n *   a generic resolver/host.\n *\n * Canonical truth lives under content/*.json and is generated into app/data/*.json.\n * A few identity/prose fallbacks remain below as migration debt so existing games\n * keep working; those sections are labeled. Do not expand them with new rules.\n */`,
  );

  source = insertBefore(
    source,
    "type CardEntry = {",
    "REACT-SIDE STATE SHAPES",
    `// -----------------------------------------------------------------------------\n// REACT-SIDE STATE SHAPES\n// These types describe the state the UI needs to render and coordinate Quick Duel.\n// They do not define canonical card/rule content; that comes from generated JSON.\n// -----------------------------------------------------------------------------`,
  );

  source = insertBefore(
    source,
    "function attackAllowedZones(",
    "COMBAT ORCHESTRATION ADAPTERS",
    `// -----------------------------------------------------------------------------\n// COMBAT ORCHESTRATION ADAPTERS\n// These helpers gather canonical/runtime facts into the shape the React duel needs.\n// Prefer adding behavior to generic resolvers/hosts rather than branching on card IDs\n// or names here.\n// -----------------------------------------------------------------------------`,
  );

  source = insertBefore(
    source,
    "function stage3cConsumableContext(",
    "STRUCTURED RUNTIME COMPATIBILITY BRIDGE",
    `// -----------------------------------------------------------------------------\n// STRUCTURED RUNTIME COMPATIBILITY BRIDGE\n// The stage3c* names are historical, but this code is live. It adapts current board\n// state to the generic structured-effect runtime. Do not delete it merely because\n// the migration stage is over; retire pieces only when their callers move to a\n// newer generic host.\n// -----------------------------------------------------------------------------`,
  );

  if (source.includes("function applyCardEffects(")) {
    source = insertBefore(
      source,
      "function applyCardEffects(",
      "LEGACY EFFECT COMPATIBILITY",
      `// -----------------------------------------------------------------------------\n// LEGACY EFFECT COMPATIBILITY — MIGRATION DEBT\n// Structured JSON/resolvers are authoritative. The prose/name fallbacks in this\n// section exist only so not-yet-migrated behavior keeps working. New mechanics must\n// NOT be added here; add them to canonical JSON and a reusable resolver/host.\n// -----------------------------------------------------------------------------`,
    );
  }

  if (source.includes("function locationAttackModifier(")) {
    source = insertBefore(
      source,
      "function locationAttackModifier(",
      "LEGACY LOCATION COMPATIBILITY",
      `// -----------------------------------------------------------------------------\n// LEGACY LOCATION COMPATIBILITY — MIGRATION DEBT\n// Any location-name/prose checks below are compatibility fallbacks, not the desired\n// architecture. New Location behavior belongs in canonical structured effects.\n// -----------------------------------------------------------------------------`,
    );
  }

  source = insertBefore(
    source,
    "function NativeCardArt(",
    "PRESENTATION COMPONENTS",
    `// -----------------------------------------------------------------------------\n// PRESENTATION COMPONENTS\n// From here, components turn already-resolved game state into the Paper-Fu UI.\n// Keep mechanics out of rendering helpers whenever possible.\n// -----------------------------------------------------------------------------`,
  );

  source = insertBefore(
    source,
    "function bestDefense(",
    "AI DECISION HELPERS",
    `// -----------------------------------------------------------------------------\n// AI DECISION HELPERS\n// The AI chooses among legal actions here; legality/effects still come from the\n// canonical runtime. AI heuristics may rank choices, but should not invent rules.\n// -----------------------------------------------------------------------------`,
  );

  const componentMatch = source.match(/export\s+(?:default\s+)?function\s+Playtest\w*\s*\(/);
  if (componentMatch) {
    source = insertBefore(
      source,
      componentMatch[0],
      "MAIN QUICK DUEL COORDINATOR",
      `// -----------------------------------------------------------------------------\n// MAIN QUICK DUEL COORDINATOR\n// This component owns browser state and delegates mechanical work to the helpers and\n// runtime hosts above. When this section becomes hard to follow, extract UI/state\n// orchestration — do not move canonical rules back into React.\n// -----------------------------------------------------------------------------`,
    );
  } else {
    throw new Error("Could not locate exported Playtest component for newcomer comment");
  }

  await write("app/playtest.tsx", source);
}

async function assertDeadBoardStylesheet() {
  const roots = ["app", "src"];
  const hits = [];
  async function walk(dir) {
    for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(rel);
      else if (rel !== "app/playtest-board-v4.css" && /\.(?:ts|tsx|js|jsx|mjs|css|html)$/.test(rel)) {
        const content = await read(rel);
        if (content.includes("playtest-board-v4.css")) hits.push(rel);
      }
    }
  }
  for (const dir of roots) await walk(dir);
  if (hits.length) throw new Error(`playtest-board-v4.css is still referenced by: ${hits.join(", ")}`);
}

async function consolidateCss() {
  await assertDeadBoardStylesheet();

  const playtestSources = [
    ["COMBO RACK", "app/combo-rack.css"],
    ["PRODUCTION MAT / BASE COMPONENTS", "app/playtest-production-mat.css"],
    ["PLAYTEST VFX", "app/playtest-vfx.css"],
    ["HAND CARD SURFACES", "app/playtest-card-surface.css"],
    ["MARKET CARD PRESENTATION", "app/playtest-market-card-polish.css"],
    ["FINAL QUICK DUEL LAYOUT AUTHORITY", "app/playtest-layout.css"],
  ];
  let playtestCss = `/*\n * DOJO DECKBUILDER — QUICK DUEL PRESENTATION\n *\n * One stylesheet owns the Quick Duel cascade. Sections are kept in deliberate\n * order: base surfaces first, final layout authority last. Mechanics remain in\n * canonical JSON/runtime code. Do not create another playtest-* fix stylesheet;\n * add presentation changes to the appropriate section here.\n */\n`;
  for (const [title, file] of playtestSources) playtestCss += section(title, file, await read(file));
  await write("app/playtest.css", playtestCss);

  let globals = await read("app/globals.css");
  const globalSources = [
    ["MOBILE SITE POLISH", "app/mobile-site-polish.css"],
    ["RULINGS + VARIANTS", "app/rulings-variants.css"],
    ["CARD LIBRARY ART CONSISTENCY", "app/card-library-art-consistency.css"],
    ["BELT CHECK TRAINING STRIPES", "app/belt-check-training-stripes.css"],
    ["SEARCH PAGE", "app/search-page.css"],
  ];
  for (const [title, file] of globalSources) globals += section(title, file, await read(file));
  await write("app/globals.css", globals);

  let inspector = await read("app/card-inspector.css");
  inspector += section("CARD INSPECTOR HOST INTEGRATION", "app/card-inspector-host-fix.css", await read("app/card-inspector-host-fix.css"));
  await write("app/card-inspector.css", inspector);

  let main = await read("src/main.tsx");
  const oldMainCss = [
    "../app/mobile-site-polish.css",
    "../app/card-inspector-host-fix.css",
    "../app/rulings-variants.css",
    "../app/playtest-card-surface.css",
    "../app/playtest-market-card-polish.css",
    "../app/card-library-art-consistency.css",
    "../app/playtest-layout.css",
    "../app/belt-check-training-stripes.css",
  ];
  for (const css of oldMainCss) main = main.replace(new RegExp(`^import \\\"${css.replace(/[.*+?^${}()|[\\]\\]/g, "\\\\$&")}\\\";\\r?\\n`, "m"), "");
  if (!main.includes('import "../app/playtest.css";')) {
    main = main.replace('import "../app/card-inspector.css";\n', 'import "../app/card-inspector.css";\nimport "../app/playtest.css";\n');
  }
  await write("src/main.tsx", main);

  let search = await read("app/search-page.tsx");
  search = search.replace(/^import "\.\/search-page\.css";\r?\n/m, "");
  await write("app/search-page.tsx", search);

  let vfx = await read("src/playtest-vfx-runtime.ts");
  vfx = vfx.replace(/^import "\.\.\/app\/playtest-vfx\.css";\r?\n/m, "");
  await write("src/playtest-vfx-runtime.ts", vfx);

  const absorbed = [
    "app/belt-check-training-stripes.css",
    "app/card-inspector-host-fix.css",
    "app/card-library-art-consistency.css",
    "app/combo-rack.css",
    "app/mobile-site-polish.css",
    "app/playtest-board-v4.css",
    "app/playtest-card-surface.css",
    "app/playtest-layout.css",
    "app/playtest-market-card-polish.css",
    "app/playtest-production-mat.css",
    "app/playtest-vfx.css",
    "app/rulings-variants.css",
    "app/search-page.css",
  ];
  for (const file of absorbed) await unlink(path.join(root, file));
}

await cleanPlaytest();
await consolidateCss();
console.log("Playtest dead-code/comment cleanup and CSS consolidation applied.");
