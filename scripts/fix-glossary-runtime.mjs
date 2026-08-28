import { readFile, writeFile } from "node:fs/promises";

const appPath = "app/companion-app.tsx";
const testPath = "tests/content-integrity.test.mjs";

let app = await readFile(appPath, "utf8");
let tests = await readFile(testPath, "utf8");

const marker = 'const ruleChapters = rulesData.chapters.filter((chapter) => chapter.number >= 1 && chapter.number <= 16);';
const dedupeBlock = `${marker}\nconst glossaryKey = (term: string) => term.normalize("NFKC").trim().replace(/\\s+/g, " ").toLocaleLowerCase();\nconst GLOSSARY_ENTRIES = Array.from(new Map(rulesData.glossary.map((entry) => [glossaryKey(entry.term), entry])).values()).sort((a, b) => a.term.localeCompare(b.term));`;

if (!app.includes("const GLOSSARY_ENTRIES =")) {
  if (!app.includes(marker)) throw new Error("Could not find glossary insertion point");
  app = app.replace(marker, dedupeBlock);
}

app = app.replaceAll("rulesData.glossary.filter(", "GLOSSARY_ENTRIES.filter(");
app = app.replaceAll("{rulesData.glossary.length} terms", "{GLOSSARY_ENTRIES.length} terms");

const regression = `\ntest("rendered glossary deduplicates terms at the UI boundary", async () => {\n  const source = await readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8");\n  assert.match(source, /const GLOSSARY_ENTRIES = Array\\.from\\(new Map/);\n  assert.match(source, /const glossaryKey =/);\n  assert.ok(!source.includes("rulesData.glossary.filter("), "Glossary rendering/search must use the deduplicated collection");\n  assert.ok(source.includes("{GLOSSARY_ENTRIES.length} terms"), "Glossary count must reflect the deduplicated collection");\n});\n`;

if (!tests.includes('test("rendered glossary deduplicates terms at the UI boundary"')) {
  tests += regression;
}

await writeFile(appPath, app);
await writeFile(testPath, tests);
console.log("Glossary rendering is now deduplicated at the UI boundary.");
