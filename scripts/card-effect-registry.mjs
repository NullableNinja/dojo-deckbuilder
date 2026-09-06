import { readFile, readdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));

const FAMILY_BY_FILE = new Map([
  ["starters.json", "Starter"],
  ["attacks.json", "Attack"],
  ["defenses.json", "Defense"],
  ["katas.json", "Kata"],
  ["consumables.json", "Consumable"],
  ["equipment.json", "Equipment"],
  ["combos.json", "Combo"],
  ["locations.json", "Location"],
  ["characters.json", "Character"],
]);

function cardFamily(card) {
  const catalogId = String(card?.catalogId ?? "").toUpperCase();
  if (catalogId.includes("-STA-")) return "Starter";
  if (catalogId.includes("-ATK-")) return "Attack";
  if (catalogId.includes("-DEF-")) return "Defense";
  if (catalogId.includes("-KAT-")) return "Kata";
  if (catalogId.includes("-CON-")) return "Consumable";
  if (catalogId.includes("-CMB-")) return "Combo";
  if (catalogId.includes("-LOC-")) return "Location";
  if (catalogId.includes("-CHR-")) return "Character";
  if (catalogId.includes("-DEQ-") || catalogId.includes("-GEA-")) return "Equipment";

  const subtype = String(card?.subtype ?? "").toLocaleLowerCase();
  const type = String(card?.cardType ?? "").toLocaleLowerCase();
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizedEffectDefinition(effectId, vocabulary) {
  const definition = vocabulary.effects?.[effectId];
  assert(definition, `Unknown canonical effect '${effectId}'. Add it to content/effects.json before using it.`);
  return definition;
}

function hydrateEffect(effect, vocabulary, context) {
  const output = { ...effect };
  if (!output.effect) {
    assert(output.action, `${context}: effect instance requires either 'effect' or legacy 'action'.`);
    return output;
  }

  const definition = normalizedEffectDefinition(output.effect, vocabulary);
  assert(
    !output.action || output.action === definition.action,
    `${context}: '${output.effect}' maps to action '${definition.action}', not '${output.action}'.`,
  );
  output.action = definition.action;

  if (output.target == null && definition.defaultTarget) output.target = definition.defaultTarget;
  if (output.duration == null && Array.isArray(definition.allowedDurations) && definition.allowedDurations.length === 1) {
    output.duration = definition.allowedDurations[0];
  }

  assert(
    !definition.allowedTriggers || definition.allowedTriggers.includes(output.trigger),
    `${context}: '${output.effect}' does not allow trigger '${output.trigger}'.`,
  );
  assert(
    output.target == null || !definition.allowedTargets || definition.allowedTargets.includes(output.target),
    `${context}: '${output.effect}' does not allow target '${output.target}'.`,
  );
  assert(
    output.duration == null || !definition.allowedDurations || definition.allowedDurations.includes(output.duration),
    `${context}: '${output.effect}' does not allow duration '${output.duration}'.`,
  );

  const amountRule = definition.amount ?? {};
  if (amountRule.required) assert(Number.isFinite(output.amount), `${context}: '${output.effect}' requires a numeric amount.`);
  if (Number.isFinite(output.amount) && Number.isFinite(amountRule.minimum)) {
    assert(output.amount >= amountRule.minimum, `${context}: '${output.effect}' amount must be >= ${amountRule.minimum}.`);
  }
  if (output.amount == null && Number.isFinite(amountRule.default)) output.amount = amountRule.default;

  for (const condition of output.conditions ?? []) {
    assert(vocabulary.conditions?.[condition.kind], `${context}: unknown canonical condition '${condition.kind}'. Add it to content/effects.json before using it.`);
    if (condition.operator != null) {
      assert(vocabulary.conditionOperators?.[condition.operator], `${context}: unknown condition operator '${condition.operator}'.`);
    }
  }

  if (definition.implementation === "resolver-required") {
    assert(String(output.resolver ?? "").trim(), `${context}: '${output.effect}' requires a dedicated resolver.`);
  }
  return output;
}

function validateVocabulary(vocabulary, source) {
  assert(vocabulary.schemaVersion === 1, "content/effects.json schemaVersion must be 1.");
  assert(vocabulary.rulesVersion === source.rulesVersion, "content/effects.json rulesVersion does not match content/dojo-game.json.");
  assert(vocabulary.rulesRevision === source.rulesRevision, "content/effects.json rulesRevision does not match content/dojo-game.json.");
  assert(vocabulary.effects && typeof vocabulary.effects === "object", "content/effects.json is missing effects.");
  assert(vocabulary.conditions && typeof vocabulary.conditions === "object", "content/effects.json is missing conditions.");
  for (const [effectId, definition] of Object.entries(vocabulary.effects)) {
    assert(/^[a-z][a-z0-9-]*\.[A-Za-z][A-Za-z0-9]*$/.test(effectId), `Canonical effect ID '${effectId}' violates namespace.camelCase format.`);
    assert(String(definition.action ?? "").trim(), `Canonical effect '${effectId}' has no runtime action.`);
    assert(Array.isArray(definition.allowedTriggers) && definition.allowedTriggers.length, `Canonical effect '${effectId}' has no allowedTriggers.`);
    assert(Array.isArray(definition.allowedTargets) && definition.allowedTargets.length, `Canonical effect '${effectId}' has no allowedTargets.`);
  }
}

export async function loadCardEffectArchitecture() {
  const [source, cards, vocabulary] = await Promise.all([
    readJson("content/dojo-game.json"),
    readJson("content/cards.json"),
    readJson("content/effects.json"),
  ]);
  validateVocabulary(vocabulary, source);

  const directory = new URL("content/card-effects/", root);
  const files = (await readdir(directory))
    .filter((file) => file.endsWith(".json"))
    .sort();
  const families = [];
  for (const file of files) {
    const registry = await readJson(`content/card-effects/${file}`);
    const expectedFamily = FAMILY_BY_FILE.get(file);
    assert(expectedFamily, `Unknown card-effect family filename '${file}'. Add it to FAMILY_BY_FILE before authoring it.`);
    assert(registry.schemaVersion === 1, `content/card-effects/${file} schemaVersion must be 1.`);
    assert(registry.rulesVersion === source.rulesVersion, `content/card-effects/${file} rulesVersion does not match canonical rulesVersion.`);
    assert(registry.rulesRevision === source.rulesRevision, `content/card-effects/${file} rulesRevision does not match canonical rulesRevision.`);
    assert(registry.family === expectedFamily, `content/card-effects/${file} declares family '${registry.family}', expected '${expectedFamily}'.`);
    assert(registry.cards && typeof registry.cards === "object", `content/card-effects/${file} is missing cards.`);
    families.push({ file, family: expectedFamily, registry });
  }
  return { source, cards, vocabulary, families };
}

export function buildCardEffectAggregate({ source, cards, vocabulary, families }) {
  const cardsByCatalogId = new Map((cards.cards ?? []).map((card) => [card.catalogId, card]));
  const mergedCards = {};
  const authoredIds = new Map();

  for (const { file, family, registry } of families) {
    for (const [catalogId, entry] of Object.entries(registry.cards ?? {})) {
      assert(!authoredIds.has(catalogId), `${catalogId} is authored by both ${authoredIds.get(catalogId)} and content/card-effects/${file}.`);
      authoredIds.set(catalogId, `content/card-effects/${file}`);
      const card = cardsByCatalogId.get(catalogId);
      assert(card, `content/card-effects/${file}: ${catalogId} does not resolve to content/cards.json.`);
      assert(card.name === entry.name, `content/card-effects/${file}: ${catalogId} is named '${entry.name}', canonical card name is '${card.name}'.`);
      const actualFamily = cardFamily(card);
      assert(actualFamily === family, `content/card-effects/${file}: ${catalogId} belongs to family '${actualFamily ?? "unknown"}', not '${family}'.`);
      assert(Array.isArray(entry.effects), `content/card-effects/${file}: ${catalogId} must contain an effects array.`);
      const effectIds = new Set();
      const hydrated = entry.effects.map((effect, index) => {
        const context = `content/card-effects/${file}: ${catalogId} effect ${effect.id ?? `#${index + 1}`}`;
        if (effect.id) {
          assert(!effectIds.has(effect.id), `${context}: duplicate effect id '${effect.id}'.`);
          effectIds.add(effect.id);
        }
        return hydrateEffect(effect, vocabulary, context);
      });
      mergedCards[catalogId] = { name: entry.name, effects: hydrated };
    }
  }

  for (const [catalogId, entry] of Object.entries(mergedCards)) {
    const card = cardsByCatalogId.get(catalogId);
    assert(card, `Merged structured effect entry ${catalogId} does not resolve to content/cards.json.`);
    assert(entry.name === card.name, `Merged structured effect entry ${catalogId} is named '${entry.name}', canonical card is '${card.name}'.`);
  }

  return {
    schemaVersion: 1,
    rulesVersion: source.rulesVersion,
    rulesRevision: source.rulesRevision,
    description: "Canonical structured-effect migration registry. Entries are keyed by Catalog ID so executable behavior can migrate independently of the large printed-card catalog without changing printed card identity.",
    cards: Object.fromEntries(Object.entries(mergedCards).sort(([left], [right]) => left.localeCompare(right))),
  };
}

export async function expectedCardEffectAggregate() {
  const architecture = await loadCardEffectArchitecture();
  return { ...architecture, aggregate: buildCardEffectAggregate(architecture) };
}
