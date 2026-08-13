import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cardsPath = path.join(root, "app/data/cards.json");
const rulesPath = path.join(root, "app/data/rules.json");

const cardsData = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
const rulesData = JSON.parse(fs.readFileSync(rulesPath, "utf8"));

const releaseOrder = [
  "Core Game",
  "Expansion: Masters & Mystics",
  "Expansion: Back Alley Brawl",
  "Expansion: Maximum Nonsense",
];
const sheetOrder = [
  "Starter Pool",
  "Characters",
  "Techniques - Attack",
  "Techniques - Defense",
  "Techniques - Kata",
  "Items - Consumable",
  "Items - Weapons",
  "Items - Defense",
  "Combos",
  "Locations",
  "Boss Stages",
  "Boss Techniques",
];
const setCodes = {
  "Core Game": "COR",
  "Expansion: Masters & Mystics": "MYS",
  "Expansion: Back Alley Brawl": "BAB",
  "Expansion: Maximum Nonsense": "MAX",
};
const sheetCodes = {
  "Starter Pool": "STR",
  "Characters": "CHR",
  "Techniques - Attack": "ATK",
  "Techniques - Defense": "DEF",
  "Techniques - Kata": "KAT",
  "Items - Consumable": "CON",
  "Items - Weapons": "WPN",
  "Items - Defense": "ARM",
  "Combos": "CMB",
  "Locations": "LOC",
  "Boss Stages": "BST",
  "Boss Techniques": "BTQ",
};

const sortedCards = [...cardsData.cards].sort((a, b) => {
  const release = releaseOrder.indexOf(a.expansion) - releaseOrder.indexOf(b.expansion);
  if (release) return release;
  const sheet = sheetOrder.indexOf(a.sourceSheet) - sheetOrder.indexOf(b.sourceSheet);
  if (sheet) return sheet;
  return a.name.localeCompare(b.name);
});
const counters = new Map();
sortedCards.forEach((card, index) => {
  const setCode = setCodes[card.expansion] ?? "UNK";
  const sheetCode = sheetCodes[card.sourceSheet] ?? "MSC";
  const key = `${setCode}-${sheetCode}`;
  const sequence = (counters.get(key) ?? 0) + 1;
  counters.set(key, sequence);
  card.catalogOrder = index + 1;
  card.catalogId = `DDB-${key}-${String(sequence).padStart(3, "0")}`;
  card.details = {
    "Catalog ID": card.catalogId,
    "Catalog Order": card.catalogOrder,
    ...card.details,
  };
  card.searchText = `${card.catalogId} ${card.searchText}`.toLocaleLowerCase();
});
cardsData.cards = sortedCards;
cardsData.catalogSystem = "DDB-{SET}-{CLASS}-{SEQUENCE}";
cardsData.releaseOrder = releaseOrder;
fs.writeFileSync(cardsPath, `${JSON.stringify(cardsData, null, 2)}\n`);

const chapter = (number) => rulesData.chapters.find((entry) => entry.number === number);
const section = (number, id) => chapter(number)?.sections.find((entry) => entry.id === id);

const chapterTwo = chapter(2);
chapterTwo.sections.find((entry) => entry.id === "core-components").content = [
  { kind: "bullet", text: "Character Cards — three fighters per player in Tag Team and Dojo Drama; one per player in Standard Clash or Quick Duel." },
  { kind: "bullet", text: "Fixed Starter Decks — every player uses the same 15 cards: Basic Jab, Basic Body Kick, Basic Shin Kick, Wild Swing, High Guard, Center Guard, Low Guard, Cover Up, Breathing Drill, Footwork Drill, and Bad Habit ×5." },
  { kind: "bullet", text: "Market Deck — shuffle all purchasable Attacks, Defenses, Katas, Items, Weapons, Armor, Consumables, and utility cards together. The seven face-up Market cards are drawn randomly from this one deck." },
  { kind: "bullet", text: "Combo Deck — a separate face-down deck of learnable move sequences. Combos never occupy Market slots and never enter a player's draw deck." },
  { kind: "bullet", text: "Location Deck — global battlefield conditions. One Location is active at a time; the fight can Scene Change during a round." },
  { kind: "bullet", text: "Boss Materials — three Boss Stage cards (Rival, Mini-Boss, Final Boss) plus a dedicated 12-card Boss Technique Deck for Dojo Drama. Ordinary unused Character cards supply the Bosses' ATK, DEF, Speed, and identity." },
  { kind: "bullet", text: "Trackers — tokens, cubes, dice, beads, tiny plastic fists, or suspiciously organized snacks for HP, XP, FP, Chi, Tempo, and temporary effects." },
];
const cardTypes = chapterTwo.sections.find((entry) => entry.id === "card-types").content[0].rows;
for (const row of cardTypes) {
  if (row[0] === "Combo") row[2] = "Drawn from the separate face-down Combo Deck when learned; stays face up beside your Character. Maximum 2 learned.";
}
const anatomy = chapterTwo.sections.find((entry) => entry.id === "card-anatomy").content[0].rows;
for (const row of anatomy) {
  if (row[0] === "FP Cost") row[1] = "Focus Points required to buy a face-up Market card or learn a revealed Combo.";
}

const setup = chapter(4).sections.find((entry) => entry.id === "setup-steps");
setup.content = [
  { kind: "paragraph", text: "1. Choose a mode. Tag Team is the recommended Core Format. Standard Clash, Quick Duel, and Dojo Drama are also supported. See Section 3 for character counts and victory conditions." },
  { kind: "paragraph", text: "2. Choose Characters. Use three per player in Tag Team and Dojo Drama, or one per player in Standard Clash or Quick Duel. Place each Character face up and set every fighter to 25 HP. For Dojo Drama, also prepare the Boss ladder from Section 14." },
  { kind: "paragraph", text: "3. Take trackers. Set each player to White Belt, 0 XP, 0 FP, a Chi cap of 5, and current Chi 5. Record printed ATK, DEF, and Speed." },
  { kind: "paragraph", text: "4. Take the fixed Standard Starter Deck. Every player uses the same named 15 cards listed below. Shuffle it and draw five cards." },
  { kind: "paragraph", text: "5. Mulligan once if needed. If your opening hand contains no Attack and no Kata, reveal it, shuffle it back, and draw five new cards. The second hand stays, even if it is a small cardboard tragedy." },
  { kind: "paragraph", text: "6. Prepare the shared Market Deck. Combine and shuffle the purchasable Techniques, Katas, and Items; leave space for one Market discard pile." },
  { kind: "paragraph", text: "7. Reveal seven cards from the Market Deck. The mix is entirely random. Keep the Combo Deck separate and face-down beside the Market." },
  { kind: "paragraph", text: "8. Prepare Locations. Shuffle the Location Deck and leave space for its discard pile. Reveal the first Location during the first Honor Phase." },
  { kind: "paragraph", text: "9. Choose the opening referee. Randomly select a player to break first-round Speed ties. Pass this marker clockwise after each round." },
];
chapter(4).sections.find((entry) => entry.id === "standard-starter-deck").content[0].rows = [
  ["Card Group", "Count", "Fixed Contents"],
  ["Attacks", 4, "Basic Jab; Basic Body Kick; Basic Shin Kick; Wild Swing"],
  ["Defenses", 4, "High Guard; Center Guard; Low Guard; Cover Up"],
  ["Katas", 2, "Breathing Drill; Footwork Drill"],
  ["Junk", 5, "Bad Habit ×5"],
];
const quickstart = chapter(4).sections.find((entry) => entry.id === "quickstart");
quickstart.content[1].text = "2. Shuffle the shared Market Deck, separate face-down Combo Deck, and Location Deck. Reveal seven random cards from the Market Deck; Combos never occupy Market slots.";
quickstart.content[5].text = "6. During your Ascend Phase, spend FP to buy face-up Market cards. Purchased cards go to your discard pile. Once per turn, you may reveal the top Combo; pay its printed FP cost to learn it, or return it face-down to the bottom of the Combo Deck.";
quickstart.content[8].text = "9. After everyone acts, resolve end-of-round effects, discard the remaining face-up Market cards, reveal seven fresh random Market cards, pass the referee marker, and begin the next round with a new Scene Change. Benched fighters do not heal automatically.";

const roundIntro = chapter(6).intro.find((entry) => entry.kind === "table");
for (const row of roundIntro.rows) {
  if (row[0] === "A — Ascend") row[2] = "Buy face-up Market cards, optionally attempt to learn one Combo, and promote up to one Belt.";
}
section(6, "ascend-phase-buy-and-belt-up").content = [
  { kind: "bullet", text: "Spend FP on any number of face-up Market cards. Place each purchase in your discard pile, then immediately refill the empty slot from the shared Market Deck." },
  { kind: "bullet", text: "Once per turn, reveal the top card of the separate Combo Deck. Pay its printed FP cost to learn it, or return it face-down to the bottom of the deck. Either choice uses your one Combo attempt for the turn." },
  { kind: "bullet", text: "A learned Combo stays face up beside your fighter and never enters your hand, draw deck, or discard pile." },
  { kind: "bullet", text: "Promote up to one Belt if you meet its XP threshold and completed its promotion task." },
];

section(10, "the-shared-market").content = [
  { kind: "bullet", text: "The Market is one seven-card face-up row drawn from a single shuffled Market Deck containing purchasable Attacks, Defenses, Katas, Items, Weapons, Armor, Consumables, and utility cards." },
  { kind: "bullet", text: "Because the Market Deck is mixed, the available combination of Techniques, Katas, and Items is entirely random. No card type is guaranteed a slot." },
  { kind: "bullet", text: "During Ascend, buy cards one at a time by paying printed FP costs. Place each purchase in your discard pile and immediately refill the empty slot from the Market Deck." },
  { kind: "bullet", text: "The Combo Deck is separate, face-down, and never contributes cards to the Market." },
  { kind: "bullet", text: "At the end of each round, discard every unpurchased Market card to the Market discard pile and reveal seven fresh cards." },
];
const deckSection = section(10, "technique-and-item-decks");
deckSection.title = "The Mixed Market Deck";
deckSection.content = [{ kind: "paragraph", text: "The Market Deck combines purchasable Attacks, Defenses, Katas, Weapons, Armor, Consumables, and utility Items. Tags printed on cards—such as Punch, Kick, Hand, Spin, Sweep, Street, Improvised, Traditional, High, or Low—are rules labels with no effect by themselves but may be referenced by Combos, Locations, Characters, and other cards." }];
const learning = section(10, "learning-combos");
learning.content[0].text = "A Combo represents a sequence your fighter has learned, not another card shuffled into your deck. The Combo Deck stays separate and face-down. Each Combo shows an FP Cost, Sequence or Requirement, optional Trigger Chi, Effect, Timing Type / Limit, and relevant Tags.";
learning.content[1].text = "Once during Ascend, reveal the top Combo. Pay its printed FP Cost to learn it; if you decline or cannot pay, return it face-down to the bottom of the Combo Deck. You may know a maximum of 2 Combos. To learn a third, forget one of your current Combos first.";
section(10, "when-a-shared-deck-empties").content[0].text = "When the Market Deck empties, shuffle its discard pile to form a new deck. When the Combo Deck empties, shuffle its discard pile. If a deck and its discard are both empty, leave the affected slot or action unavailable until cards return. The game does not end because a shared deck is exhausted.";

const replaceInRules = (value) => {
  if (typeof value === "string") {
    return value
      .replace("Prepare your Starter Deck, Technique Deck, Item Deck, Combo Deck, Market, and Location Deck normally.", "Prepare your fixed Starter Deck, shared Market Deck, separate face-down Combo Deck, Market row, and Location Deck normally.")
      .replace("discard all remaining Market cards to their matching discards, reveal a fresh 3 Technique / 2 Item / 2 Combo Market", "discard all remaining Market cards to the Market discard and reveal seven fresh random Market cards")
      .replace("The shared face-up purchase area: 3 Techniques, 2 Items, and 2 Combo Scrolls.", "The shared face-up purchase area: seven random cards drawn from the mixed Market Deck. Combos are never included.")
      .replace("A learned sequence purchased from the Combo Scroll row.", "A learned sequence drawn from the separate face-down Combo Deck.")
      .replace("Spend FP → refill matching Market slots → max 1 Combo purchase → max 1 Belt", "Spend FP → refill Market slots → max 1 Combo attempt → max 1 Belt")
      .replace("refresh 3/2/2 Market", "refresh all 7 Market slots")
      .replace("Techniques/Items → discard and refill immediately. Combos stay learned face up; max 2 learned, max 1 Combo purchase per turn.", "Market purchases → discard and refill immediately. Combos come from the separate face-down deck; max 2 learned, max 1 Combo attempt per turn.");
  }
  if (Array.isArray(value)) return value.map(replaceInRules);
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) value[key] = replaceInRules(value[key]);
  }
  return value;
};
replaceInRules(rulesData.chapters);
replaceInRules(rulesData.glossary);

const marketTerm = rulesData.glossary.find((entry) => entry.term === "Market");
if (marketTerm) marketTerm.meaning = "The seven-card shared face-up purchase area, filled randomly from one mixed Market Deck containing Techniques, Katas, and Items. Combos are separate.";
const comboTerm = rulesData.glossary.find((entry) => entry.term === "Combo");
if (comboTerm) comboTerm.meaning = "A learned sequence drawn from the separate face-down Combo Deck. Complete its requirement, pay Trigger Chi when required, and resolve its payoff.";
if (!rulesData.glossary.some((entry) => entry.term === "Golden Rule")) {
  rulesData.glossary.push({ term: "Golden Rule", meaning: "When a card directly contradicts the rulebook, the card wins. If cards conflict, use timing and priority. If ambiguity remains, the active player makes a temporary ruling and play continues." });
  rulesData.glossary.sort((a, b) => a.term.localeCompare(b.term));
}

const mystery = rulesData.houseRules.find((entry) => entry.name === "Mystery Scroll");
if (mystery) {
  mystery.name = "Scroll Shopping";
  mystery.category = "Combo Control";
  mystery.summary = "Pay a little extra to browse three possible future mistakes.";
  mystery.rule = "When you make your once-per-turn Combo attempt during Ascend, reveal the top three Combo cards instead of one. Choose one to learn by paying its printed FP cost plus 1 FP, then shuffle the other two back into the Combo Deck. If you learn none, return all three and shuffle.";
  mystery.notes = "This replaces the now-redundant blind-draw variant while preserving the separate face-down Combo Deck and one-attempt limit.";
}

fs.writeFileSync(rulesPath, `${JSON.stringify(rulesData, null, 2)}\n`);
console.log(`Catalogued ${sortedCards.length} cards and corrected the v1.5 companion rules.`);
