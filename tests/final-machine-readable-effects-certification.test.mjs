import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { effectPlanForCard } from "../app/card-effects.ts";
import { kataCommandsForHost } from "../app/kata-playtest-bridge.ts";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const readText = async (path) => readFile(new URL(path, root), "utf8");

const cards = (await readJson("content/cards.json")).cards ?? [];
const aggregate = (await readJson("content/card-effects.json")).cards ?? {};
const vocabulary = await readJson("content/effects.json");
const playtest = await readText("app/playtest.tsx");
const resolverFacade = await readText("app/effect-resolvers.ts");
const kataBridge = await readText("app/kata-playtest-bridge.ts");

const familyFiles = new Map([
  ["Starter", "starters.json"],
  ["Attack", "attacks.json"],
  ["Defense", "defenses.json"],
  ["Kata", "katas.json"],
  ["Consumable", "consumables.json"],
  ["Equipment", "equipment.json"],
  ["Combo", "combos.json"],
  ["Character", "characters.json"],
  ["Location", "locations.json"],
]);

function familyOf(card) {
  const id = String(card.catalogId ?? "").toUpperCase();
  const subtype = String(card.subtype ?? "").toLowerCase();
  const type = String(card.cardType ?? "").toLowerCase();
  if (id.includes("-STA-")) return "Starter";
  if (id.includes("-ATK-")) return "Attack";
  if (id.includes("-DEF-")) return "Defense";
  if (id.includes("-KAT-")) return "Kata";
  if (id.includes("-CON-")) return "Consumable";
  if (id.includes("-CMB-")) return "Combo";
  if (id.includes("-LOC-")) return "Location";
  if (id.includes("-CHR-")) return "Character";
  if (id.includes("-DEQ-") || id.includes("-GEA-") || id.includes("-WPN-")) return "Equipment";
  if (subtype === "attack") return "Attack";
  if (subtype === "defense") return "Defense";
  if (subtype === "kata") return "Kata";
  if (subtype === "consumable") return "Consumable";
  if (["weapon", "gear", "defense equipment"].includes(subtype)) return "Equipment";
  if (type === "combo") return "Combo";
  if (type === "location") return "Location";
  if (type === "character") return "Character";
  return null;
}

const coreCards = cards.filter((card) => String(card.catalogId ?? "").includes("-CORE-") && familyFiles.has(familyOf(card)));
const coreByFamily = new Map([...familyFiles.keys()].map((family) => [family, coreCards.filter((card) => familyOf(card) === family)]));

function matches(source, expression) {
  return [...source.matchAll(expression)].map((match) => match[0]);
}

function kataFactsFor(effect) {
  const facts = {};
  for (const condition of effect.conditions ?? []) {
    const kind = String(condition.kind ?? "");
    if (kind === "beltAtLeast") facts.belt = condition.value;
    else if (kind === "minimumDamage") facts.damage = condition.value;
    else if (kind === "requiresCondition") facts[String(condition.value ?? "")] = true;
    else facts[kind] = condition.value;
  }
  return facts;
}

test("every canonical Core gameplay family has one authoritative structured registry entry", async () => {
  const summary = {};
  for (const [family, file] of familyFiles) {
    const registry = (await readJson(`content/card-effects/${file}`)).cards ?? {};
    const canonical = coreByFamily.get(family) ?? [];
    const canonicalIds = canonical.map((card) => card.catalogId).sort();
    const registryIds = Object.keys(registry).sort();
    summary[family] = { cards: canonicalIds.length, effectBearing: registryIds.filter((id) => (registry[id].effects ?? []).length > 0).length };
    assert.deepEqual(registryIds, canonicalIds, `${family} registry must exactly cover canonical Core ${family} cards`);
    for (const card of canonical) {
      assert.equal(registry[card.catalogId].name, card.name, `${card.catalogId} structured identity drifted`);
      assert.deepEqual(aggregate[card.catalogId]?.name, card.name, `${card.catalogId} missing/drifted in generated aggregate`);
    }
  }
  console.log("FINAL_CORE_EFFECT_INVENTORY", JSON.stringify(summary));
});

test("every structured Core effect is executable and references valid canonical vocabulary", () => {
  const failures = [];
  const knownEffects = new Set(Object.keys(vocabulary.effects ?? {}));
  for (const card of coreCards) {
    const entry = aggregate[card.catalogId];
    if (!entry) {
      failures.push(`${card.catalogId}: missing aggregate entry`);
      continue;
    }
    const effects = entry.effects ?? [];
    const plan = effectPlanForCard(card);
    if (effects.length && !(plan.effects.length || plan.dedicated.length)) failures.push(`${card.catalogId}: structured effects produce no executable plan`);
    for (const unsupported of plan.unsupported ?? []) failures.push(`${card.catalogId}: unsupported ${unsupported}`);
    for (const effect of effects) {
      if (effect.effect && !knownEffects.has(effect.effect)) failures.push(`${card.catalogId}/${effect.id ?? "anonymous"}: unknown effect ${effect.effect}`);
      if (!effect.trigger) failures.push(`${card.catalogId}/${effect.id ?? "anonymous"}: missing trigger`);
      if (!effect.action) failures.push(`${card.catalogId}/${effect.id ?? "anonymous"}: missing hydrated action`);
    }
  }
  assert.deepEqual(failures, []);
});

test("all Core Kata effects are reachable through the structured Quick Duel host bridge", async () => {
  const registry = (await readJson("content/card-effects/katas.json")).cards ?? {};
  const canonical = coreByFamily.get("Kata") ?? [];
  assert.equal(canonical.length, 62);
  const failures = [];
  for (const card of canonical) {
    for (const effect of registry[card.catalogId]?.effects ?? []) {
      const commands = kataCommandsForHost(card, effect.trigger, kataFactsFor(effect));
      if (!commands.some((command) => command.effectId === effect.id)) failures.push(`${card.catalogId}/${effect.id}`);
    }
  }
  assert.deepEqual(failures, []);
  assert.match(resolverFacade, /isCoreKataCard/);
  assert.match(resolverFacade, /kataDeckLookPlanForHost/);
  assert.match(resolverFacade, /kataDiscardFollowupForHost/);
  assert.doesNotMatch(kataBridge, /rulesText|compileCardEffects|effect-resolvers-legacy/);
});

test("playtest host contains no direct Core card-identity gameplay dispatch", () => {
  const identityDispatch = [
    ...matches(playtest, /\b(?:card|candidate|entry|attack|defense|item|kata|equipment)\.(?:catalogId|id|name)\s*===?\s*["'][^"']+["']/g),
    ...matches(playtest, /["']DDB-(?:STA|ATK|DEF|KAT|CON|CMB|LOC|CHR|DEQ|GEA|WPN)-CORE-\d{3}["']\s*===?\s*\b(?:card|candidate|entry|attack|defense|item|kata|equipment)\.(?:catalogId|id|name)/g),
    ...matches(playtest, /switch\s*\(\s*\b(?:card|candidate|entry|attack|defense|item|kata|equipment)\.(?:catalogId|id|name)\s*\)/g),
  ];
  if (identityDispatch.length) console.log("CARD_IDENTITY_DISPATCH", JSON.stringify(identityDispatch));
  assert.deepEqual(identityDispatch, []);
});

test("playtest host does not expose card-named choice protocols", () => {
  const bannedChoiceKinds = [
    "courtesy-notice",
    "discount-dim-mak",
    "tornado-crescent",
    "air-horn-reaction",
    "stage3c-trail-mix",
    "stage3c-zone-ward",
    "stage3c-remove-negative",
    "stage3c-discard-focus",
    "stage3c-weapon-suppress",
    "stage3c-exhaust-focus",
    "stage3c-raffle",
    "stage3c-lucky-reveal",
    "stage3c-sparring-pick",
    "stage3c-sparring-junk",
    "stage3c-reaction-discard",
  ];
  const found = bannedChoiceKinds.filter((kind) => playtest.includes(`kind: "${kind}"`) || playtest.includes(`case "${kind}"`));
  if (found.length) console.log("CARD_NAMED_CHOICE_KINDS", JSON.stringify(found));
  assert.deepEqual(found, []);
});

test("Core gameplay cannot silently fall back to the legacy prose parser in the Playtest", () => {
  assert.doesNotMatch(playtest, /\bcompileCardEffects\s*\(/);
  assert.match(playtest, /\beffectPlanForCard\s*\(/);
  assert.match(resolverFacade, /targetDiscardOnHitCount/);
  assert.match(resolverFacade, /structuredRuntimeEffects/);
});

test("removed two-Attack-per-turn cap cannot reappear", async () => {
  const sources = [
    ["content/dojo-game.json", await readText("content/dojo-game.json")],
    ["content/rules.json", await readText("content/rules.json")],
    ["app/playtest.tsx", playtest],
  ];
  const forbidden = [];
  for (const [path, source] of sources) {
    for (const pattern of [/maximum\s+(?:of\s+)?two\s+attacks?/gi, /max(?:imum)?\s*2\s+attacks?/gi, /two\s+attacks?\s+per\s+turn/gi, /no\s+more\s+than\s+two\s+attacks?/gi]) {
      for (const hit of source.match(pattern) ?? []) forbidden.push(`${path}: ${hit}`);
    }
  }
  assert.deepEqual(forbidden, []);
});

test("CI certification never rewrites gameplay TypeScript before testing", async () => {
  const workflowDir = new URL(".github/workflows/", root);
  const workflowFiles = (await readdir(workflowDir)).filter((name) => /\.ya?ml$/i.test(name));
  const violations = [];
  for (const name of workflowFiles) {
    const source = await readFile(new URL(name, workflowDir), "utf8");
    const suspicious = source.split("\n").filter((line) => /(sed|perl|python|node|cp|mv|cat|printf|echo).*(app\/[^ ]+\.(?:ts|tsx))/i.test(line) && !/node-version/i.test(line));
    for (const line of suspicious) violations.push(`${name}: ${line.trim()}`);
  }
  assert.deepEqual(violations, []);
});
