import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rulesPath = path.join(root, "app/data/rules.json");
const rules = JSON.parse(fs.readFileSync(rulesPath, "utf8"));

const p = (text) => ({ kind: "paragraph", text });
const b = (text) => ({ kind: "bullet", text });
const t = (rows) => ({ kind: "table", rows });
const s = (id, title, content) => ({ id, title, content });
const chapter = (number) => rules.chapters.find((entry) => entry.number === number);

function replaceStrings(value, transform) {
  if (typeof value === "string") return transform(value);
  if (Array.isArray(value)) return value.map((entry) => replaceStrings(entry, transform));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceStrings(entry, transform)]));
  }
  return value;
}

rules.version = "v1.6 Economy Draft";
rules.source = "Dojo Deckbuilder v1.6 Economy Draft — no-Chi rules migration";

// Normalize the surviving currency name before replacing the affected systems below.
rules.chapters = replaceStrings(rules.chapters, (text) => text
  .replace(/Focus Points/g, "Focus")
  .replace(/\bFP\b/g, "Focus")
  .replace(/FP Cost/g, "Focus Cost")
  .replace(/FP costs/g, "Focus costs")
  .replace(/FP cost/g, "Focus cost"));

const c1 = chapter(1);
c1.fullTitle = "1 Welcome to Paper-Fu";
c1.intro = [
  p("The martial art invented after everyone was banned from the real tournament."),
  p("Long ago—roughly last fiscal quarter—a great martial arts tournament was held to determine the strongest fighting style across all dojos. Representatives came from mountaintop temples, underground fight clubs, backyard belt mills, and that suspicious gym with the smoothie bar and too many mirrors."),
  p("There was only one problem: everyone cheated. Hidden weapons. Bribed judges. Ferret-based interference. The flaming monks remain under active legal review."),
  p("The Council of Martial Arts Elders—three people in one robe—declared a reset. No bloodlines. No sacred prophecy. No shirtless nunchuck reviews. Advancement would be earned through combat, deckbuilding, increasingly ridiculous promotion tasks, and the sacred discipline of reading the card before arguing about it."),
  t([["THE GOLDEN RULE\nWhen a card directly contradicts this rulebook, the card wins. When two cards conflict, use the timing and priority rules in Section 15. When the table still cannot agree, the active player makes the temporary ruling, finishes the turn, and everyone may yell about it afterward."]]),
  p("What Kind of Game Is This?"),
  p("Dojo Deckbuilder is a competitive martial-arts deckbuilding game. Every player starts with the same awkward 15-card deck, plays cards to fight and generate Focus, buys stronger cards from a shared Market, equips ridiculous gear, learns Combos, and climbs from White Belt to Black Belt."),
  b("Fixed packs, not randomized boosters. Everyone knows what is in the box; nobody needs to sell a kidney for a foil raccoon."),
  b("Deckbuilding happens during play. Purchased Techniques and Items enter your discard pile and cycle into future hands; learned Combos remain face up beside your fighter."),
  b("Combat is direct. Attacks target High, Mid, or Low zones; defenders answer with cards, armor, and panic."),
  b("Two routes to victory. Reach Black Belt or become the last fighter standing."),
  b("Expandable by design. New dojos can add Characters, Techniques, Items, Equipment, Locations, Combos, Bosses, and new varieties of deeply avoidable nonsense."),
];

const c2 = chapter(2);
c2.sections = [
  s("core-components", "Core Components", [
    b("Character Cards — three fighters per player in Tag Team and Dojo Drama; one per player in Standard Clash or Quick Duel."),
    b("Fixed Starter Decks — every player uses the same 15 cards: Basic Jab, Basic Body Kick, Basic Shin Kick, Wild Swing, High Guard, Center Guard, Low Guard, Cover Up, Breathing Drill, Footwork Drill, and Bad Habit ×5."),
    b("Market Deck — shuffle all purchasable Attacks, Defenses, Katas, Items, Weapons, Armor, Consumables, and utility cards together. Reveal seven random cards; no card type is guaranteed a slot."),
    b("Combo Deck — a separate face-down deck. Combos never occupy Market slots and never enter a player's draw deck."),
    b("Location Deck — global battlefield conditions. One Location is active at a time; the fight can Scene Change during a round."),
    b("Boss Materials — three Boss Stage cards plus a dedicated 12-card Boss Technique Deck for Dojo Drama."),
    b("Trackers — tokens, cubes, dice, beads, tiny plastic fists, or suspiciously organized snacks for HP, XP, Focus, Tempo, promotion tasks, and temporary effects."),
  ]),
  c2.sections.find((entry) => entry.id === "card-types"),
  s("card-anatomy", "Card Anatomy", [t([
    ["Element", "Meaning"],
    ["Focus Cost", "Focus required to buy a face-up Market card or learn a revealed Combo."],
    ["Focus Value", "Focus generated when the card is legally played or Equipped from your hand during your own turn."],
    ["Damage / Guard", "Attack Damage or Defense value contributed by the card."],
    ["Zone", "High, Mid, Low, Any, or the zones protected by Armor."],
    ["Timing", "Turn, Reaction, Anytime, Ongoing, On Reveal, Scene Change, or another explicit window."],
    ["Tags", "Rules labels such as Punch, Kick, Spin, Flow, Street, Improvised, High, or Low. Tags matter only when another rule references them."],
    ["Flavor Text", "Emotionally necessary. Mechanically irrelevant unless your dojo is dangerously committed to improv."],
  ])]),
];
c2.sections = replaceStrings(c2.sections, (text) => text.replace("Chi control", "Flow setup"));

const c4 = chapter(4);
c4.sections = [
  s("setup-steps", "Setup Steps", [
    p("1. Choose a mode. Tag Team is the recommended Core Format. Standard Clash, Quick Duel, and Dojo Drama are also supported."),
    p("2. Choose Characters. Use three per player in Tag Team and Dojo Drama, or one per player in Standard Clash or Quick Duel. Place each Character face up and set every fighter to 25 HP."),
    p("3. Take trackers. Set each player to White Belt, 0 XP, 0 Focus, and unused Tempo. Record printed ATK, DEF, and Speed."),
    p("4. Take the fixed Standard Starter Deck. Every player uses the same named 15 cards listed below. Shuffle it and draw five cards."),
    p("5. Mulligan once if needed. If your opening hand contains no Attack and no Kata, reveal it, shuffle it back, and draw five new cards. The second hand stays, even if it is a small cardboard tragedy."),
    p("6. Combine and shuffle all purchasable Techniques, Katas, Items, Weapons, Armor, Consumables, and utility cards into one shared Market Deck."),
    p("7. Reveal seven random Market cards. Keep the Combo Deck separate and face-down beside the Market."),
    p("8. Shuffle the Location Deck. Reveal the first Location during the first Honor Phase."),
    p("9. Randomly choose the opening referee to break first-round Speed ties. Pass the marker clockwise after each round."),
  ]),
  c4.sections.find((entry) => entry.id === "standard-starter-deck"),
  s("quickstart", "Quickstart", [
    p("1. Choose the mode and fighter roster. Take the identical 15-card Starter Deck, shuffle, and draw five. In Tag Team and Dojo Drama, choose one fighter to begin active."),
    p("2. Shuffle the shared Market Deck, separate face-down Combo Deck, and Location Deck. Reveal seven random Market cards; Combos never occupy Market slots."),
    p("3. Begin Honor once for the whole round: Scene Change, give each surviving player +1 XP, refresh Tempo, and order turns by current Speed."),
    p("4. Each player then takes their own I.Y.A.H. turn: Initiate, Yell, Ascend, Hide."),
    p("5. During Yell, legally play cards one at a time. A normal turn allows two Attacks. One Attack with Flow does not count against that limit. Resolve every Attack and Reaction completely before continuing."),
    p("6. Cards legally played or Equipped from hand during your own turn generate their printed Focus. During Ascend, spend Focus on Market cards or one Combo attempt."),
    p("7. Promote one Belt if you have the required XP and completed its task."),
    p("8. During Hide, resolve end effects, discard your hand and play area as required, draw a new hand, and lose unspent Focus."),
    p("9. After everyone acts, resolve end-of-round effects, refresh all seven Market slots, pass the referee marker, and begin the next round."),
    p("The whole game in one sentence: Play cards to fight and generate Focus, buy a better deck, complete Belt challenges, and reach Black Belt before everyone else—or simply knock them all out."),
  ]),
];

const c5 = chapter(5);
c5.intro = [p("Two progression resources, three combat stats, and one tiny Tempo edge. The accountants have left the dojo.")];
c5.sections = [
  s("hp-health-points", "HP — Health Points", [p("Every Character begins at 25 HP. Damage reduces current HP. Healing cannot raise a fighter above maximum HP. At 0 HP, the fighter is Knocked Out. Belt rewards increase maximum HP.")]),
  s("focus-purchasing-power", "Focus — Purchasing Power", [
    b("Focus is the game's only spendable currency. It buys face-up Market cards and revealed Combos during Ascend."),
    b("When you legally play or Equip a card from your hand during your own turn, gain its printed Focus Value. Gain it after all costs are paid and before resolving the card's effect."),
    b("Cards played outside your own turn do not generate their printed Focus Value unless their rules text explicitly grants Focus."),
    b("Focus printed on a card is not a victory value. It is the card's contribution to that turn's purchasing power."),
    b("Unspent Focus is lost during Hide. Focus does not bank between turns unless a specific effect explicitly says it does."),
    b("You may not discard an arbitrary card for Focus. Bad Habit generates 0 Focus and has no effect."),
  ]),
  s("xp-experience-points", "XP — Experience Points", [p("XP is permanent and player-wide. It unlocks Belt promotions and does not decrease unless a card explicitly says so. In Tag Team, all three Characters share the player's XP and Belt.")]),
  c5.sections.find((entry) => entry.id === "atk-def-and-speed"),
  s("tempo-advantage", "Tempo Advantage", [
    p("Once per round, when your active fighter is faster than the opposing active fighter involved in a combat, you may use Tempo for one of these benefits:"),
    t([["Timing", "Tempo benefit"], ["Your Attack", "+1 Damage to that Attack."], ["Your Defense", "+1 Guard to that Defense card."]]),
    b("Check current Speed when the Attack or Defense is legally played. A tie grants no Tempo Advantage."),
    b("Tempo belongs to the player, refreshes during Honor, and does not refresh when tagging."),
    b("Using Tempo is optional. Place or flip a token to show it has been used for the round."),
    b("If the card is later canceled or prevented, Tempo remains used."),
    b("Bosses do not use Tempo, but a faster player may use Tempo against a Boss."),
  ]),
  c5.sections.find((entry) => entry.id === "your-personal-play-area"),
];

const c6 = chapter(6);
c6.intro = [
  p("Honor • Initiate • Yell • Ascend • Hide"),
  p("A round begins with one global Honor Phase. Then, in Speed order, each player takes one complete turn consisting of Initiate, Yell, Ascend, and Hide. After the slowest fighter finishes, the round ends."),
  t([["Phase", "When", "What Happens"], ["H — Honor", "Once per round", "Scene Change, On Reveal, survival XP, refresh Tempo, determine initiative."], ["I — Initiate", "Start of each turn", "Ready cards, optional tag, Equip permanents, start effects."], ["Y — Yell", "Main phase", "Play cards, make up to two normal Attacks, trigger learned Combos, use abilities."], ["A — Ascend", "Buy and promote", "Spend Focus, attempt one Combo, promote one Belt."], ["H — Hide", "Cleanup", "End effects, discard, draw the new hand, lose unspent Focus."]]),
];
c6.sections = [
  c6.sections.find((entry) => entry.id === "honor-phase-global-round-start"),
  s("initiate-phase-start-of-your-turn", "Initiate Phase — Start of Your Turn", [
    p("1. Ready exhausted or once-per-turn cards."),
    p("2. In Tag Team, you may tag once now. Tagging does not refresh Tempo."),
    p("3. Equip any number of permanent Equipment cards from your hand. Respect all slots and Hand limits. Each legally Equipped card generates its printed Focus Value."),
    p("4. Resolve start-of-turn effects in the order you choose."),
  ]),
  s("yell-phase-play-cards", "Yell Phase — Play Cards", [
    p("Play one card at a time and resolve it completely before playing another, unless a Reaction interrupts it. You may play Katas, use Items, activate Equipment, make up to two normal Attacks, and trigger learned Combos as long as every action is legal."),
    p("Flow and Combo Extension may each permit one additional Attack beyond the normal two-Attack limit. See Sections 7, 8, and 10."),
  ]),
  s("ascend-phase-buy-and-belt-up", "Ascend Phase — Buy and Belt Up", [
    b("Spend Focus on any number of face-up Market cards. Put each purchase in your discard pile, then immediately refill its slot."),
    b("Once per turn, reveal the top card of the separate Combo Deck. Pay its Focus Cost to learn it, or return it face-down to the bottom. Either choice uses your Combo attempt."),
    b("A learned Combo stays face up beside your fighter and never enters your hand, draw deck, or discard pile."),
    b("Promote up to one Belt if you meet its XP threshold and completed its promotion task."),
  ]),
  s("hide-phase-cleanup", "Hide Phase — Cleanup", [
    p("1. Resolve end-of-turn effects. Set aside cards drawn or added to your hand by this step until cleanup is complete."),
    p("2. Discard all cards in your play area and hand except Equipped, Ongoing, Reserved, otherwise retained cards, and cards set aside by Step 1."),
    p("3. Draw your normal new hand of five cards, or six at Blue Belt, shuffling your discard pile only when needed. Then add the cards set aside by Step 1."),
    p("4. Set Focus to 0."),
  ]),
  s("end-of-the-round", "End of the Round", [
    p("1. Resolve Location and card effects that occur at end of round."),
    p("2. In Tag Team, benched fighters do not recover HP automatically."),
    p("3. Discard all seven unpurchased Market cards and reveal seven fresh random cards from the mixed Market Deck."),
    p("4. Pass the referee marker clockwise and begin the next Honor Phase."),
  ]),
];

const c7 = chapter(7);
c7.sections = [
  s("the-four-steps-of-playing-a-card", "The Four Steps of Playing a Card", [
    p("1. Announce the card and all required choices: target, zone, mode, or affected Equipment."),
    p("2. Check legality. Satisfy timing, target, prerequisite, slot, Attack-limit, and other requirements."),
    p("3. Pay any specific printed costs, such as discarding a card, exhausting Equipment, losing HP, or performing text before a colon. Paid costs are not refunded if the effect is later prevented."),
    p("4. If this card was legally played or Equipped from your hand during your own turn, gain its printed Focus Value. Then resolve the text from top to bottom and place the card in its proper area."),
    p("Cards have no general play cost. A printed Focus Cost is paid only when buying the card from the Market or learning it from the Combo Deck."),
  ]),
  s("flow", "Flow", [
    t([["FLOW\nThe first Attack you play with Flow each turn does not count against your normal two-Attack limit. Only one Attack can be exempted by Flow each turn, even if more than one Attack gains Flow. Flow changes only the Attack limit; it does not make an illegal target, timing, zone, or Combo step legal."]]),
    p("An effect that says your next Attack gains Flow lasts until that Attack is played or the turn ends. If multiple effects grant Flow to the same Attack, they do not create multiple exemptions."),
  ]),
  s("junk-and-bad-habits", "Junk & Bad Habits", [
    p("Bad Habit may be legally played during Yell, but it has no effect and generates 0 Focus. It can still matter when another effect counts, reveals, discards, or destroys Junk."),
    p("There is no universal discard-for-Focus action. A discard produces Focus only when a specific card or rule says it does."),
  ]),
  c7.sections.find((entry) => entry.id === "drawing-and-reshuffling"),
  c7.sections.find((entry) => entry.id === "gaining-discarding-destroying-and-returning"),
  c7.sections.find((entry) => entry.id === "reserved-and-ongoing-cards"),
];

const c8 = chapter(8);
c8.sections = c8.sections.map((entry) => {
  if (entry.id === "tempo-in-combat") return s("tempo-in-combat", "Tempo in Combat", [p("When your active fighter is faster than the opposing active fighter involved in a combat, you may spend your once-per-round Tempo for +1 Damage on your Attack or +1 Guard on your Defense card. Check current Speed when the card is legally played. See Section 5 for edge cases.")]);
  if (entry.id === "multiple-attacks") return s("multiple-attacks", "Attack Limit, Flow & Combo Extension", [
    b("You may normally play no more than two Attack cards during your turn. Each Attack resolves as a separate strike."),
    b("Once per turn, an Attack with Flow does not count against the normal limit."),
    b("Once per turn, if a learned Combo requires a third Attack as its Finishing Technique, Combo Extension permits that required Attack even if the normal limit has been reached."),
    b("Flow and Combo Extension are separate exceptions and may both occur in one turn. Neither permits unrelated extra Attacks."),
    b("Bonuses that say ‘your next Attack’ expire after one strike, even if it is Blocked."),
  ]);
  return entry;
});

const c9 = chapter(9);
c9.intro = [p("Equipment is a family of permanent and one-use cards. There is no general cost to Equip or use them; follow timing, slots, Hand limits, and any specific printed cost.")];
c9.sections = c9.sections.map((entry) => {
  if (entry.id === "equipping-permanent-equipment") return s(entry.id, entry.title, [
    b("Equip permanent Equipment only during Initiate unless a card says otherwise."),
    b("The card must be in your hand. Place it beside the Character receiving it and gain its printed Focus Value."),
    b("Newly purchased Equipment goes to your discard pile and cannot be equipped immediately."),
    b("You may Equip multiple cards if you have legal slots. Replacing an occupied slot discards the old Equipment first."),
  ]);
  if (entry.id === "consumables") return s(entry.id, entry.title, [
    p("Consumables are one-use Equipment. Play them during their printed timing, resolve the effect, then return the card to the box or Consumable supply. Consumables do not enter the Destroyed pile unless the card says Destroy."),
    p("In Tag Team, a healing Consumable without a named target may heal your active Character or one conscious benched Character. A KO'd Character requires Revive."),
  ]);
  return entry;
});

const c10 = chapter(10);
c10.sections = c10.sections.map((entry) => {
  if (entry.id === "the-shared-market") return s(entry.id, entry.title, [
    b("The Market is one seven-card face-up row drawn from a single shuffled Market Deck containing purchasable Attacks, Defenses, Katas, Items, Weapons, Armor, Consumables, and utility cards."),
    b("The available mix is entirely random. No card type is guaranteed a slot."),
    b("During Ascend, buy cards one at a time by paying printed Focus Costs. Put each purchase in your discard pile and immediately refill its slot."),
    b("The Combo Deck is separate, face-down, and never contributes cards to the Market."),
    b("At end of round, discard every unpurchased Market card and reveal seven fresh cards."),
  ]);
  if (entry.id === "builds-not-archetypes") return s(entry.id, entry.title, [p("You never declare a deck archetype. Builds emerge through purchases. Common engines include Momentum, Fortress, Sustain, Pressure, Arsenal, Economy, Flow/Kata, Counter, Control, Combo, and Deck-Thin. These are strategy labels, not restrictions.")]);
  if (entry.id === "learning-combos") return s(entry.id, entry.title, [
    b("The face-down Combo Deck is separate from the Market. Each Combo shows a Focus Cost, Sequence or Requirement, Effect, Timing Type / Limit, and relevant Tags."),
    b("Once during Ascend, reveal the top Combo. Pay its Focus Cost to learn it; if you decline or cannot pay, return it face-down to the bottom. You may know a maximum of two Combos."),
    b("Complete a Combo's printed sequence in order. Unless stated otherwise, all listed actions occur during the same turn and must use the same named opponent."),
    b("Other legal actions may occur between steps unless the Combo says Consecutive."),
  ]);
  if (entry.id === "combo-timing-modifier-vs-aftermath") return s(entry.id, entry.title, [
    b("Modifier Combo: after all earlier steps, announce the final required step and choices, then apply the Combo's modifier before calculating that step. The final step must still be legal."),
    b("Aftermath Combo: after the entire printed sequence resolves, resolve the Combo's payoff."),
    b("Combo Extension: once per turn, if a learned Combo requires a third Attack as its Finishing Technique, that required Attack is legal beyond the normal two-Attack limit. It must be the actual next required step."),
    b("A Combo marked Once per turn or Once per round cannot trigger again until its printed limit refreshes. Flip it face down as a reminder."),
    b("Learned Combos are not cards in hand, do not generate Focus, are not discarded during Hide, and do not count as cards played."),
    p("Combo Example — Swan Song: a Low or Mid Kick must Hit. When you later announce a High Kick against the same opponent, apply Swan Song's modifier to that High Kick, then resolve it normally. If the opening Kick did not Hit, the Combo is not ready."),
  ]);
  if (entry.id === "locations-and-scene-changes") {
    entry.content = replaceStrings(entry.content, (text) => text.replace(/, refresh Chi,/g, ", refresh Focus or Tempo,"));
  }
  return entry;
});

const c11 = chapter(11);
const belt = c11.sections.find((entry) => entry.id === "belt-table");
belt.content = [t([
  ["Belt", "XP", "Promotion Task", "Reward"],
  ["White", 0, "Exist. Try not to sprain anything while shuffling.", "None"],
  ["Yellow", 5, "While White, play at least one legal High, Mid, and Low Attack across one or more turns.", "+10 Max HP; active heals 5"],
  ["Orange", 10, "During one turn, play at least 2 legal Attacks and Hit with at least 1.", "+1 ATK; +10 Max HP; active heals 5"],
  ["Green", 15, "During one round, play a legal Attack on your turn and a legal Defense outside your turn.", "Unlock Green Ability; +10 Max HP; active heals 5"],
  ["Purple", 21, "While Green, buy at least one Market card from two different card types across one or more Ascend Phases.", "Once per turn, your second card played or Equipped from hand generates +1 Focus; +10 Max HP; active heals 5"],
  ["Blue", 28, "Have at least 2 permanent Equipment cards Equipped at the same time.", "+1 Hand Size; +10 Max HP; active heals 5"],
  ["Red", 36, "Trigger a learned Combo.", "First 3+ damage Hit each turn: +1 Focus; +10 Max HP; active heals 5"],
  ["Brown", 45, "During one turn, play at least 4 cards including an Attack, a Kata, and an Equipment or Consumable.", "+1 DEF; +10 Max HP; active heals 5"],
  ["Black", 55, "While Brown Belt, KO an opposing fighter.", "+10 Max HP; win"],
])];
const tasks = c11.sections.find((entry) => entry.id === "task-clarifications");
tasks.content = [
  b("Three Zones (Yellow): Track High, Mid, and Low separately. An Any Attack counts as the declared zone."),
  b("Two-Attack Test (Orange): Both Attacks must be legal and played during the same turn. At least one must Hit."),
  b("Attack and Defend (Green): Both cards must be legal and played in the same round. The Defense must be played outside your own turn."),
  b("Two Market Types (Purple): Track distinct purchased types among Attack, Defense, Kata, and Item. Purchases need not occur during the same Ascend."),
  b("Equip Two (Blue): Any two permanent Equipment cards attached at the same time."),
  b("Four-Card Mastery (Brown): At least four cards legally played or Equipped from hand during one turn, including the listed types."),
  b("Black Belt Target: While Brown Belt, KO any opposing fighter. Bosses count. Complete the task immediately, but promote during your Ascend unless a scenario says otherwise."),
];

// Small system references in unaffected later chapters.
rules.chapters = replaceStrings(rules.chapters, (text) => text
  .replace("A player's deck, hand, Chi, Focus, XP, and Belt belong", "A player's deck, hand, Focus, XP, and Belt belong")
  .replace("one hand, one Chi pool, one Focus total, one XP total", "one hand, one Focus total, one XP total")
  .replace("a hand, deck, Chi, Focus, Equipment, or player choice", "a hand, deck, Focus, Equipment, or player choice")
  .replace("spend Chi or Focus", "spend Focus")
  .replace("lose or spend Focus/Chi", "lose or spend Focus")
  .replace("cards, Focus, Chi, XP, Equipment", "cards, Focus, XP, Equipment")
  .replace("Pay 1 Chi:", "Discard 1 card:")
  .replace("Highest Focus cost wins", "Highest Focus Cost wins"));

rules.houseRules = [
  { name: "Steal the Belt", category: "Promotion", summary: "KO a peer and finish the task—not the XP.", rule: "When you KO an opposing non-Boss fighter at your Belt or higher, mark your current promotion task complete. You still need the required XP and must promote during Ascend.", notes: "Accelerates task completion without bypassing the XP race." },
  { name: "Corner Advice", category: "Comeback", summary: "Once per game, your bench calls the play.", rule: "Once per game during Initiate, draw 2 cards, then discard 2 cards. In a one-Character mode, you may still use this rule; imagine a very loud folding chair.", notes: "Replaces the old resource-banking variant with bounded hand selection that cannot compound into permanent currency." },
  { name: "Secret Kata Night", category: "Market Chaos", summary: "Buy the cost; discover the Kata afterward.", rule: "When a Kata enters the Market, cover its name, rules text, tags, and Focus Value while leaving its Focus Cost visible. Reveal it only after purchase.", notes: "Use sleeves or blank cards as covers so no card is marked or damaged." },
  { name: "Crowd Favorite", category: "Catch-Up", summary: "The trailing fighter gets one dramatic save per round.", rule: "At Honor, the sole player or team with the lowest XP takes the Crowd token. Once that round after their active fighter is Hit, they may spend it to draw 1 card, then discard 1 card; their next Defense card that round gets +1 Guard. Tied-lowest players receive no token.", notes: "A bounded defensive nudge with no currency farming." },
  { name: "Training Montage", category: "Deck Control", summary: "Lose one action phase to clean up your act.", rule: "Once per game at the start of Yell, skip the rest of that Yell. Heal your active fighter 4 HP and Destroy one Junk card from your hand or discard pile.", notes: "The immediate lost phase pays for bounded healing and thinning." },
  { name: "Friendly Fire", category: "Team Chaos", summary: "Teammates may attack each other—without farming rewards.", rule: "In team play, active fighters may target allied active fighters. The first allied Attack each round resolves normally but grants no XP, promotion-task credit, KO reward, Tempo, or learned Combo trigger to either teammate.", notes: "The once-per-round limit keeps the joke tactical instead of becoming an engine." },
  { name: "Market Mercy", category: "Market", summary: "Unbought cards linger until the table truly stalls.", rule: "Do not discard unpurchased Market cards at end of round. Refill purchased spaces normally. If a complete round ends with no Market purchase, discard and refill all seven slots.", notes: "The forced refresh prevents an unwanted Market from freezing the game." },
  { name: "Fast Belts", category: "Short Game", summary: "Later promotions arrive three XP sooner.", rule: "Use the normal Yellow threshold. Reduce every later Belt threshold by 3, to a minimum of 1 XP above the previous Belt. Tasks and the one-promotion-per-turn limit remain unchanged.", notes: "Best for demos and weeknight games." },
  { name: "Scroll Shopping", category: "Combo Control", summary: "Pay extra to browse three future mistakes.", rule: "For your Combo attempt, reveal the top three Combo cards instead of one. Choose one to learn by paying its Focus Cost plus 1 Focus, then shuffle the others back. If you learn none, return all three and shuffle.", notes: "Preserves the separate face-down deck and one-attempt limit while adding choice." },
];

rules.glossary = [
  { term: "Aftermath Combo", meaning: "A learned Combo whose payoff resolves after its entire printed sequence resolves." },
  { term: "Anytime", meaning: "Timing that permits play between actions or in a Reaction Window when you have priority; never during another effect's resolution." },
  { term: "Attack Limit", meaning: "A player may normally play two Attacks per turn. Flow and Combo Extension are the only core exceptions." },
  { term: "Boss Stage", meaning: "A Rival, Mini-Boss, or Final Boss overlay supplying HP, Attack Bonus, attack count, and stage rules." },
  { term: "Combo", meaning: "A learned sequence from the separate face-down Combo Deck. Complete its requirement and resolve its payoff." },
  { term: "Combo Extension", meaning: "Once per turn, permission to play the third Attack required as a learned Combo's Finishing Technique beyond the normal Attack limit." },
  { term: "Consumable", meaning: "One-use Equipment returned to the box or supply after resolving." },
  { term: "Current Speed", meaning: "Printed Speed plus active modifiers. Used for initiative, Tempo, Boss comparisons, and card effects unless text says printed Speed." },
  { term: "Destroy", meaning: "Remove a card from the game to the public Destroyed pile." },
  { term: "Direct Damage", meaning: "HP loss that is not an Attack; it normally uses no ATK, Weapons, Tempo, Combo steps, Attack XP, or Defense window." },
  { term: "Enraged", meaning: "Solo Final Boss state at 30 HP or less; it makes two Boss Technique Attacks during its Boss Turn." },
  { term: "Finishing Technique", meaning: "The final required card or action in a Combo sequence." },
  { term: "Flow", meaning: "The first Attack with Flow each turn does not count against the normal two-Attack limit. Only one Attack receives this exemption per turn." },
  { term: "Focus", meaning: "Temporary purchasing power. Cards played or Equipped from hand during your own turn generate printed Focus; spend it during Ascend and lose the remainder during Hide." },
  { term: "Focus Cost", meaning: "The amount of Focus required to buy a Market card or learn a revealed Combo. It is not a play cost or victory value." },
  { term: "Golden Rule", meaning: "When a card directly contradicts the rulebook, the card wins. If ambiguity remains after timing and priority, the active player makes a temporary ruling." },
  { term: "Interfere", meaning: "A Reaction played by a bystander during another player's conflict." },
  { term: "KO", meaning: "A Character reaches 0 HP." },
  { term: "Market", meaning: "The seven-card shared face-up purchase area filled randomly from one mixed deck. Combos are separate." },
  { term: "Modifier Combo", meaning: "A learned Combo that changes its final required step before that step resolves." },
  { term: "Ongoing", meaning: "A card or effect that remains active in play." },
  { term: "Piercing X", meaning: "Ignore X Armor DEF for an Attack; do not ignore Character DEF or a Defense card." },
  { term: "Reaction", meaning: "A card or ability played during a specific response window." },
  { term: "Reserved", meaning: "A card held in a marked area until its future trigger." },
  { term: "Revive", meaning: "Restore a KO'd Character to the printed HP amount without restoring discarded Equipment." },
  { term: "Round", meaning: "One Honor Phase plus every eligible player and Boss turn in the initiative order locked during Honor." },
  { term: "Scene Change", meaning: "After its triggering effect finishes, replace the current Location and resolve On Reveal." },
  { term: "Tempo Advantage", meaning: "Once per round, a faster active fighter may give their Attack +1 Damage or their Defense card +1 Guard against a slower opposing active fighter." },
  { term: "Unblockable", meaning: "Defense cards cannot be played; Character DEF and Armor still apply unless text says otherwise." },
  { term: "XP", meaning: "Permanent Experience used for Belt promotion and Black Belt Victory. XP is not spent." },
];

// Keep the source chapter records for export/search, but the website's Full Rules reader intentionally displays only Chapters 2–16.
chapter(17).intro = [p("House rules live in the dedicated House Rules section of the companion site so they can be searched and opened individually.")];
chapter(17).sections = [];
chapter(18).intro = [p("The glossary lives in the dedicated Glossary section of the companion site.")];
chapter(18).sections = [];
chapter(19).intro = [p("The Quick Start lives in the dedicated Quick Start section of the companion site.")];
chapter(19).sections = [];

const prohibited = /\bChi\b|\bFP\b|Banked Focus|Trigger Focus|Discarding for Focus|discard for Focus/i;
const leftovers = [];
for (const entry of rules.chapters) {
  const match = JSON.stringify(entry).match(prohibited);
  if (match) leftovers.push(`Chapter ${entry.number}: ${match[0]}`);
}
for (const entry of [...rules.glossary, ...rules.houseRules]) {
  const match = JSON.stringify(entry).match(prohibited);
  if (match) leftovers.push(`${entry.term ?? entry.name}: ${match[0]}`);
}
if (leftovers.length) throw new Error(`Prohibited economy text remains:\n${leftovers.join("\n")}`);

fs.writeFileSync(rulesPath, `${JSON.stringify(rules, null, 2)}\n`);
console.log(`Migrated ${rules.chapters.length} source chapters, ${rules.glossary.length} glossary terms, and ${rules.houseRules.length} house rules to ${rules.version}.`);
