import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cardsPath = path.join(root, "app/data/cards.json");
const auditPath = path.join(root, "app/data/card-migration-audit.json");
const data = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));

for (const card of data.cards) {
  card.tags = (card.tags ?? []).map((tag) => tag === "FP" ? "Focus" : tag);
  card.buildPaths = (card.buildPaths ?? []).map((tag) => tag === "FP" ? "Economy" : tag);
  if (card.name === "Tekki Shodan") {
    card.rulesText = "Your next Low or Mid Attack this turn gains Flow.";
    card.details["Rules Text"] = card.rulesText;
  }
  card.searchText = `${card.catalogId} ${card.name} ${card.cardType} ${card.subtype} ${card.expansion} ${card.deck} ${card.rulesText ?? ""} ${Object.values(card.details ?? {}).join(" ")} ${(card.tags ?? []).join(" ")} ${(card.buildPaths ?? []).join(" ")}`.toLocaleLowerCase();
}

const tekkiAudit = audit.find((entry) => entry.name === "Tekki Shodan");
if (tekkiAudit) {
  tekkiAudit.newRulesText = "Your next Low or Mid Attack this turn gains Flow.";
  tekkiAudit.textChanged = true;
  tekkiAudit.balanceNote = "Legacy play-cost reduction converted to Flow so the Kata interacts with the two-Attack cap without recreating a spendable play currency.";
}

for (const entry of audit) {
  entry.reviewStatus = "Card-by-card migration complete — playtest pending";
}

const forbiddenText = /\bChi\b|\bFP\b|Banked FP|Trigger Chi|Equip Chi|Chi Cost|costs? \d+ less Flow/i;
const leftovers = data.cards.filter((card) => forbiddenText.test(JSON.stringify(card)));
if (leftovers.length) throw new Error(`Legacy text remains: ${leftovers.map((card) => `${card.catalogId} ${card.name}`).join(", ")}`);
if (audit.length !== data.cards.length || new Set(audit.map((entry) => entry.catalogId)).size !== data.cards.length) {
  throw new Error("The card audit must contain exactly one unique record for every card.");
}

fs.writeFileSync(cardsPath, `${JSON.stringify(data, null, 2)}\n`);
fs.writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
console.log(`Finalized ${data.cards.length} cards and ${audit.length} audit records.`);
