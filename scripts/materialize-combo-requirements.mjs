import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const value = (entry) => String(entry ?? "").trim();
const normalizedTags = (card) => (card.tags ?? []).map((tag) => String(tag).toLocaleLowerCase());
const hasTag = (card, tag) => normalizedTags(card).some((entry) => entry.includes(tag.toLocaleLowerCase()));

function requirementText(card) {
  const details = card.details ?? {};
  const explicit = value(details["Sequence / Requirement"] ?? details.Requirement ?? details.Sequence);
  if (explicit && explicit !== "—") return explicit;
  const match = value(card.rulesText).match(/Requirement:\s*([^.]+)/i);
  return match?.[1]?.trim() || "Complete the printed sequence or condition.";
}

function sequenceStep(descriptor) {
  const lower = descriptor.toLocaleLowerCase();
  const step = {};
  if (/\battack\b/.test(lower)) step.family = "Attack";
  else if (/\bdefense\b|\bblock\b/.test(lower)) step.family = "Defense";
  else if (/\bkata\b/.test(lower)) step.family = "Kata";
  const tags = ["punch", "kick", "jump", "spin", "weapon", "hand", "leg", "multi-hit", "flow", "push", "dodge"].filter((tag) => lower.includes(tag));
  if (tags.length) step.tags = tags;
  const zone = ["high", "mid", "low"].find((candidate) => new RegExp(`\\b${candidate}\\b`, "i").test(lower));
  if (zone) step.zone = `${zone[0].toUpperCase()}${zone.slice(1)}`;
  return step;
}

function materializeRequirements(card) {
  const text = requirementText(card);
  const requirements = [];
  let recognized = false;
  const arrowParts = text.split(/\s*(?:→|->)\s*/).map((part) => part.trim()).filter(Boolean);
  if (arrowParts.length > 1) {
    recognized = true;
    requirements.push({ kind: "orderedSequence", steps: arrowParts.map(sequenceStep) });
  }
  if (/different zone/i.test(text)) {
    recognized = true;
    requirements.push({ kind: "differentZoneFromPreviousAttack" });
  }
  if (/block(?:ed)? an? attack|after you played a defense|\bblock\b/i.test(text)) {
    recognized = true;
    requirements.push({ kind: "defendedThisRound" });
  }
  if (/\bkata\b/i.test(text) && arrowParts.length <= 1) {
    recognized = true;
    requirements.push({ kind: "priorCardFamily", family: "Kata" });
  }
  if (/\breversal\b/i.test(text)) {
    recognized = true;
    requirements.push({ kind: "reversal" });
  }
  if (/second attack/i.test(text)) {
    recognized = true;
    requirements.push({ kind: "attackOrdinal", ordinal: 2 });
  }
  if (/third attack|first two attacks/i.test(text)) {
    recognized = true;
    requirements.push({ kind: "minimumPriorAttacks", amount: 2 });
  }
  if (/first attack hit|first attack hits/i.test(text)) {
    recognized = true;
    requirements.push({ kind: "priorAttackHit", minimumPriorAttacks: 1 });
  }
  if (/two or more permanent equipment|2\+ permanent equipment/i.test(text)) {
    recognized = true;
    requirements.push({ kind: "minimumEquipment", amount: 2 });
  }
  if (/weapon attack/i.test(text)) {
    recognized = true;
    requirements.push({ kind: "weaponAttack" });
  }
  if (/all three zones/i.test(text)) {
    recognized = true;
    requirements.push({ kind: "zonesPresent", zones: ["High", "Mid", "Low"] });
  }

  if (!recognized) {
    if (hasTag(card, "Kata")) requirements.push({ kind: "priorCardFamily", family: "Kata" });
    if (hasTag(card, "Block")) requirements.push({ kind: "defendedThisRound" });
    if (hasTag(card, "Multi-Hit")) requirements.push({ kind: "priorAttackTag", tag: "multi-hit" });
    if (hasTag(card, "Jump") && hasTag(card, "Kick")) requirements.push({ kind: "orderedSequence", steps: [{ family: "Attack", tags: ["jump"] }, { family: "Attack", tags: ["kick"] }] });
  }

  return { displayText: text, requirements };
}

const cardsPayload = await readJson("content/cards.json");
const game = await readJson("content/dojo-game.json");
const effectRegistry = await readJson("content/card-effects/combos.json");
const combos = (cardsPayload.cards ?? []).filter((card) => String(card.catalogId ?? "").includes("-CMB-CORE-"));
const cards = Object.fromEntries(combos.map((card) => [card.catalogId, { name: card.name, ...materializeRequirements(card) }]));

const missingRequirements = combos.filter((card) => !(cards[card.catalogId]?.requirements ?? []).length).map((card) => `${card.catalogId} ${card.name}`);
if (missingRequirements.length) throw new Error(`Unable to materialize executable requirements for: ${missingRequirements.join(", ")}`);
const missingEffects = combos.filter((card) => !(effectRegistry.cards?.[card.catalogId]?.effects ?? []).length).map((card) => `${card.catalogId} ${card.name}`);
if (missingEffects.length) throw new Error(`Core Combos missing structured payoff effects: ${missingEffects.join(", ")}`);

const payload = {
  schemaVersion: 1,
  rulesVersion: game.rulesVersion,
  rulesRevision: game.rulesRevision,
  family: "Combo",
  description: "Canonical machine-readable fulfillment requirements for Core Combos. Runtime evaluates these structures and never infers Combo requirements from printed prose.",
  cards,
};

await writeFile(new URL("content/combo-requirements.json", root), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
const resolvers = [...new Set(Object.values(effectRegistry.cards ?? {}).flatMap((entry) => (entry.effects ?? []).map((effect) => effect.resolver).filter(Boolean)))].sort();
const effects = [...new Set(Object.values(effectRegistry.cards ?? {}).flatMap((entry) => (entry.effects ?? []).map((effect) => effect.effect).filter(Boolean)))].sort();
console.log(`Materialized ${Object.keys(cards).length} Core Combo requirement definitions.`);
console.log(`COMBO_RESOLVERS ${JSON.stringify(resolvers)}`);
console.log(`COMBO_EFFECTS ${JSON.stringify(effects)}`);
