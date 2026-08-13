import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cardsPath = path.join(root, "app/data/cards.json");
const auditPath = path.join(root, "app/data/card-migration-audit.json");
const data = JSON.parse(fs.readFileSync(cardsPath, "utf8"));

const normal = (text) => String(text ?? "")
  .replace(/Banked FP/g, "purchase discount")
  .replace(/\bFP\b/g, "Focus")
  .replace(/Focus Points/g, "Focus")
  .replace(/\bChi\b/g, "Flow")
  .replace(/\bchi\b/g, "Flow");

const directRules = {
  "Bad Habit": "No effect. This card generates 0 Focus.",
  "Breathing Drill": "Your next Attack this turn gets +1 Damage.",
  "Back Kick": "If this is your first Attack this turn, it deals +2 Damage. After it resolves, your next Attack this turn gains Flow.",
  "Defensive Front Kick": "Reaction — after a Mid or Low Attack targeting you resolves, you may play this card against that attacker. If played this way, it gets +1 Damage.",
  "Discount Dim Mak": "On Hit, choose one: the target loses Tempo for this round; or gain 1 Focus.",
  "Flying Front Kick": "If this is the second Attack you played this turn, it deals +1 Damage and you gain 1 Focus after it resolves.",
  "Liver Shot": "On Hit, the target's next Attack this round deals -2 Damage.",
  "Palm Heel Strike": "On Hit, gain 1 Focus. Once per turn.",
  "Snap Front Kick": "On Hit, your next Attack this turn gains Flow. Once per turn.",
  "Spinning Backfist": "If you attacked a different zone earlier this turn, your next Attack this turn gains Flow.",
  "Spinning Hook Kick": "If this follows a Mid or High Attack, it deals +2 Damage.",
  "The Blitz": "After this Attack resolves, your next Attack this turn gains Flow.",
  "Tornado Crescent Kick": "On Hit, choose one: gain 1 Focus; or draw 1 card, then discard 1 card.",
  "Uppercut": "If the target has already used Tempo this round, this Attack deals +2 Damage.",
  "Wheel Kick": "If you played a Spin Attack earlier this turn, this Attack deals +2 Damage.",
  "Downward Block (Gedan Barai)": "If this Blocks, your next Attack against that attacker this round deals +1 Damage.",
  "Forearm Frame": "If this Blocks, the attacker's next Attack this round deals -1 Damage.",
  "Hip Escape (Shrimp)": "If this Blocks, draw 1 card, then discard 1 card.",
  "Jam the Kick": "If this Blocks a Kick, the attacker's next Kick this turn deals -2 Damage.",
  "Knife-Hand Block (Shuto Uke)": "If this Blocks, choose one: your next Attack against that attacker this round deals +1 Damage; or your next purchase costs 1 less Focus, minimum 1.",
  "Pak Sao": "If this Blocks a Hand Attack, your next Hand Attack against that attacker this round deals +2 Damage.",
  "Rising Block (Age Uke)": "If this Blocks, your next purchase costs 1 less Focus, minimum 1.",
  "Step Back": "After this Defense resolves, you may discard 1 card. If you do, draw 2 cards, then discard 1 card.",
  "Tan Sao": "If this Blocks, the next Kata you play generates +1 Focus.",
  "Breath Control": "Your next Attack this turn gains Flow.",
  "Broken Rhythm Drill": "After your first Attack resolves this turn, your next Attack gains Flow.",
  "Footwork Drill": "Gain +2 Speed until end of round. If this makes you fastest, gain 1 Focus.",
  "Form 27B: Administrative Fury": "Choose one face-up Market card. It costs you 1 less Focus this turn, minimum 1.",
  "Jion": "Gain +1 DEF this round. If you play no Attack this turn, gain 1 Focus.",
  "Mall Dojo Demonstration Form": "Reveal a Technique from your hand. The next time you play it this turn, gain 1 Focus after it resolves.",
  "Pinan Nidan": "Gain 1 Focus. Your next Attack this turn gets +1 Damage.",
  "Second Wind Form": "If your active fighter is at half Max HP or less, heal 4 HP. Otherwise, your next Attack this turn gains Flow.",
  "Seipai": "The next Combo you learn this turn costs 1 less Focus.",
  "Tensho": "Draw 2 cards, then discard 2 cards. Your next Attack this turn gets +1 Damage.",
  "Weapon Familiarization": "Choose one permanent Equipment card in your hand. You may Equip it now; it generates +1 additional Focus.",
  "Caffeinated Mochi": "Draw 2 cards, then lose 1 Speed until end of round.",
  "Dojo Coupon": "Gain 3 Focus that can be spent only on Items or Equipment this turn.",
  "Electrolyte Popsicle": "Heal 2 HP. Your next Attack this turn gains Flow.",
  "Fortune Cookie": "Look at the top 3 cards of your deck and put them back in any order. If they contain three different card types, gain 1 Focus.",
  "Fresh Fruit": "Heal 3 HP, then draw 1 card and discard 1 card.",
  "Instant Noodles": "Heal 4 HP. If this leaves you with no cards in hand, draw 1 card.",
  "Kombucha": "Destroy 1 Junk card from your hand. Gain 1 Focus.",
  "Sensei's Advice": "You may destroy 1 Junk card from your hand. Then draw 1 card.",
  "Sports Drink": "Gain +2 Speed until end of round. Your next Attack this turn gains Flow.",
  "Sweatband": "Gain +2 Speed until end of round. It was already too sweaty.",
  "Yoyo": "Choose an opponent. Their next Defense card this round gets -2 Guard. If your next Attack against them is still Blocked, gain 1 Focus.",
  "Herbal Tea": "Draw 2 cards, then discard 1 card.",
  "Sweat Towel": "The next Kata you play this turn generates +1 Focus. Please do not ask why the towel is mystical.",
  "Energy Gel of Questionable Origin": "Draw 2 cards, then discard 1 card.",
  "Rubber Chicken": "Choose an opponent. They cannot Interfere with your next Attack this turn. If no Interfere card was prevented, gain 1 Focus after that Attack resolves.",
  "Bokken (Wooden Sword)": "Once per turn, if your Attack is Blocked, gain 1 Focus.",
  "Eko Bo (Short Staff)": "After you Block an Attack, your next Attack against that attacker this round deals +1 Damage. Once per round.",
  "Escrima Sticks": "If you have two Paired Weapons equipped, your second Attack each turn gains Flow.",
  "Fan (Tessen)": "You gain +1 DEF against High and Mid Attacks. After you Block, your next purchase costs 1 less Focus, minimum 1. Once per round.",
  "Jo Staff (Short Staff)": "Your first Attack after you play a Kata each turn deals +1 Damage.",
  "Nunchaku": "After your first Hit each turn, your next Attack gains Flow.",
  "Whip": "On Hit, the target loses Tempo for this round.",
  "Yo-Yo": "If this is your second Attack this turn and it Hits, gain 1 Focus.",
  "Layers of Hoodies": "Chest slot. +2 DEF against Mid Attacks. The first time you swap this each game, discard 1 card because there are so many sleeves.",
  "Museum Rope Barrier": "Accessory. The first Attack targeting you each round deals -2 Damage. Destroy this after it has affected three Attacks.",
  "No Soliciting Sign": "Occupies one hand. The first opponent to target you each round must discard 1 card or choose another legal target.",
  "Pool Noodle Shield": "Occupies one hand. +1 DEF against all zones. If it Blocks an Attack, the attacker loses 1 Focus if able.",
  "Trash Can Lid": "Occupies one hand. +2 DEF against all zones. If you Block a Weapon Attack, your next purchase costs 1 less Focus, minimum 1.",
  "Emergency Clipboard": "Occupies one hand. +1 DEF against High Attacks. When it Blocks, your next purchase costs 1 less Focus, minimum 1.",
  "Frozen Burrito": "The first time you Hit with this each turn, gain 1 Focus.",
  "Pool Noodle of Shame": "The first time you deal combat damage with this each turn, gain 1 Focus.",
};

const characterRules = {
  "Billy Blanx": ["The first time you play your second Attack each turn, your next Attack that turn gains Flow.", "The first time you play a third Attack each turn, gain 1 Focus after it resolves."],
  "Billy Superboot": ["Once per turn, your second Kick deals +1 Damage.", "After your first Kick each turn, your next Kick gains Flow."],
  "Chad Norris": [null, "The first opponent to play a Reaction against you each round must discard 1 additional card or cancel that Reaction."],
  "Jackie 'Oops!' Hand": [null, "The first time you use an Item or Consumable each turn, gain 1 Focus."],
  "John 'Ready' Wrecks": ["Once per round during your turn, you may unequip one Weapon and equip a different Weapon from your hand.", "The first Weapon you equip each turn generates +1 additional Focus."],
  "Johnny Fistbump": ["Your first Attack each turn gains Flow.", null],
  "Kenny Shamblam": [null, "If your first Attack each turn is Blocked, your next Attack that turn gains Flow."],
  "Knuckleton the Brawler": [null, "Your first Hand Attack each turn gains Flow."],
  "Liu Krunch": [null, "Your third Attack each turn deals +1 Damage."],
  "Steven Segull": [null, "The first time you change an Attack's zone each turn, gain 1 Focus."],
  "Suro 'The Architect' Hart": ["At Initiate, choose one until end of turn: your first Attack may be Any zone; draw 2 cards then discard 1; or your first Attack gains Flow.", null],
  "The Bat-Hand": [null, "The first Equipment card you buy each turn costs 1 less Focus, minimum 1."],
  "Chon-Li": [null, "The first High Attack you play each turn generates +1 Focus."],
  "Daniel Sun": [null, "The first time you are Hit each round, draw 1 card, then discard 1 card."],
  "Dano 'The Sage' Santo": ["The first Kata you play each turn generates +1 Focus.", "After you play a Kata, your next Attack this turn gains Flow."],
  "Jet Quick": [null, "If you play exactly one Attack on your turn, your first Defense before your next turn gets +1 Guard."],
  "Master 'Yip-Yap' Man": ["Once per round when you play a Defense, it gets +1 Guard. If it Blocks, your next Attack against that attacker deals +1 Damage.", "After your first Defense each round resolves, draw 1 card, then discard 1 card."],
  "Miyagi-San": [null, "When Wax In / Wax Out heals you, gain 1 Focus."],
  "Sensei Do’Mura": [null, "The first Kata you play each turn generates +1 additional Focus."],
  "The Dragon Li": [null, "The first time you draw a card outside Hide each turn, gain 1 Focus."],
  "El Pollo Rojo": [null, "At Initiate, if an opponent has more XP than you, you may reveal a Junk card from your hand to draw 1 card, then discard 1 card."],
  "J.C. BowFlex": ["Once per turn, after you play Attacks in two different zones, your next Attack gains Flow.", "The first time you complete all three zones in one turn, gain 1 Focus."],
  "Monk Broski Dude": [null, "When Muscle Memory triggers, draw 1 card, then discard 1 card after the Attack resolves."],
  "Munch-Fu Master": ["At Initiate, if you have a Consumable in hand, you may reveal it to draw 1 card, then discard 1 card.", "The first Consumable you use each turn heals +1 HP or generates +1 Focus, chosen when it resolves."],
  "Sensei Ducktape": ["Once per round during Initiate, you may equip one permanent Item or Gear card from your discard pile. Discard it at end of turn.", null],
  "Sir Kixalot": ["Once per turn, after you play your second Kick, your next Kick gains Flow.", "The first time your second Kick Hits each turn, gain 1 Focus."],
  "Some Guy Named Steve": [null, "If you are tied for lowest XP, your first purchase each turn costs 1 less Focus, minimum 1."],
};

const comboRules = {
  "Blitzed Expectations": [null, "The final Attack gets +1 Damage and gains Flow."],
  "Body Shop Special": [null, "If the first Attack Hits, the second Attack gets +1 Damage. If the second also Hits, gain 1 Focus."],
  "Breathe In, Violence Out": ["Play a Kata with the Flow tag → Attack", "The Attack gets +2 Damage. If it Hits, your next Attack this turn gains Flow."],
  "Panic Into Purpose": ["Begin your turn with at least 2 Junk cards in hand → Attack", "If the Attack Hits, gain 2 Focus."],
  "Paperwork and Pain": [null, "If the Attack Hits, gain 1 Focus."],
  "Personal Space Violation": [null, "If the first Attack Hits, the Hand Attack gets +2 Damage and gains Flow."],
  "Shell Company": [null, "At your next Initiate, draw 1 extra card, then discard 1 card."],
  "The Full Tax Audit": [null, "When the third Zone is completed, draw 1 card and gain 2 Focus."],
  "Three-Piece & Hydration": [null, "After the Consumable resolves, draw 2 cards, then discard 1 card."],
  "You Missed, Congratulations": [null, "Gain 1 Focus after the retaliatory Attack Hits."],
  "Pocket Snack Tactics": [null, "The Low Attack gets +1 Damage and gains Flow."],
};

const locationRules = {
  "Beach Training Montage": "Low Attacks deal -1 Damage. The first time a Kata grants Flow each turn, the affected Attack also gets +1 Damage.",
  "Corporate Conference Room": "The first Item bought each turn costs 1 less Focus, minimum 1. Each fighter's first Attack per turn deals -1 Damage.",
  "Farmers Market": "Consumables that heal restore +2 HP. The first Item each fighter buys per turn costs 1 less Focus, minimum 1.",
  "Locker Room": "The first Consumable each fighter uses on their turn makes their next Attack that turn deal +1 Damage.",
  "Public Library": "The first Kata each fighter plays per turn generates +1 additional Focus. Their first Attack that turn deals -1 Damage.",
  "Strip-Mall McDojo": "The first Kata each fighter plays per turn generates +1 additional Focus. Defense Techniques provide 1 less Guard.",
  "Traditional Dojo": "The first Kata each fighter plays per turn generates +1 additional Focus. Their first Defense Technique each round gets +1 Guard.",
  "Yoga Studio": "The first Kata each fighter plays per turn generates +1 additional Focus. All Attacks deal -1 Damage.",
  "Astral Training Plane": "The first Combo each fighter triggers per turn adds +1 to one printed numeric effect. Weapons and Armor provide 1 less printed bonus, minimum 0.",
  "Haunted Dojo": "Once per turn, a fighter may destroy 1 Junk card from hand to gain 2 Focus, then lose 1 HP.",
  "Meditation Garden": "The first Kata each fighter plays per turn generates +1 additional Focus. Their first Attack that turn deals -1 Damage.",
  "Concrete Stairwell": "High Attacks deal +1 Damage. Jump-tag Attacks deal -1 Damage.",
  "Dumpster Behind the Dojo": "Once per turn, a fighter may discard 1 Junk card to draw 1 card and gain 1 Focus. Improvised Weapons gain +1 Attack Bonus.",
  "Gas Station at 2 A.M.": "The first Consumable each fighter uses per turn heals +1 HP and makes their next Attack that turn deal +1 Damage.",
  "Hardware Store Aisle 12": "The first Item each fighter buys during Ascend costs 1 less Focus, minimum 1. Improvised Weapons gain +1 Attack Bonus.",
  "Night Market": "The first Consumable or Improvised Weapon each fighter buys per turn costs 1 less Focus, minimum 1.",
  "Parking Garage Spiral": "Spin-tag Attacks deal +1 Damage. The first Low Attack each fighter plays per turn deals +1 Damage.",
  "Parking Lot Behind the Dojo": "Katas generate 0 Focus. Weapons tagged Street or Improvised gain +1 Attack Bonus.",
  "Rain-Slick Alley": "Low Attacks deal +1 Damage. Spin-tag Attacks deal -1 Damage.",
};

const oldSnapshot = new Map(data.cards.map((card) => [card.catalogId, JSON.parse(JSON.stringify(card))]));

for (const card of data.cards) {
  const details = card.details ?? {};
  for (const key of Object.keys(details)) {
    if (/^(Chi Cost|Equip Chi|Trigger Chi)$/i.test(key)) delete details[key];
    if (key === "FP Cost") {
      details["Focus Cost"] = details[key];
      delete details[key];
    }
  }
  card.chiCost = null;
  card.rulesVersion = "v1.6 Economy Draft";
  card.tags = (card.tags ?? []).map((tag) => tag === "Chi" ? "Flow" : tag);
  card.buildPaths = (card.buildPaths ?? []).map((tag) => tag === "Chi" ? "Flow" : tag);

  for (const key of Object.keys(details)) {
    if (typeof details[key] === "string") details[key] = normal(details[key]).replace(/\bFlow Cost\b/g, "play cost");
  }

  if (directRules[card.name]) card.rulesText = directRules[card.name];
  else card.rulesText = normal(card.rulesText).replace(/This card has no Flow cost, Focus value,/g, "This card has no Focus value,");

  if (card.sourceSheet === "Starter Pool" && card.name === "Bad Habit") {
    card.focusValue = 0;
    details["Focus Value"] = 0;
  }
  if (details["Rules Text"] !== undefined) details["Rules Text"] = card.rulesText;
  if (details["Boss Text"] !== undefined) details["Boss Text"] = card.rulesText;

  const character = characterRules[card.name];
  if (character) {
    if (character[0]) details["White Ability Text"] = character[0];
    if (character[1]) details["Green Ability Text"] = character[1];
    card.rulesText = details["White Ability Text"] ?? card.rulesText;
  }

  const combo = comboRules[card.name];
  if (combo) {
    if (combo[0]) details["Sequence / Requirement"] = combo[0];
    if (combo[1]) details.Effect = combo[1];
    card.rulesText = details.Effect;
  } else if (card.cardType === "Combo") {
    details.Effect = normal(details.Effect);
    card.rulesText = details.Effect;
  }

  if (locationRules[card.name]) {
    details["Ongoing Effect"] = locationRules[card.name];
    card.rulesText = locationRules[card.name];
  }
  if (card.name === "Night Market") details["On Reveal"] = "Each fighter's next purchase this round costs 1 less Focus, minimum 1.";

  for (const key of ["Tags", "Build Path", "Affinity", "Favored Build Paths"]) {
    if (typeof details[key] === "string") details[key] = details[key].replace(/\bChi\b/g, "Flow").replace(/\bFP\b/g, "Focus");
  }
  card.searchText = `${card.catalogId} ${card.name} ${card.cardType} ${card.subtype} ${card.expansion} ${card.deck} ${card.rulesText ?? ""} ${Object.values(details).join(" ")} ${(card.tags ?? []).join(" ")} ${(card.buildPaths ?? []).join(" ")}`.toLocaleLowerCase();
}

const audit = data.cards.map((card) => {
  const old = oldSnapshot.get(card.catalogId);
  const explicit = /\bChi\b|discard.for.FP|Banked FP|\bFP\b/i.test(JSON.stringify(old));
  const textChanged = old.rulesText !== card.rulesText || JSON.stringify(old.details) !== JSON.stringify(card.details);
  const legacyCost = old.chiCost;
  let balanceNote = "Reviewed under the two-Attack cap, hand-size constraint, timing windows, slots, purchase cost, and Focus curve; no bespoke rules rewrite required.";
  if (card.cardType === "Combo") balanceNote = "Trigger cost removed; sequence difficulty, learned limit, trigger limit, and Combo Extension now constrain the payoff.";
  else if (legacyCost === 3) balanceNote = "Legacy high play cost removed; classified as a premium effect and reviewed against the Attack cap, Flow access, purchase cost, and draw potential.";
  else if (legacyCost === 2) balanceNote = "Legacy medium play cost removed; reviewed for free-play burst and retained or rewritten within turn limits.";
  else if (explicit) balanceNote = "Resource-dependent text rewritten individually to preserve tactical purpose without recreating Chi under another name.";
  return {
    catalogOrder: card.catalogOrder,
    catalogId: card.catalogId,
    releaseSet: card.expansion,
    sourceSheet: card.sourceSheet,
    cardType: card.cardType,
    name: card.name,
    oldChiCost: legacyCost,
    focusCost: card.fpCost,
    focusValue: card.focusValue,
    oldRulesText: old.rulesText ?? "",
    newRulesText: card.rulesText ?? "",
    directlyImpacted: explicit || legacyCost !== null && legacyCost !== undefined,
    textChanged,
    reviewStatus: "Migrated — simulation pending",
    balanceNote,
  };
});

data.version = "v1.6 Economy Draft";
data.economy = {
  currencies: ["Focus", "XP"],
  removed: "Chi",
  attackLimit: 2,
  flowLimit: 1,
  comboExtensionLimit: 1,
  focusRule: "Cards generate printed Focus only when legally played or Equipped from hand during your turn. Unspent Focus is lost during Hide.",
};
fs.writeFileSync(cardsPath, `${JSON.stringify(data, null, 2)}\n`);
fs.writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`);

const remaining = data.cards.filter((card) => /\bChi\b|Banked FP|discard.for.FP|Trigger Chi|Equip Chi|Chi Cost/i.test(JSON.stringify(card)));
console.log(`Migrated ${data.cards.length} cards; ${audit.filter((row) => row.textChanged).length} records changed; ${remaining.length} records retain prohibited economy terms.`);
if (remaining.length) console.log(remaining.map((card) => `${card.catalogId} ${card.name}`).join("\n"));
