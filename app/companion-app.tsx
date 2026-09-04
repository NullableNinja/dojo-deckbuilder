"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import brandEmblemUrl from "./assets/art/brand-emblem.webp";
import cardPlaceholderUrl from "./assets/art/card-placeholder-v2.webp";
import headerBackstoryUrl from "./assets/art/header-backstory-v2.webp";
import headerCardsUrl from "./assets/art/header-cards-v2.webp";
import headerGlossaryUrl from "./assets/art/header-glossary-v2.webp";
import headerHouseRulesUrl from "./assets/art/header-house-rules-v2.webp";
import headerQuickstartUrl from "./assets/art/header-quickstart-v2.webp";
import headerRulesUrl from "./assets/art/header-rules-v2.webp";
import headerRulingsUrl from "./assets/art/header-rulings-v2.webp";
import heroPaperFuUrl from "./assets/art/hero-paper-fu-v2.webp";
import chapterComponentsUrl from "./assets/rules/chapter-02-components-v2.webp";
import chapterModesUrl from "./assets/rules/chapter-03-modes-v2.webp";
import chapterSetupUrl from "./assets/rules/chapter-04-setup-v2.webp";
import chapterStatsUrl from "./assets/rules/chapter-05-stats-v2.webp";
import chapterRoundUrl from "./assets/rules/chapter-06-round-v2.webp";
import chapterTimingUrl from "./assets/rules/chapter-07-timing-v2.webp";
import chapterCombatUrl from "./assets/rules/chapter-08-combat-v2.webp";
import chapterEquipmentUrl from "./assets/rules/chapter-09-equipment-v2.webp";
import chapterMarketUrl from "./assets/rules/chapter-10-market-v2.webp";
import chapterBeltsUrl from "./assets/rules/chapter-11-belts-v2.webp";
import chapterCharactersUrl from "./assets/rules/chapter-12-characters-v2.webp";
import chapterTagTeamUrl from "./assets/rules/chapter-13-tag-team-v2.webp";
import chapterBossUrl from "./assets/rules/chapter-14-boss-v2.webp";
import chapterPriorityUrl from "./assets/rules/chapter-15-priority-v2.webp";
import chapterEndgameUrl from "./assets/rules/chapter-16-endgame-v2.webp";
import honorableTrashPandaUrl from "./assets/characters/core-roster/honorable-trash-panda.webp";
import karatesaurusUrl from "./assets/characters/core-roster/karatesaurus.webp";
import janitorJoeUrl from "./assets/characters/core-roster/janitor-joe.webp";
import missDirectionUrl from "./assets/characters/core-roster/miss-direction.webp";
import starterJabArtUrl from "./assets/starter/starter-jab-art-v2.webp";
import highGuardArtUrl from "./assets/starter/high-guard-art-v2.webp";
import cardsJson from "./data/cards.json";
import rulesJson from "./data/rules.json";
import gameDefinitionJson from "./data/game-definition.json";

import PlaytestView from "./playtest";

const characterCardModules = import.meta.glob<string>("./assets/cards/characters/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});
const CHARACTER_CARD_URLS = Object.fromEntries(
  Object.entries(characterCardModules).map(([path, url]) => [`/cards/characters/${path.split("/").at(-1)}`, url]),
);

const bossCardModules = import.meta.glob<string>("./assets/cards/bosses/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});
const BOSS_CARD_URLS = Object.fromEntries(
  Object.entries(bossCardModules).map(([path, url]) => [`/cards/bosses/${path.split("/").at(-1)}`, url]),
);

const attackCardModules = import.meta.glob<string>("./assets/cards/attacks/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});
const ATTACK_CARD_URLS = Object.fromEntries(
  Object.entries(attackCardModules).map(([path, url]) => [`/cards/attacks/${path.split("/").at(-1)}`, url]),
);

const defenseCardModules = import.meta.glob<string>("./assets/cards/defenses/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});
const DEFENSE_CARD_URLS = Object.fromEntries(
  Object.entries(defenseCardModules).map(([path, url]) => [`/cards/defenses/${path.split("/").at(-1)}`, url]),
);

const kataCardModules = import.meta.glob<string>("./assets/cards/katas/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});
const KATA_CARD_URLS = Object.fromEntries(
  Object.entries(kataCardModules).map(([path, url]) => [`/cards/katas/${path.split("/").at(-1)}`, url]),
);

const consumableCardModules = import.meta.glob<string>("./assets/cards/consumables/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});
const CONSUMABLE_CARD_URLS = Object.fromEntries(
  Object.entries(consumableCardModules).map(([path, url]) => [`/cards/consumables/${path.split("/").at(-1)}`, url]),
);
const defenseEquipmentCardModules = import.meta.glob<string>("./assets/cards/defense-equipment/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});
const DEFENSE_EQUIPMENT_CARD_URLS = Object.fromEntries(
  Object.entries(defenseEquipmentCardModules).map(([path, url]) => [`/cards/defense-equipment/${path.split("/").at(-1)}`, url]),
);
const gearCardModules = import.meta.glob<string>("./assets/cards/gear/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});
const GEAR_CARD_URLS = Object.fromEntries(
  Object.entries(gearCardModules).map(([path, url]) => [`/cards/gear/${path.split("/").at(-1)}`, url]),
);
const COMPLETE_CARD_URLS_BY_CATALOG_ID = Object.fromEntries(
  Object.entries({ ...ATTACK_CARD_URLS, ...DEFENSE_CARD_URLS, ...KATA_CARD_URLS, ...CONSUMABLE_CARD_URLS, ...DEFENSE_EQUIPMENT_CARD_URLS, ...GEAR_CARD_URLS }).flatMap(([path, url]) => {
    const match = path.match(/\/(ddb-(?:atk|def|kat|con|deq|gea)-core-\d{3})_/i);
    return match ? [[match[1].toUpperCase(), url]] : [];
  }),
);

type ViewId = "home" | "playtest" | "quickstart" | "story" | "rules" | "cards" | "rulings" | "glossary" | "house-rules";
type CardEntry = {
  id: string; name: string; cardType: string; subtype: string; category?: string | null;
  catalogId: string; catalogOrder: number;
  deck: string; rulesVersion: string; lineage?: string | null; availability?: "Core Field Test" | string; v2Status?: string;
  fpCost?: string | number | null; chiCost?: string | number | null; focusValue?: string | number | null;
  zone?: string | null; timing?: string | null; rulesText?: string | null; flavorText?: string | null;
  tags: string[]; buildPaths: string[]; stats: Record<string, string | number>;
  image?: string | null; sourceSheet: string; sourceRulesVersion?: string | null; searchText?: string; details: Record<string, string | number>;
};
type RuleBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "table"; rows: (string | number)[][] };
type RuleSection = { id: string; title: string; content: RuleBlock[] };
type RuleChapter = { id: string; number: number; title: string; fullTitle: string; intro: RuleBlock[]; sections: RuleSection[] };
type HouseRule = { name: string; rule: string; category?: string; summary?: string; notes?: string };
type OfficialRuling = { id: string; filed: string; tag: string; title: string; ruling: string };
type Theme = "light" | "dark";
type RuleVisual = { label: string; quip: string; art: string; alt: string };
type GlobalResult = { type: "Card" | "Glossary" | "Rule" | "Ruling" | "House Rule"; title: string; detail: string; view: ViewId; card?: CardEntry | null; query?: string; chapterId?: string; sectionId?: string };

const cardData = cardsJson as unknown as { version: string; cards: CardEntry[]; counts: Record<string, number>; decks: string[]; total: number };
const rulesData = rulesJson as { version: string; chapters: RuleChapter[]; officialRulings: OfficialRuling[]; glossary: { term: string; meaning: string }[]; houseRules: HouseRule[] };
const gameDefinition = gameDefinitionJson as { rulesVersion: string; rulesRevision: string };
const CURRENT_RULES_REVISION = gameDefinition.rulesRevision;
const BINDER_STORAGE_KEY = "dojo-binder-v1";
const RULES_SEEN_STORAGE_KEY = "dojo-rules-seen-revision";
const RULES_REVISION_NOTES = [
  "Yell no longer has a two-Attack cap: play any number of legal Attacks from your hand and resolve each separately.",
  "Defense Practice is once per Yell and grants only that Defense card’s printed Focus—no Guard, rules text, or Defense XP.",
  "The Market now refills immediately after each purchase by revealing the top card for the empty slot.",
  "Quick Duel uses fixed 25 HP while keeping the normal Belt perks and rewards active.",
];
const SEARCH_GROUP_ORDER: GlobalResult["type"][] = ["Card", "Rule", "Glossary", "Ruling", "House Rule"];
const SEARCH_GROUP_LABELS: Record<GlobalResult["type"], string> = { Card: "Cards", Rule: "Rules", Glossary: "Glossary", Ruling: "Rulings", "House Rule": "House Rules" };
const readStoredStringSet = (key: string) => {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return new Set<string>(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
  } catch {
    return new Set<string>();
  }
};
const storyChapter = rulesData.chapters.find((chapter) => chapter.number === 1);
const ruleChapters = rulesData.chapters.filter((chapter) => chapter.number >= 1 && chapter.number <= 16);
const glossaryKey = (term: string) => term.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
const GLOSSARY_ENTRIES = Array.from(new Map(rulesData.glossary.map((entry) => [glossaryKey(entry.term), entry])).values()).sort((a, b) => a.term.localeCompare(b.term));
const DOWNLOADS = {
  fullRules: `${import.meta.env.BASE_URL}downloads/Dojo_Deckbuilder_v2.3_Full_Rules.docx`,
  quickStart: `${import.meta.env.BASE_URL}downloads/Dojo_Deckbuilder_v2.3_Quick_Start.docx`,
  glossary: `${import.meta.env.BASE_URL}downloads/Dojo_Deckbuilder_v2.3_Glossary.docx`,
  cardCatalog: `${import.meta.env.BASE_URL}downloads/Dojo_Deckbuilder_v2.3_Card_Catalog.xlsx`,
  defenseEquipmentSources: `${import.meta.env.BASE_URL}downloads/Dojo_Deckbuilder_v2.3_Defensive_Equipment_Editable_ORA.zip`,
  consumableSources: `${import.meta.env.BASE_URL}downloads/Dojo_Deckbuilder_v2.3_Consumable_Cards_Editable_ORA.zip`,
  gearSources: `${import.meta.env.BASE_URL}downloads/Dojo_Deckbuilder_v2.3_Gear_Editable_ORA.zip`,
};
const publicCardDetails = (card: CardEntry): [string, string | number][] => [
  ["Focus Cost", card.fpCost ?? "—"],
  ["Focus Value", card.focusValue ?? "—"],
  ["Stats", Object.entries(card.stats).map(([key, value]) => `${key}: ${value}`).join("; ") || "—"],
  ["Tags", card.tags.join(", ") || "—"],
  ["Build Paths", card.buildPaths.join(", ") || "—"],
  ["Availability", card.availability ?? "—"],
  ["Design Purpose", card.details["Design Purpose"] ?? "—"],
  ["Playtest Focus", card.details["Playtest Focus"] ?? "—"],
  ["Source Version", card.sourceRulesVersion ?? "—"],
];
const cardSearchText = (card: CardEntry) => [card.catalogId, card.name, card.cardType, card.subtype, card.category, card.deck, card.lineage, card.zone, card.timing, card.rulesText, card.flavorText, ...card.tags, ...card.buildPaths, ...Object.keys(card.stats), ...Object.values(card.stats), ...publicCardDetails(card).flatMap(([key, value]) => [key, value])].filter((value) => value !== null && value !== undefined && value !== "").join(" ").toLocaleLowerCase();
const searchResultRank = (result: GlobalResult, term: string) => {
  const title = result.title.toLocaleLowerCase();
  const detail = result.detail.toLocaleLowerCase();
  if (title === term || detail === term || detail.startsWith(`${term} ·`)) return 0;
  if (title.startsWith(term)) return 1;
  if (title.includes(term)) return 2;
  if (detail.startsWith(term)) return 3;
  return 4;
};

const NAV_ITEMS: { id: ViewId; label: string; short: string }[] = [
  { id: "playtest", label: "Play the Game", short: "Play" },
  { id: "quickstart", label: "Quick Start", short: "Start" },
  { id: "story", label: "Backstory", short: "Story" },
  { id: "rules", label: "Full Rules", short: "Rules" },
  { id: "cards", label: "Card Library", short: "Cards" },
  { id: "rulings", label: "Rulings & Errata", short: "Rulings" },
  { id: "glossary", label: "Glossary", short: "Terms" },
  { id: "house-rules", label: "House Rules", short: "Variants" },
];
const VIEW_LABELS: Record<ViewId, string> = {
  home: "Dojo Desk",
  playtest: "Field Test",
  quickstart: "Quick Start",
  story: "Backstory",
  rules: "Full Rules",
  cards: "Card Library",
  rulings: "Rulings",
  glossary: "Glossary",
  "house-rules": "House Rules",
};
const MOBILE_MENU_ITEMS: { id: ViewId; label: string; detail: string }[] = [
  { id: "home", label: "Home", detail: "Return to the Dojo Desk." },
  { id: "playtest", label: "Play the Game", detail: "Fight the computer using the live card catalog." },
  { id: "quickstart", label: "Quick Start", detail: "Set up and play the first round." },
  { id: "story", label: "Backstory", detail: "Why a filing cabinet became sacred." },
  { id: "rules", label: "Full Rules", detail: "Every official procedure." },
  { id: "cards", label: "Card Library", detail: "Search the registered curriculum." },
  { id: "rulings", label: "Rulings & Errata", detail: "The Department’s clarifications." },
  { id: "glossary", label: "Glossary", detail: "Find every defined term." },
  { id: "house-rules", label: "House Rules", detail: "Approved deviations and variants." },
];
const ALL_VIEWS: ViewId[] = ["home", ...NAV_ITEMS.map((item) => item.id)];
const decodeHashPart = (value = "") => { try { return decodeURIComponent(value); } catch { return value; } };
const dojoHash = (view: ViewId, detail?: string, subdetail?: string) => `#${[view, detail, subdetail].filter((part): part is string => Boolean(part)).map((part, index) => index === 0 ? part : encodeURIComponent(part)).join("/")}`;
const parseDojoHash = () => {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return { view: "home" as ViewId, detail: "", subdetail: "" };
  const [rawView, rawDetail = "", rawSubdetail = ""] = raw.split("/");
  const view = ALL_VIEWS.includes(rawView as ViewId) ? rawView as ViewId : "home";
  return { view, detail: decodeHashPart(rawDetail), subdetail: decodeHashPart(rawSubdetail) };
};
const HERO_FIGHTERS = [
  { name: "Honorable Trash Panda", image: honorableTrashPandaUrl, type: "Fights With Honor. Mostly." },
  { name: "Karatesaurus", image: karatesaurusUrl, type: "Extinction-Level Kicks" },
  { name: "Janitor Joe", image: janitorJoeUrl, type: "Mop-Fu Specialist" },
  { name: "Miss Direction", image: missDirectionUrl, type: "Points Somewhere Else" },
];
const CARD_IMAGE_URLS: Record<string, string> = {
  ...CHARACTER_CARD_URLS,
  ...BOSS_CARD_URLS,
  ...ATTACK_CARD_URLS,
  ...DEFENSE_CARD_URLS,
  ...KATA_CARD_URLS,
  ...CONSUMABLE_CARD_URLS,
  ...DEFENSE_EQUIPMENT_CARD_URLS,
  ...GEAR_CARD_URLS,
};
const PHASES = [
  { letter: "H", name: "Honor", text: "Scene Change, survival XP, refresh Tempo, set initiative." },
  { letter: "I", name: "Initiate", text: "Ready cards, optionally tag, then equip permanent gear." },
  { letter: "Y", name: "Yell", text: "Play cards, Practice one Defense, attack, and trigger Combos." },
  { letter: "A", name: "Ascend", text: "Spend Focus, buy cards, refill the row, and promote." },
  { letter: "H", name: "Hide", text: "Resolve end effects, clean up, draw, lose unspent Focus." },
];
const PHASE_DETAILS = [
  { name: "Honor", when: "Once at the beginning of the round", who: "Everyone together", steps: ["Scene Change and resolve the new Location.", "Every surviving player gains 1 XP.", "Refresh each player's Tempo.", "Lock initiative from highest current Speed to lowest."], quip: "One Honor. One Location. Several people insisting they were faster." },
  { name: "Initiate", when: "At the beginning of each player's turn", who: "The active player", steps: ["Ready exhausted cards and resolve start-of-turn effects.", "Tag once if the mode allows it.", "Equip permanent Equipment from your hand.", "Generate printed Focus from each card legally Equipped from hand."], quip: "Stretch, breathe, attach the suspicious helmet." },
  { name: "Yell", when: "The active player's main phase", who: "The active player, with Reactions from others", steps: ["Play cards one at a time; there is no general play cost.", "Once, Practice one Defense from hand for its printed Focus only.", "Play any number of legal Attacks from your hand, resolving each separately.", "After your first Flow Attack each turn resolves, draw one card."], quip: "Practice the block. Spend the block. Try not to need the block." },
  { name: "Ascend", when: "After the active player finishes acting", who: "The active player", steps: ["Spend Focus on face-up Market cards.", "After each purchase, reveal the top Market card to refill its slot.", "Attempt to learn at most one Combo from the separate deck.", "Promote at most one Belt if its XP and task are complete."], quip: "Turn questionable decisions into a slightly better deck." },
  { name: "Hide", when: "At the end of each player's turn", who: "The active player", steps: ["Resolve end-of-turn effects.", "Discard played cards and the remaining hand.", "Draw the next hand.", "Lose unspent Focus."], quip: "Clean the paper cuts off the mat and pretend it was tactical." },
];
const STARTER_CARDS = [
  { group: "Attacks", count: 4, icon: "A", purpose: "Deal damage and declare a combat zone.", cards: ["Basic Jab", "Basic Body Kick", "Basic Shin Kick", "Wild Swing"] },
  { group: "Defenses", count: 4, icon: "D", purpose: "Answer an Attack matching its zone.", cards: ["High Guard", "Center Guard", "Low Guard", "Cover Up"] },
  { group: "Katas", count: 2, icon: "K", purpose: "Set up your next move or alter your Speed.", cards: ["Breathing Drill", "Footwork Drill"] },
  { group: "Junk", count: 5, icon: "!", purpose: "Clog the opening deck and generate no Focus.", cards: ["Bad Habit ×5"] },
];
const GOLDEN_RULE = ruleChapters.flatMap((chapter) => [...chapter.intro, ...chapter.sections.flatMap((section) => section.content)])
  .flatMap((block) => block.kind === "table" ? block.rows.flat() : [])
  .map(String)
  .find((text) => text.startsWith("THE GOLDEN RULE\n"))
  ?.replace("THE GOLDEN RULE\n", "") ?? "When a card directly contradicts this rulebook, the card wins.";
const RULE_VISUALS: Record<number, RuleVisual> = {
  1: { label: "Open the official file", quip: "The filing cabinet was never supposed to become ancient wisdom.", art: headerBackstoryUrl, alt: "The Department of Competitive Safety's improvised Paper-Fu origin story" },
  2: { label: "Sort the field kit", quip: "The Department catalogued this once. Do not make it happen again.", art: chapterComponentsUrl, alt: "Paper-Fu components organized on an official inventory desk" },
  3: { label: "Choose a demonstration", quip: "Every format has been certified as ‘controlled.’", art: chapterModesUrl, alt: "Four Paper-Fu tournament demonstrations viewed by an inspector" },
  4: { label: "Register the delegation", quip: "Set up the table before the inspector finds the snacks.", art: chapterSetupUrl, alt: "A complete Paper-Fu game setup from above" },
  5: { label: "Count the useful things", quip: "Focus buys the helmet. XP earns the Belt. HP keeps the report short.", art: chapterStatsUrl, alt: "A fighter and official tokens used to track Paper-Fu stats" },
  6: { label: "Follow the protocol", quip: "Honor once. Then every delegation completes Initiate, Yell, Ascend, and Hide.", art: chapterRoundUrl, alt: "A Paper-Fu round protocol board showing five phase panels" },
  7: { label: "Read before yelling", quip: "Resolve printed costs first; invent loopholes never.", art: chapterTimingUrl, alt: "Fighters and an official resolving cards in timing order" },
  8: { label: "Math with witnesses", quip: "Declare a zone. Invite interference. Subtract responsibly.", art: chapterCombatUrl, alt: "A Paper-Fu combat demonstration across high, mid, and low zones" },
  9: { label: "Pass equipment inspection", quip: "If the slot fits, somebody completed a form for it.", art: chapterEquipmentUrl, alt: "A fighter showing improvised gear to a safety inspector" },
  10: { label: "Access the reserve curriculum", quip: "The Market is random. The Department calls that a field test.", art: chapterMarketUrl, alt: "A Paper-Fu market display and a separate combo cabinet" },
  11: { label: "Pass the certification", quip: "Promotion requires XP, a task, and a committee-approved amount of confidence.", art: chapterBeltsUrl, alt: "A fighter progressing through a colorful belt certification ceremony" },
  12: { label: "Meet the delegation", quip: "Every fighter brought a specialty and at least one unresolved form.", art: chapterCharactersUrl, alt: "Original Paper-Fu character dossiers pinned to an official board" },
  13: { label: "Demonstrate as a team", quip: "Three fighters. One active spot. Infinite bench commentary.", art: chapterTagTeamUrl, alt: "A Paper-Fu tag-team handoff between three fighters" },
  14: { label: "Survive the stress test", quip: "The Boss has no hand, no mercy, and an official funding line.", art: chapterBossUrl, alt: "A three-fighter delegation confronting a Paper-Fu boss stage" },
  15: { label: "File the dispute", quip: "Read the card aloud before opening a tiny municipal courtroom.", art: chapterPriorityUrl, alt: "A Department official resolving a tall stack of Paper-Fu reactions" },
  16: { label: "Complete the safety report", quip: "Even getting knocked out has an order of operations.", art: chapterEndgameUrl, alt: "A safe Paper-Fu end-of-game ceremony with officials and fighters" },
};

const displayRuleNumber = (chapter: RuleChapter) => String(ruleChapters.findIndex((entry) => entry.id === chapter.id) + 1).padStart(2, "0");

const initialTheme = (): Theme => {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem("paper-fu-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};
const GAME_MODES = [
  { id: "tag-team", label: "Recommended", title: "Tag Team: Swap-Fu", players: "2–6 players", fighters: "3 Characters each", win: "Black Belt Victory or Last Fighter Standing", detail: "The recommended Core Format, especially for two players. Each player owns a three-fighter roster but controls only one active fighter at a time. Tag during Initiate, protect injured teammates on the bench, and keep fighting after a single KO.", notes: ["Use the complete Tag Team rules in Section 13.", "Equipment stays with the fighter who equipped it.", "Learned Combos belong to the player and may be triggered by any active fighter."] },
  { id: "standard-clash", label: "Classic", title: "Standard Clash", players: "2–6 players", fighters: "1 Character each", win: "Black Belt Victory or Last Fighter Standing", detail: "Every player controls one Character and one Starter Deck. Players may attack any opposing active fighter unless a card says otherwise. This is the cleanest free-for-all format and supports both normal victory paths.", notes: ["Start at 25 HP, White Belt, 0 XP, 0 Focus, and unused Tempo.", "There is no bench and no tagging.", "Resolve simultaneous victory using the tiebreakers in Section 16."] },
  { id: "quick-duel", label: "Fast", title: "Quick Duel: Face-Punch Finals", players: "Exactly 2 players", fighters: "1 Character each", win: "Last Fighter Standing only", detail: "A fast 1v1 combat-testing format. Belt progression and every printed Belt reward remain active, including Max HP increases and promotion healing. Reaching Black Belt does not end the game.", notes: ["Both fighters start at 25 HP and gain the full vitality reward from promotion.", "Black Belt Victory is disabled unless a scenario restores it.", "Use normal initiative, Tempo, combat, Defense Practice, persistent Market, and Market Mercy rules."] },
  { id: "boss-blitz", label: "Solo / Co-op", title: "Dojo Drama: Boss Blitz", players: "Solo or 2-player co-op", fighters: "3 Characters each", win: "Defeat the Final Boss", detail: "A three-stage Boss Rush against a Rival, Mini-Boss, and Final Boss. Players use Tag Team rules while each Boss combines an unused Character card with a Boss Stage overlay and automated Boss Techniques.", notes: ["Use the Boss setup and turn rules in Section 14.", "A player wins Speed ties against a Boss.", "After a stage victory, each player heals their active fighter 8 HP."] },
];
const OFFICIAL_RULINGS = rulesData.officialRulings;

const valueLabel = (value: string | number | null | undefined) => value === null || value === undefined || value === "" ? "—" : String(value);
const numeric = (value: string | number | null | undefined) => {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
};
const cardImageUrl = (card: CardEntry) => card.image ? CARD_IMAGE_URLS[card.image] ?? card.image : COMPLETE_CARD_URLS_BY_CATALOG_ID[card.catalogId] ?? cardPlaceholderUrl;
const hasCardArt = (card: CardEntry) => Boolean(card.image || COMPLETE_CARD_URLS_BY_CATALOG_ID[card.catalogId]);
const isCompleteCardArt = (card: CardEntry) => Boolean(COMPLETE_CARD_URLS_BY_CATALOG_ID[card.catalogId]);

function RuleTable({ rows }: { rows: (string | number)[][] }) {
  if (!rows.length) return null;
  if (rows.length === 1 || (rows[0]?.length === 1 && rows.length <= 2)) {
    return <aside className="rule-callout">{rows.flat().filter(Boolean).map((cell, index) => <p key={index}>{cell}</p>)}</aside>;
  }
  const [head, ...body] = rows;
  return <div className="table-scroll"><table className="rule-table"><thead><tr>{head.map((cell, index) => <th key={index}>{cell}</th>)}</tr></thead><tbody>{body.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

function RuleBlocks({ blocks }: { blocks: RuleBlock[] }) {
  const content: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (!bullets.length) return;
    content.push(<ul className="rule-bullets" key={`bullets-${content.length}`}>{bullets.map((bullet, index) => <li key={index}>{bullet}</li>)}</ul>);
    bullets = [];
  };
  blocks.forEach((block, index) => {
    if (block.kind === "bullet") return void bullets.push(block.text);
    flush();
    content.push(block.kind === "table" ? <RuleTable rows={block.rows} key={`table-${index}`} /> : <p key={`p-${index}`}>{block.text}</p>);
  });
  flush();
  return <>{content}</>;
}

function SectionHeader({ eyebrow, title, intro, art }: { eyebrow: string; title: string; intro: string; art: string }) {
  return <header className="section-header paper-stack"><i className="fastener paperclip header-paperclip" aria-hidden="true" /><div className="section-header-copy"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{intro}</p></div><img src={art} alt="" aria-hidden="true" decoding="async" /></header>;
}

function BrandMark() {
  return <span className="brand-mark"><img src={brandEmblemUrl} alt="" aria-hidden="true" /></span>;
}

function ThemeToggle({ theme, onToggle, full = false }: { theme: Theme; onToggle: () => void; full?: boolean }) {
  const next = theme === "dark" ? "light" : "dark";
  return <button className={`theme-toggle${full ? " theme-toggle-full" : ""}`} type="button" onClick={onToggle} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}><span aria-hidden="true">{theme === "dark" ? "☀" : "◐"}</span>{full && <b>{theme === "dark" ? "Light mode" : "Dark mode"}</b>}</button>;
}

function StarterExampleCard({ kind, name, zone, timing, power, focus, art, catalogId }: { kind: "Attack" | "Defense"; name: string; zone: string; timing: string; power: number; focus: number; art?: string; catalogId: string }) {
  return <article className={`starter-example-card starter-${kind.toLocaleLowerCase()}`}>
    <header><span>{kind}</span><b>{zone}</b></header>
    <div className="starter-example-art">{art ? <img src={art} alt="" aria-hidden="true" loading="lazy" decoding="async" /> : <span>{kind === "Attack" ? "A" : "D"}</span>}</div>
    <div className="starter-example-body"><small>Starter Technique</small><h4>{name}</h4><div className="starter-example-stats"><span><b>{power}</b>{kind === "Attack" ? "Attack Power" : "Guard"}</span><span><b>{focus}</b>Focus</span></div><p>No additional effect.</p></div>
    <footer><span>{timing}</span><b>{catalogId}</b></footer>
  </article>;
}

function StarterDeckLesson({ jabArt, guardArt }: { jabArt?: string; guardArt?: string }) {
  const [selectedGroup, setSelectedGroup] = useState(0);
  const selected = STARTER_CARDS[selectedGroup];
  return <section className="starter-lesson" aria-labelledby="starter-deck-title">
    <div className="starter-lesson-heading"><div><span className="eyebrow">Your opening toolkit</span><h3 id="starter-deck-title">Build this exact 15-card deck.</h3><p>Every player begins with the same cards. Shuffle all fifteen together, then draw five.</p></div><strong><b>15</b> cards<br />per player</strong></div>
    <div className="starter-tabs" role="tablist" aria-label="Starter Deck card groups">{STARTER_CARDS.map((entry, index) => <button type="button" role="tab" aria-selected={selectedGroup === index} className={selectedGroup === index ? "active" : ""} onClick={() => setSelectedGroup(index)} onMouseEnter={() => setSelectedGroup(index)} onFocus={() => setSelectedGroup(index)} key={entry.group}><span aria-hidden="true">{entry.icon}</span><div><small>{entry.count} cards</small><b>{entry.group}</b></div></button>)}</div>
    <div className="starter-group-detail" role="tabpanel"><div><span className="eyebrow">{selected.count} of 15 · {selected.group}</span><h4>{selected.purpose}</h4></div><ul>{selected.cards.map((card) => <li key={card}>{card}</li>)}</ul></div>
    <div className="starter-example-section"><div className="starter-example-copy"><span className="eyebrow">What a starter card looks like</span><h3>Read the big numbers first.</h3><p>The colored header tells you the card’s job. Attack Power or Guard drives combat, and the zone tells you where it applies. Printed Focus is generated when the card is legally played on your turn—or when one Defense is used for Defense Practice.</p><ol><li><b>1.</b> Identify Attack or Defense.</li><li><b>2.</b> Match High, Mid, or Low.</li><li><b>3.</b> Add Attack Power or Guard to the fighter’s stat.</li></ol></div><div className="starter-card-pair"><StarterExampleCard kind="Attack" name="Basic Jab" zone="High" timing="Turn" power={2} focus={1} art={jabArt} catalogId="DDB-COR-STR-003" /><StarterExampleCard kind="Defense" name="High Guard" zone="High" timing="Reaction" power={2} focus={1} art={guardArt} catalogId="DDB-COR-STR-009" /></div></div>
  </section>;
}

function CombatExample() {
  const [defensePlayed, setDefensePlayed] = useState(true);
  const attackPower = 4;
  const defense = 2 + (defensePlayed ? 2 : 0);
  const damage = Math.max(0, attackPower - defense);
  return <article className={`combat-example ${damage === 0 ? "is-blocked" : "is-hit"}`} aria-live="polite">
    <header className="combat-example-heading">
      <div><span className="eyebrow">Worked example · Mid Attack</span><h3>Rita attacks Devin. Count the paper.</h3><p>Every number below comes from a card or Character stat already on the table.</p></div>
      <button type="button" className="combat-example-toggle" aria-pressed={!defensePlayed} onClick={() => setDefensePlayed((current) => !current)}><span aria-hidden="true">{defensePlayed ? "−" : "+"}</span>{defensePlayed ? "Remove Devin’s Defense" : "Play Devin’s Defense"}</button>
    </header>
    <div className="combat-sides">
      <section className="combat-side attack-side" aria-label="Rita's Attack Power calculation">
        <div className="combat-side-title"><span>1 · Attacker</span><h4>Rita plays <b>Wild Swing</b></h4></div>
        <div className="combat-terms">
          <div className="combat-term"><span className="mini-combat-card attack-card"><b>Wild Swing</b><small>Mid · Attack</small></span><strong>1</strong><small>printed Attack Power</small></div>
          <i aria-hidden="true">+</i>
          <div className="combat-term"><span className="combat-stat-token">ATK</span><strong>2</strong><small>Rita’s ATK</small></div>
          <i aria-hidden="true">+</i>
          <div className="combat-term"><span className="combat-stat-token weapon-token">W</span><strong>1</strong><small>Weapon</small></div>
        </div>
        <footer><span>Attack Power</span><strong>{attackPower}</strong></footer>
      </section>
      <div className="combat-versus" aria-hidden="true">VS</div>
      <section className="combat-side defense-side" aria-label="Devin's Defense calculation">
        <div className="combat-side-title"><span>2 · Defender</span><h4>Devin {defensePlayed ? "plays Desperate Cover" : "does not play a Defense"}</h4></div>
        <div className="combat-terms">
          <div className="combat-term"><span className="combat-stat-token defense-token">DEF</span><strong>1</strong><small>Devin’s DEF</small></div>
          <i aria-hidden="true">+</i>
          <div className="combat-term"><span className="combat-stat-token armor-token">A</span><strong>1</strong><small>Mid Armor</small></div>
          <i aria-hidden="true">+</i>
          <div className={`combat-term optional-defense ${defensePlayed ? "is-played" : "is-skipped"}`}><span className="mini-combat-card defense-card"><b>{defensePlayed ? "Desperate Cover" : "No Defense card"}</b><small>{defensePlayed ? "Mid · Reaction" : "Reaction skipped"}</small></span><strong>{defensePlayed ? 2 : 0}</strong><small>Defense card</small></div>
        </div>
        <footer><span>Defense</span><strong>{defense}</strong></footer>
      </section>
    </div>
    <section className="combat-outcome" aria-label={`Combat result: ${damage === 0 ? "Blocked" : `${damage} damage`}`}>
      <div className="combat-outcome-math"><span>{attackPower}<small>Attack</small></span><i>−</i><span>{defense}<small>Defense</small></span><i>=</i><strong>{damage}</strong></div>
      <div><span className="eyebrow">{damage === 0 ? "Blocked" : "Hit"}</span><h4>{damage === 0 ? "Devin loses 0 HP." : `Devin loses ${damage} HP.`}</h4><p>{damage === 0 ? "The totals tie, so the Attack is Blocked. Rita still earns Attack XP and Devin earns Defense XP." : "Attack is higher than Defense, so Devin loses the difference in HP."}</p></div>
    </section>
    <p className="combat-example-note"><b>Never forget:</b> Character DEF and matching Armor still count even when no Defense card is played.</p>
  </article>;
}

function DetailModal({ eyebrow, title, children, onClose, accent = "red" }: { eyebrow: string; title: string; children: ReactNode; onClose: () => void; accent?: "red" | "green" | "gold" }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [onClose]);
  return createPortal(<div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><article className={`detail-modal paper-stack accent-${accent}`} role="dialog" aria-modal="true" aria-labelledby="detail-modal-title"><i className="modal-burst" aria-hidden="true" /><button autoFocus className="modal-close" onClick={onClose} aria-label="Close details">×</button><span className="eyebrow">{eyebrow}</span><h2 id="detail-modal-title">{title}</h2>{children}</article></div>, document.body);
}

function HomeView({ goTo }: { goTo: (view: ViewId) => void }) {
  return <>
    <section className="hero shell">
      <div className="hero-copy">
        <span className="version-pill"><span className="status-dot" /> Field test active</span>
        <p className="kicker">Government-certified card combat. Mostly.</p>
        <h1>Shuffle.<br />Strike. Ascend.</h1>
        <p className="hero-lede">Build a registered deck, survive the field test, and help decide whether Paper-Fu deserves another year of public funding.</p>
        <div className="hero-actions"><button className="button primary desktop-play-cta" onClick={() => goTo("playtest")}>Play Quick Duel <span>→</span></button><button className="button ghost" onClick={() => goTo("quickstart")}>Learn the rules</button></div>
        <div className="hero-note"><span>⏱</span><strong>First game?</strong> Get the table moving in about 10 minutes.</div>
      </div>
      <div className="hero-art-new"><span className="paper-shadow shadow-one" /><span className="paper-shadow shadow-two" /><i className="fastener tape-strip hero-tape-one" aria-hidden="true" /><i className="fastener tape-strip hero-tape-two" aria-hidden="true" /><img src={heroPaperFuUrl} alt="Paper-Fu fighters and a city inspector at the annual licensing tournament" fetchPriority="high" decoding="async" /><div className="impact-word" aria-hidden="true">HIYAH!</div></div>
    </section>
    <section className="stats-strip" aria-label="Companion highlights"><div className="shell stats-inner"><div><strong>LEARN</strong><span>Teach it at the table</span></div><div><strong>BUILD</strong><span>Search the live catalog</span></div><div><strong>FIGHT</strong><span>Run a Quick Duel</span></div><div><strong>SETTLE</strong><span>Resolve rules fast</span></div></div></section>
    <section className="shell route-section">
      <div className="section-title-row"><div><span className="eyebrow">Choose your path</span><h2>Everything the table needs</h2></div><p>Built to answer the question in front of you without making you reread a giant manual.</p></div>
      <div className="route-grid">{[
        ["playtest", "01", "Play the Game", "Duel the computer with the live card catalog and real card faces."],
        ["quickstart", "02", "Quick Start", "Set up, learn the turn, and throw the first punch."],
        ["story", "03", "Backstory", "The Department built a martial art from thousands of submissions. It is legally working."],
        ["rules", "04", "Full Rules", "Every gameplay chapter from the revised rulebook, made searchable."],
        ["cards", "05", "Card Library", `Search and filter all ${cardData.total} numbered card entries.`],
      ].map(([view, number, title, text]) => <button className={`route-card paper-stack interactive-paper ${view === "playtest" ? "route-playtest" : ""}`} key={view} onClick={() => goTo(view as ViewId)}><span>{number}</span><h3>{title}</h3><p>{text}</p><b>Open section →</b></button>)}</div>
    </section>
    <section className="phase-section"><div className="shell"><div className="section-title-row inverse"><div><span className="eyebrow">One round. Five beats.</span><h2>Remember H.I.Y.A.H.</h2></div><button className="text-link light" onClick={() => goTo("quickstart")}>See the complete turn →</button></div><div className="phase-track">{PHASES.map((phase, index) => <article key={`${phase.name}-${index}`}><span className="phase-letter">{phase.letter}</span><div><b>0{index + 1}</b><h3>{phase.name}</h3><p>{phase.text}</p></div></article>)}</div></div></section>
    <section className="shell roster-section"><div className="section-title-row"><div><span className="eyebrow">Meet the dojo</span><h2>Original fighters. Questionable judgment.</h2></div><button className="text-link" onClick={() => goTo("cards")}>Browse Characters →</button></div><div className="roster-grid">{HERO_FIGHTERS.map((fighter) => <article className="paper-stack" key={fighter.name}><div className="roster-image"><img src={fighter.image} alt={fighter.name} loading="lazy" decoding="async" /></div><span>{fighter.type}</span><h3>{fighter.name}</h3></article>)}</div></section>
  </>;
}

function StoryView({ goTo }: { goTo: (view: ViewId) => void }) {
  const storyParagraphs = storyChapter?.intro.filter((block): block is Extract<RuleBlock, { kind: "paragraph" }> => block.kind === "paragraph").map((block) => block.text) ?? [];
  return <main className="page-shell shell story-page">
    <SectionHeader eyebrow="The Backstory" title="The field test was approved. The filing cabinet was not." intro="The official Paper-Fu origin, preserved by the Department of Competitive Safety and immediately declared ancient history." art={headerBackstoryUrl} />
    <section className="story-lede paper-stack"><i className="fastener tape-strip story-tape" aria-hidden="true" /><span className="story-dropcap">P</span><div><span className="eyebrow">The Department’s original mistake</span><h2>{storyParagraphs[1] ?? "The Department of Competitive Safety had one job, and martial artists made it complicated."}</h2></div></section>
    <section className="story-panels">
      <article className="paper-stack"><span>01</span><h2>The Expo</h2><p>{storyParagraphs[2] ?? "Coupons, ferret-based interference, and a fountain-related monk incident ended self-certification."}</p><i>coupons · ferret · fire marshal</i></article>
      <article className="paper-stack"><span>02</span><h2>The Cabinet</h2><p>{storyParagraphs[3] ?? "A tax-receipts filing cabinet became ancient wisdom before anyone could stop it."}</p><i>TAX RECEIPTS → ancient wisdom</i></article>
      <article className="paper-stack"><span>03</span><h2>The Tournament</h2><p>{storyParagraphs[4] ?? "Certified delegations now field-test Paper-Fu for public funding and a temporary plaque."}</p><i>delegations · field test · Model Dojo</i></article>
    </section>
    <section className="golden-rule-card paper-stack"><div><span className="eyebrow">The Golden Rule</span><h2>The card wins.</h2></div><p>{GOLDEN_RULE}</p><span className="golden-stamp" aria-hidden="true">!</span></section>
    <section className="story-cta paper-stack"><div><span className="eyebrow">Enough lore?</span><h2>Go make the Department regret funding this.</h2></div><button className="button primary" onClick={() => goTo("quickstart")}>Set up the first fight →</button></section>
  </main>;
}

function QuickStartView({ goTo }: { goTo: (view: ViewId) => void }) {
  const [selectedMode, setSelectedMode] = useState<(typeof GAME_MODES)[number] | null>(null);
  const [selectedPhase, setSelectedPhase] = useState(0);
  const setup = [
    "Choose a mode. Tag Team is the recommended core format.",
    "Choose fighters: three each for Tag Team or Boss Blitz; one each for Clash or Quick Duel.",
    "Set every fighter to 25 HP. Begin at White Belt, 0 XP, 0 Focus, and unused Tempo.",
    "Take the fixed 15-card Starter Deck shown below, shuffle, and draw five.",
    "If that hand has no Attack and no Kata, reveal it, reshuffle, and draw five once more. Keep the second hand.",
    "Shuffle Techniques, Katas, and Items into one Market Deck; reveal seven random cards. Keep Combos separate and face-down.",
    "Shuffle Locations. Reveal the first Location during the first Honor Phase.",
    "Randomly choose the opening referee marker for first-round Speed ties.",
  ];
  return <main className="page-shell shell">
    <SectionHeader eyebrow="Quick Start" title="From box to battle in 10 minutes" intro="The teach-at-the-table version: enough to play correctly, with every game mode one click away." art={headerQuickstartUrl} />
        <section className="quick-mode-grid">{GAME_MODES.map((mode) => <button className={`mode-card paper-stack interactive-paper ${mode.id === "tag-team" ? "recommended" : ""}`} onClick={() => setSelectedMode(mode)} key={mode.id}><span>{mode.label}</span><h2>{mode.title}</h2><p>{mode.players} · {mode.fighters}</p><b>{mode.win}</b><small>Open full mode →</small></button>)}</section>
    <section className="golden-rule-card quick-golden paper-stack"><div><span className="eyebrow">Before anybody argues</span><h2>The Golden Rule</h2></div><p>{GOLDEN_RULE}</p><span className="golden-stamp" aria-hidden="true">!</span></section>
    <section className="paper-panel setup-panel paper-stack"><div className="panel-heading"><span className="step-stamp">01</span><div><span className="eyebrow">Set the table</span><h2>Eight things before the first HIYAH</h2></div></div><ol className="setup-list">{setup.map((item, index) => <li className={index === 3 ? "starter-step" : undefined} key={index}><span>{index + 1}</span><p>{item}</p></li>)}</ol><StarterDeckLesson jabArt={starterJabArtUrl} guardArt={highGuardArtUrl} /></section>
    <section className="quick-section interactive-round"><div className="panel-heading"><span className="step-stamp">02</span><div><span className="eyebrow">Play the round</span><h2>Honor once. Then each player completes I.Y.A.H.</h2><p className="round-clarifier">Resolve the global Honor Phase once, lock Speed order, then let each player finish their entire turn before moving to the next fighter.</p></div></div><div className="quick-phases">{PHASES.map((phase, index) => <button className={selectedPhase === index ? "active" : ""} onClick={() => setSelectedPhase(index)} key={phase.name}><span>{phase.letter}</span><div><small>{index === 0 ? "Once per round" : "Each player"}</small><h3>{phase.name}</h3><p>{phase.text}</p></div></button>)}</div><article className="phase-explainer paper-stack"><div><span className="phase-explainer-letter">{PHASES[selectedPhase].letter}</span><div><span className="eyebrow">{PHASE_DETAILS[selectedPhase].when}</span><h3>{PHASE_DETAILS[selectedPhase].name}</h3><p>{PHASE_DETAILS[selectedPhase].who}</p></div></div><ol>{PHASE_DETAILS[selectedPhase].steps.map((step) => <li key={step}>{step}</li>)}</ol><blockquote>{PHASE_DETAILS[selectedPhase].quip}</blockquote></article></section>
    <section className="combat-primer paper-stack"><div className="combat-copy"><span className="eyebrow">03 · Resolve combat</span><h2>Attack a zone. Let everybody interfere.</h2><ol><li>Declare the target and High, Mid, or Low zone.</li><li>Identify printed Attack Power, ATK, Weapons, DEF, Armor, and modifiers.</li><li>Open the Reaction Window and resolve the Dojo Stack.</li><li>Calculate both final totals, then deal the difference as damage.</li><li>Hit at 1+ damage; Block at 0. Award normal Attack/Defense XP.</li></ol></div><div className="formula-card"><span>Final combat formula</span><p><b>Attack Power</b> = printed Attack Power + Character ATK + Weapons + modifiers</p><p><b>Defense</b> = Character DEF + matching Armor + one Defense card's Guard + modifiers</p><strong>Damage = max(0, Attack Power − Defense)</strong></div><CombatExample /></section>
    <section className="quick-footer-card paper-stack"><div><span className="eyebrow">The whole game</span><h2>Fight → generate Focus → buy stronger cards → complete Belt tasks → win.</h2></div><button className="button primary" onClick={() => goTo("rules")}>Open the full rules →</button></section>
    {selectedMode && <DetailModal eyebrow={`${selectedMode.players} · ${selectedMode.fighters}`} title={selectedMode.title} onClose={() => setSelectedMode(null)} accent={selectedMode.id === "tag-team" ? "green" : "red"}><p className="modal-lede">{selectedMode.detail}</p><div className="modal-win"><span>How to win</span><strong>{selectedMode.win}</strong></div><ul className="modal-list">{selectedMode.notes.map((note) => <li key={note}>{note}</li>)}</ul></DetailModal>}
  </main>;
}

function RulesView({ initialChapterId = "", initialSectionId = "" }: { initialChapterId?: string; initialSectionId?: string }) {
  const [selectedId, setSelectedId] = useState(() => ruleChapters.some((chapter) => chapter.id === initialChapterId) ? initialChapterId : ruleChapters[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const selected = ruleChapters.find((chapter) => chapter.id === selectedId) ?? ruleChapters[0];
  const selectedIndex = ruleChapters.findIndex((chapter) => chapter.id === selected.id);
  const selectedVisual = RULE_VISUALS[selected.number];
  useEffect(() => {
    if (!initialSectionId || query) return;
    const frame = window.requestAnimationFrame(() => document.getElementById(initialSectionId)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    return () => window.cancelAnimationFrame(frame);
  }, [initialSectionId, query, selected.id]);
  const matches = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return [];
    return ruleChapters.flatMap((chapter) => {
      if (!JSON.stringify(chapter).toLocaleLowerCase().includes(term)) return [];
      const section = chapter.sections.find((entry) => JSON.stringify(entry).toLocaleLowerCase().includes(term));
      return [{ chapter, section }];
    });
  }, [query]);
  const chooseChapter = (id: string) => {
    setSelectedId(id);
    setQuery("");
    window.history.pushState(null, "", dojoHash("rules", id));
    window.requestAnimationFrame(() => document.getElementById("rule-reader")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const chooseSection = (id: string) => {
    window.history.pushState(null, "", dojoHash("rules", selected.id, id));
    window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  return <main className="rules-page shell page-shell">
    <SectionHeader eyebrow="Official Full Rules" title="The complete dojo law" intro="The Department’s current approved procedures, organized for fast table use. Quick Start, glossary, rulings, and house rules live in their purpose-built sections." art={headerRulesUrl} />
        <div className="rules-toolbar"><label className="search-box large"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all rules—Flow, Tempo, KO, Combo…" aria-label="Search all rules" />{query && <button onClick={() => setQuery("")} aria-label="Clear rules search">×</button>}</label><span className="source-badge">{ruleChapters.length} focused chapters · filed for table use</span></div>
    <label className="mobile-chapter-picker"><span>Jump to a chapter</span><select value={selected.id} onChange={(event) => chooseChapter(event.target.value)}>{ruleChapters.map((chapter) => <option value={chapter.id} key={chapter.id}>{displayRuleNumber(chapter)} · {chapter.title}</option>)}</select></label>
    {query ? <section className="rule-search-results"><h2>{matches.length} matching chapter{matches.length === 1 ? "" : "s"}</h2>{matches.length ? matches.map(({ chapter, section }) => <button key={chapter.id} onClick={() => chooseChapter(chapter.id)}><span>Chapter {displayRuleNumber(chapter)}</span><h3>{chapter.title}</h3><p>{section ? `Match in ${section.title}` : "Match in chapter overview"}</p></button>) : <div className="empty-state"><strong>No rule found.</strong><p>Try a shorter term or search the Card Library for printed card text.</p></div>}</section> :
      <div className="rules-layout" id="rule-reader"><aside className="chapter-nav" aria-label="Rule chapters"><span>Contents</span>{ruleChapters.map((chapter) => <button className={chapter.id === selected.id ? "active" : ""} onClick={() => chooseChapter(chapter.id)} key={chapter.id}><b>{displayRuleNumber(chapter)}</b><span>{chapter.title}</span></button>)}</aside><article className="rule-article paper-stack"><header><span>Chapter {displayRuleNumber(selected)}</span><h1>{selected.title}</h1></header><div className="chapter-art"><img src={selectedVisual.art} alt={selectedVisual.alt} loading="lazy" decoding="async" /><div><span>{selectedVisual.label}</span><p>{selectedVisual.quip}</p></div></div><nav className="rule-section-nav" aria-label={`${selected.title} sections`}><span>In this chapter</span>{selected.sections.map((section) => <button type="button" onClick={() => chooseSection(section.id)} key={section.id}>{section.title}</button>)}</nav><RuleBlocks blocks={selected.intro} />{selected.sections.map((section) => <section id={section.id} key={section.id}><h2>{section.title}</h2><RuleBlocks blocks={section.content} /></section>)}<footer className="chapter-footer"><span>End of Chapter {displayRuleNumber(selected)}</span>{ruleChapters[selectedIndex + 1] && <button onClick={() => chooseChapter(ruleChapters[selectedIndex + 1].id)}>Next: {ruleChapters[selectedIndex + 1].title} →</button>}</footer></article></div>}
  </main>;
}

function CardTile({ card, onOpen, saved = false }: { card: CardEntry; onOpen: () => void; saved?: boolean }) {
  const statPairs = Object.entries(card.stats).slice(0, 3);
  return <button className={`library-card paper-stack interactive-paper type-${card.cardType.toLocaleLowerCase().replaceAll(" ", "-")}`} onClick={onOpen}>
    {saved && <span className="binder-star" aria-label="Saved in Dojo Binder" title="Saved in Dojo Binder">★</span>}
    <div className="card-topline"><span>{card.cardType}</span><b>{card.deck}</b></div><div className={`card-art${isCompleteCardArt(card) ? " card-art--complete" : ""}${!hasCardArt(card) ? " card-art--pending" : ""}`}><img src={cardImageUrl(card)} alt={hasCardArt(card) ? card.name : `Artwork pending for ${card.name}`} loading="lazy" decoding="async" /><span>{card.catalogId}</span></div>
    <div className="card-body"><small>{card.cardType}</small><h3>{card.name}</h3><div className="card-costs">{card.fpCost !== null && card.fpCost !== undefined && <span><b>{valueLabel(card.fpCost)}</b> Focus Cost</span>}{card.focusValue !== null && card.focusValue !== undefined && <span><b>{valueLabel(card.focusValue)}</b> Focus</span>}{card.zone && <span>{card.zone}</span>}</div>{statPairs.length > 0 && <div className="mini-stats">{statPairs.map(([key, value]) => <span key={key}><b>{value}</b>{key}</span>)}</div>}<p>{card.rulesText || card.flavorText || "Open for complete card details."}</p><div className="tag-row">{card.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div></div><span className="open-card">View card →</span>
  </button>;
}

function CardModal({
  card,
  previousCard,
  nextCard,
  position,
  total,
  saved,
  onToggleSaved,
  onPrevious,
  onNext,
  onClose,
}: {
  card: CardEntry;
  previousCard: CardEntry | null;
  nextCard: CardEntry | null;
  position: number;
  total: number;
  saved: boolean;
  onToggleSaved: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const body = document.body;
    const root = document.documentElement;
    const previousBodyStyles = {
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
    };
    const previousScrollBehavior = root.style.scrollBehavior;
    const scrollbarWidth = window.innerWidth - root.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    dialogRef.current?.focus({ preventScroll: true });

    return () => {
      Object.assign(body.style, previousBodyStyles);
      root.style.scrollBehavior = "auto";
      window.scrollTo(scrollX, scrollY);
      root.style.scrollBehavior = previousScrollBehavior;
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const navigate = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && previousCard) onPrevious();
      if (event.key === "ArrowRight" && nextCard) onNext();
    };
    window.addEventListener("keydown", navigate);
    return () => window.removeEventListener("keydown", navigate);
  }, [nextCard, onClose, onNext, onPrevious, previousCard]);

  useEffect(() => {
    dialogRef.current?.scrollTo({ top: 0 });
  }, [card.id]);

  return createPortal(<div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <article ref={dialogRef} className="card-modal paper-stack" role="dialog" aria-modal="true" aria-labelledby="card-modal-title" tabIndex={-1}>
      <button className="modal-close" onClick={onClose} aria-label="Close card details">×</button>
      <nav className="card-modal-nav" aria-label="Browse filtered cards">
        <button type="button" onClick={onPrevious} disabled={!previousCard} aria-label={previousCard ? `Previous card: ${previousCard.name}` : "No previous card"}>
          <span aria-hidden="true">←</span><span className="card-modal-link-copy"><small>Previous</small><strong>{previousCard?.name ?? "First card"}</strong></span>
        </button>
        <span className="card-modal-position" aria-live="polite">{position} of {total}</span>
        <button type="button" onClick={onNext} disabled={!nextCard} aria-label={nextCard ? `Next card: ${nextCard.name}` : "No next card"}>
          <span className="card-modal-link-copy"><small>Next</small><strong>{nextCard?.name ?? "Last card"}</strong></span><span aria-hidden="true">→</span>
        </button>
      </nav>
      <div className="modal-heading"><img className={isCompleteCardArt(card) ? "modal-card-art--complete" : undefined} src={cardImageUrl(card)} alt={hasCardArt(card) ? card.name : "Temporary Dojo Deckbuilder card artwork placeholder"} decoding="async" /><div><span className="eyebrow">{card.catalogId} · {card.cardType} · {card.subtype}</span><h2 id="card-modal-title">{card.name}</h2><p>{card.flavorText}</p></div></div><button type="button" className={`binder-toggle binder-toggle--modal${saved ? " is-saved" : ""}`} aria-pressed={saved} onClick={onToggleSaved}>{saved ? "★ In Dojo Binder" : "☆ Save to Dojo Binder"}</button><div className="modal-badges"><span>{card.deck}</span>{card.lineage && <span>{card.lineage}</span>}{card.timing && <span>{card.timing}</span>}{card.zone && <span>{card.zone}</span>}</div>{card.rulesText && <aside className="modal-rule"><span>Rules text</span><p>{card.rulesText}</p></aside>}<dl className="detail-grid">{publicCardDetails(card).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl><footer>Catalog: {card.catalogId} · Source: {card.sourceSheet}</footer>
    </article>
  </div>, document.body);
}

function CardsView({ initialCard, clearInitialCard }: { initialCard: CardEntry | null; clearInitialCard: () => void }) {
  const [query, setQuery] = useState(""); const [type, setType] = useState("All"); const [deck, setDeck] = useState("All");
  const [subtype, setSubtype] = useState("All"); const [timing, setTiming] = useState("All"); const [focusCost, setFocusCost] = useState("All");
  const [sort, setSort] = useState("catalog"); const [visible, setVisible] = useState(24); const [selectedCard, setSelectedCard] = useState<CardEntry | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => readStoredStringSet(BINDER_STORAGE_KEY));
  const [binderOnly, setBinderOnly] = useState(false);
  const activeCard = selectedCard ?? initialCard;
  useEffect(() => {
    window.localStorage.setItem(BINDER_STORAGE_KEY, JSON.stringify([...savedIds]));
  }, [savedIds]);
  const toggleSaved = (card: CardEntry) => {
    setSavedIds((current) => {
      const next = new Set(current);
      if (next.has(card.catalogId)) next.delete(card.catalogId); else next.add(card.catalogId);
      return next;
    });
    if (binderOnly && savedIds.has(card.catalogId)) setBinderOnly(false);
  };
  useEffect(() => { setSelectedCard(initialCard ?? null); }, [initialCard]);
  const openCard = (card: CardEntry) => { setSelectedCard(card); window.history.pushState(null, "", dojoHash("cards", card.catalogId)); };
  const stepCard = (card: CardEntry | null) => { if (!card) return; setSelectedCard(card); window.history.replaceState(null, "", dojoHash("cards", card.catalogId)); };
  const closeCard = () => { setSelectedCard(null); clearInitialCard(); window.history.replaceState(null, "", dojoHash("cards")); };
  const types = ["All", ...Object.keys(cardData.counts)];
  const cardsInScope = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    const matches = (card: CardEntry) => !term || cardSearchText(card).includes(term);
    return cardData.cards.filter((card) => (deck === "All" || card.deck === deck) && matches(card));
  }, [query, deck]);
  const typeCounts = useMemo(() => cardsInScope.reduce<Record<string, number>>((counts, card) => { counts[card.cardType] = (counts[card.cardType] ?? 0) + 1; return counts; }, {}), [cardsInScope]);
  const typedCards = useMemo(() => cardsInScope.filter((card) => (type === "All" || card.cardType === type) && (!binderOnly || savedIds.has(card.catalogId))), [cardsInScope, type, binderOnly, savedIds]);
  const optionCounts = (values: (string | number | null | undefined)[]) => values.reduce<Record<string, number>>((counts, value) => {
    const label = value === null || value === undefined ? "" : String(value).trim();
    if (label && label !== "—") counts[label] = (counts[label] ?? 0) + 1;
    return counts;
  }, {});
  const subtypeCounts = useMemo(() => optionCounts(typedCards.map((card) => card.subtype)), [typedCards]);
  const timingCounts = useMemo(() => optionCounts(typedCards.map((card) => card.timing)), [typedCards]);
  const focusCostCounts = useMemo(() => optionCounts(typedCards.map((card) => Number.isFinite(numeric(card.fpCost)) ? numeric(card.fpCost) : null)), [typedCards]);
  const subtypeOptions = Object.keys(subtypeCounts).sort();
  const timingOptions = Object.keys(timingCounts).sort();
  const focusCostOptions = Object.keys(focusCostCounts).sort((a, b) => Number(a) - Number(b));
  const filtered = useMemo(() => {
    return typedCards.filter((card) => (subtype === "All" || card.subtype === subtype) && (timing === "All" || card.timing === timing) && (focusCost === "All" || numeric(card.fpCost) === Number(focusCost))).sort((a, b) => {
      if (sort === "catalog") return a.catalogOrder - b.catalogOrder;
      if (sort === "focus") return numeric(a.fpCost) - numeric(b.fpCost) || a.name.localeCompare(b.name);
      if (sort === "type") return a.cardType.localeCompare(b.cardType) || a.name.localeCompare(b.name);
      if (sort === "deck") return a.deck.localeCompare(b.deck) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
  }, [typedCards, subtype, timing, focusCost, sort]);
  const activeIndex = activeCard ? filtered.findIndex((card) => card.id === activeCard.id) : -1;
  const previousCard = activeIndex > 0 ? filtered[activeIndex - 1] : null;
  const nextCard = activeIndex >= 0 && activeIndex < filtered.length - 1 ? filtered[activeIndex + 1] : null;
  const resetSecondaryFilters = () => { setSubtype("All"); setTiming("All"); setFocusCost("All"); };
  const resetFilters = () => { setQuery(""); setType("All"); setDeck("All"); resetSecondaryFilters(); setBinderOnly(false); setVisible(24); };
  return <main className="page-shell shell card-library-page"><SectionHeader eyebrow="Card Library" title={`${cardData.total} registered cards. Exactly 500 in the main pool.`} intro="Search the complete Core catalog by ID, deck, type, rules text, or Focus Cost. The 500-card main pool excludes Starter, Character, and Boss-module cards." art={headerCardsUrl} />
    <section className="quick-footer-card paper-stack"><div><span className="eyebrow">Editable card files</span><h2>Paper-Fu Gear source deck</h2><p>24 full Gear cards, with their layered GIMP-compatible OpenRaster sources.</p></div><a className="button ghost" href={DOWNLOADS.gearSources}>Download Gear ORA ZIP</a></section>
            <section className="library-controls"><div className="library-control library-search-control"><label htmlFor="card-library-search">Search</label><div className="search-box"><span aria-hidden="true">⌕</span><input id="card-library-search" value={query} onChange={(event) => { setQuery(event.target.value); setVisible(24); }} placeholder="ID, name, rules, tag…" />{query && <button onClick={() => setQuery("")} aria-label="Clear card search">×</button>}</div></div><label className="library-control"><span>Deck</span><select value={deck} onChange={(event) => { setDeck(event.target.value); resetSecondaryFilters(); setVisible(24); }}><option>All</option>{cardData.decks.map((entry) => <option key={entry}>{entry}</option>)}</select></label><label className="library-control"><span>Subtype</span><select value={subtype} onChange={(event) => { setSubtype(event.target.value); setVisible(24); }} disabled={!subtypeOptions.length}><option value="All">All subtypes</option>{subtypeOptions.map((entry) => <option value={entry} key={entry}>{entry} ({subtypeCounts[entry]})</option>)}</select></label><label className="library-control"><span>Timing</span><select value={timing} onChange={(event) => { setTiming(event.target.value); setVisible(24); }} disabled={!timingOptions.length}><option value="All">All timings</option>{timingOptions.map((entry) => <option value={entry} key={entry}>{entry} ({timingCounts[entry]})</option>)}</select></label><label className="library-control"><span>Focus Cost</span><select value={focusCost} onChange={(event) => { setFocusCost(event.target.value); setVisible(24); }} disabled={!focusCostOptions.length}><option value="All">Any cost</option>{focusCostOptions.map((entry) => <option value={entry} key={entry}>{entry} Focus ({focusCostCounts[entry]})</option>)}</select></label><label className="library-control"><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="catalog">Catalog order</option><option value="name">Name A–Z</option><option value="deck">Deck</option><option value="type">Card type</option><option value="focus">Focus Cost</option></select></label></section>
    <div className="binder-strip"><button type="button" className={`binder-toggle${binderOnly ? " is-saved" : ""}`} aria-pressed={binderOnly} onClick={() => { setBinderOnly((current) => !current); setVisible(24); }}><span aria-hidden="true">{binderOnly ? "★" : "☆"}</span> Dojo Binder <b>{savedIds.size}</b></button><p>Saved on this device only. Open a card to add or remove it.</p></div>
    <div className="type-filters" role="group" aria-label="Filter by card type">{types.map((entry) => <button className={type === entry ? "active" : ""} onClick={() => { setType(entry); resetSecondaryFilters(); setVisible(24); }} key={entry}>{entry}<span>{entry === "All" ? cardsInScope.length : typeCounts[entry] ?? 0}</span></button>)}</div>
    <div className="result-line"><p><strong>{filtered.length}</strong> results</p>{(query || type !== "All" || deck !== "All" || subtype !== "All" || timing !== "All" || focusCost !== "All") && <button onClick={resetFilters}>Reset filters</button>}</div>
    {filtered.length ? <><section className="card-grid">{filtered.slice(0, visible).map((card) => <CardTile key={card.id} card={card} saved={savedIds.has(card.catalogId)} onOpen={() => openCard(card)} />)}</section>{visible < filtered.length && <button className="button load-more" onClick={() => setVisible((count) => count + 24)}>Load 24 more <span>{filtered.length - visible} remaining</span></button>}</> : <div className="empty-state"><strong>No cards match that search.</strong><p>Clear a filter or try a broader rules term.</p><button className="button ghost" onClick={resetFilters}>Reset filters</button></div>}
    {activeCard && <CardModal card={activeCard} previousCard={previousCard} nextCard={nextCard} position={Math.max(1, activeIndex + 1)} total={filtered.length} saved={savedIds.has(activeCard.catalogId)} onToggleSaved={() => toggleSaved(activeCard)} onPrevious={() => stepCard(previousCard)} onNext={() => stepCard(nextCard)} onClose={closeCard} />}
  </main>;
}

function RulingsView({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const rulings = OFFICIAL_RULINGS.filter((entry) => Object.values(entry).join(" ").toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <main className="page-shell shell rulings-page"><SectionHeader eyebrow="Department Guidance" title="Clarifications, errata, and table peace" intro="Official Paper-Fu guidance lives here instead of being duplicated inside the Full Rules reader." art={headerRulingsUrl} />
    <section className="priority-panel"><div><span className="eyebrow">Rule priority</span><h2>When two things disagree</h2><p>Use this order. Stop as soon as the conflict is resolved.</p></div><ol><li><span>1</span>Scenario or mode rules</li><li><span>2</span>Specific card text</li><li><span>3</span>“Cannot” beats “can”</li><li><span>4</span>Later effect</li><li><span>5</span>Active-player temporary ruling</li></ol></section>
    <section className="ruling-list-section"><div className="rulings-heading"><div><span className="eyebrow">Official clarifications</span><h2>{OFFICIAL_RULINGS.length} current rulings</h2></div><label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search rulings…" aria-label="Search official rulings" /></label></div><div className="ruling-list">{rulings.map(({ id, filed, tag, title, ruling }, index) => <article key={id}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{tag}</b><h3>{title}</h3><p>{ruling}</p></div><strong>{id} · {filed}</strong></article>)}</div></section>
    <section className="judge-procedure"><div><span className="step-stamp">?</span><h2>The two-minute table judge</h2></div><ol><li>Pause for no more than two minutes.</li><li>Read the exact card text aloud.</li><li>Apply Rule Priority.</li><li>Make a temporary ruling and finish the turn.</li><li>Record the question for a permanent ruling after the game.</li></ol></section>
  </main>;
}

function HouseRulesView({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [selected, setSelected] = useState<HouseRule | null>(null);
  const filtered = rulesData.houseRules.filter((entry) => `${entry.name} ${entry.rule} ${entry.summary ?? ""} ${entry.notes ?? ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <main className="page-shell shell house-page"><SectionHeader eyebrow="Sanctioned Shenanigans" title="Approved deviations. Questionable paperwork." intro="Optional variants for tables that believe the official rules are merely a strong opening argument. Tap any tile for exact timing and design notes." art={headerHouseRulesUrl} /><div className="house-toolbar"><label className="search-box large"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search variants…" aria-label="Search house rules" /></label><span>Sanctioned shenanigans, filtered to taste.</span></div><section className="house-grid">{filtered.map((entry, index) => <button className="paper-stack interactive-paper" onClick={() => setSelected(entry)} key={entry.name}><span>{String(index + 1).padStart(2, "0")}</span><small>{entry.category}</small><h2>{entry.name}</h2><p>{entry.summary || entry.rule}</p><b>Open full variant →</b></button>)}</section><section className="new-rule-panel paper-stack"><span className="eyebrow">Build your own</span><h2>A good house rule answers four questions.</h2><div><p><b>When</b> does it trigger?</p><p><b>Who</b> makes choices?</p><p><b>What</b> if it is impossible?</p><p><b>Where</b> is the cap?</p></div></section>{selected && <DetailModal eyebrow={selected.category || "House Rule"} title={selected.name} onClose={() => setSelected(null)} accent="green"><p className="modal-lede">{selected.summary}</p><aside className="modal-rule"><span>Variant rule</span><p>{selected.rule}</p></aside>{selected.notes && <div className="modal-design-note"><span>Why this wording works</span><p>{selected.notes}</p></div>}<p className="agreement-note">Agree on this variant before setup. It changes only the current game and never rewrites printed card text.</p></DetailModal>}</main>;
}

function GlossaryView({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [selected, setSelected] = useState<{ term: string; meaning: string } | null>(null);
  const filtered = GLOSSARY_ENTRIES.filter((entry) => `${entry.term} ${entry.meaning}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <main className="page-shell shell glossary-page"><SectionHeader eyebrow="Glossary" title="Speak fluent Paper-Fu" intro="Every defined rules term, separated from the rulebook for fast table lookup. Tap any tile for the full definition." art={headerGlossaryUrl} /><div className="glossary-toolbar"><label className="search-box large"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Flow, Focus, Tempo, Reaction…" aria-label="Search glossary" />{query && <button onClick={() => setQuery("")} aria-label="Clear glossary search">×</button>}</label><span>{filtered.length} of {GLOSSARY_ENTRIES.length} terms</span></div>{filtered.length ? <div className="glossary-grid">{filtered.map((entry, index) => <button className="interactive-paper" onClick={() => setSelected(entry)} key={entry.term}><span>{String(index + 1).padStart(2, "0")}</span><strong>{entry.term}</strong><p>{entry.meaning}</p><b>Open term →</b></button>)}</div> : <div className="empty-state"><strong>No term found.</strong><p>Try a shorter word or search the full rules for a phrase that is not a defined term.</p></div>}{selected && <DetailModal eyebrow="Defined term" title={selected.term} onClose={() => setSelected(null)}><aside className="modal-rule"><span>Definition</span><p>{selected.meaning}</p></aside><div className="modal-design-note"><span>At the table</span><p>Use this defined meaning unless a more specific scenario rule or card instruction says otherwise.</p></div></DetailModal>}</main>;
}

export default function CompanionApp() {
  const [view, setView] = useState<ViewId>("home"); const [menuOpen, setMenuOpen] = useState(false); const [theme, setTheme] = useState<Theme>(initialTheme);
  const [globalSearch, setGlobalSearch] = useState(""); const [globalSelection, setGlobalSelection] = useState(0); const [searchedCard, setSearchedCard] = useState<CardEntry | null>(null); const [searchedTerm, setSearchedTerm] = useState("");
  const [showRevision, setShowRevision] = useState(false);
  const [rulesUpdateAvailable, setRulesUpdateAvailable] = useState(() => typeof window !== "undefined" && window.localStorage.getItem(RULES_SEEN_STORAGE_KEY) !== CURRENT_RULES_REVISION);
  const [searchedRuleChapter, setSearchedRuleChapter] = useState(""); const [searchedRuleSection, setSearchedRuleSection] = useState(""); const [searchedRuling, setSearchedRuling] = useState(""); const [searchedHouseRule, setSearchedHouseRule] = useState("");
  const [scrollProgress, setScrollProgress] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const sync = () => {
      const route = parseDojoHash();
      setView(route.view);
      setSearchedCard(route.view === "cards" && route.detail ? cardData.cards.find((card) => card.catalogId.toLocaleLowerCase() === route.detail.toLocaleLowerCase()) ?? null : null);
      setSearchedTerm(route.view === "glossary" ? route.detail : "");
      setSearchedRuleChapter(route.view === "rules" ? route.detail : "");
      setSearchedRuleSection(route.view === "rules" ? route.subdetail : "");
      setSearchedRuling(route.view === "rulings" ? route.detail : "");
      setSearchedHouseRule(route.view === "house-rules" ? route.detail : "");
    };
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => { window.removeEventListener("hashchange", sync); window.removeEventListener("popstate", sync); };
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    const previous = document.body.style.overflow;
    if (window.matchMedia("(max-width: 840px)").matches) document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [menuOpen]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("paper-fu-theme", theme);
  }, [theme]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const available = document.documentElement.scrollHeight - window.innerHeight;
        setScrollProgress(available > 0 ? Math.min(1, Math.max(0, window.scrollY / available)) : 0);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [view]);
  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus({ preventScroll: true });
      } else if (!isTyping && event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, []);
  const goTo = (next: ViewId) => { setSearchedCard(null); setSearchedTerm(""); setSearchedRuleChapter(""); setSearchedRuleSection(""); setSearchedRuling(""); setSearchedHouseRule(""); setView(next); setMenuOpen(false); setGlobalSearch(""); window.history.pushState(null, "", dojoHash(next)); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const globalResults: GlobalResult[] = useMemo(() => {
    const term = globalSearch.trim().toLocaleLowerCase(); if (term.length < 2) return [];
    const rules: GlobalResult[] = ruleChapters.flatMap((chapter): GlobalResult[] => {
      if (!JSON.stringify(chapter).toLocaleLowerCase().includes(term)) return [];
      const section = chapter.sections.find((entry) => JSON.stringify(entry).toLocaleLowerCase().includes(term));
      return [{ type: "Rule", title: chapter.title, detail: section ? `Chapter ${displayRuleNumber(chapter)} · ${section.title}` : `Chapter ${displayRuleNumber(chapter)} · overview`, view: "rules", chapterId: chapter.id, sectionId: section?.id }];
    }).slice(0, 4);
    const rulings: GlobalResult[] = OFFICIAL_RULINGS.filter((entry) => Object.values(entry).join(" ").toLocaleLowerCase().includes(term)).slice(0, 3).map(({ id, filed, tag, title }) => ({ type: "Ruling", title, detail: `${id} · ${tag} · ${filed}`, view: "rulings", query: id }));
    const cards: GlobalResult[] = cardData.cards.filter((card) => cardSearchText(card).includes(term)).slice(0, 5).map((card) => ({ type: "Card", title: card.name, detail: `${card.catalogId} · ${card.cardType} · ${card.subtype}`, view: "cards", card }));
    const terms: GlobalResult[] = GLOSSARY_ENTRIES.filter((entry) => `${entry.term} ${entry.meaning}`.toLocaleLowerCase().includes(term)).slice(0, 3).map((entry) => ({ type: "Glossary", title: entry.term, detail: entry.meaning, view: "glossary", query: entry.term }));
    const houseRules: GlobalResult[] = rulesData.houseRules.filter((entry) => `${entry.name} ${entry.rule} ${entry.summary ?? ""} ${entry.notes ?? ""}`.toLocaleLowerCase().includes(term)).slice(0, 3).map((entry) => ({ type: "House Rule", title: entry.name, detail: entry.summary || entry.rule, view: "house-rules", query: entry.name }));
    return [...rules, ...rulings, ...cards, ...terms, ...houseRules]
      .sort((a, b) => searchResultRank(a, term) - searchResultRank(b, term) || SEARCH_GROUP_ORDER.indexOf(a.type) - SEARCH_GROUP_ORDER.indexOf(b.type) || a.title.localeCompare(b.title))
      .slice(0, 14);
  }, [globalSearch]);
  const groupedGlobalResults = useMemo(() => {
    const term = globalSearch.trim().toLocaleLowerCase();
    return SEARCH_GROUP_ORDER.map((type) => ({ type, results: globalResults.filter((result) => result.type === type) }))
      .filter((group) => group.results.length)
      .sort((a, b) => searchResultRank(a.results[0], term) - searchResultRank(b.results[0], term) || SEARCH_GROUP_ORDER.indexOf(a.type) - SEARCH_GROUP_ORDER.indexOf(b.type));
  }, [globalResults, globalSearch]);
  const orderedGlobalResults = useMemo(() => groupedGlobalResults.flatMap((group) => group.results), [groupedGlobalResults]);
  useEffect(() => setGlobalSelection(0), [globalSearch]);
  const chooseResult = (result: GlobalResult) => {
    goTo(result.view);
    if (result.card) { setSearchedCard(result.card); window.history.replaceState(null, "", dojoHash("cards", result.card.catalogId)); }
    if (result.view === "glossary") { const target = result.query ?? result.title; setSearchedTerm(target); window.history.replaceState(null, "", dojoHash("glossary", target)); }
    if (result.view === "rules") { setSearchedRuleChapter(result.chapterId ?? ""); setSearchedRuleSection(result.sectionId ?? ""); window.history.replaceState(null, "", dojoHash("rules", result.chapterId, result.sectionId)); }
    if (result.view === "rulings") { const target = result.query ?? result.title; setSearchedRuling(target); window.history.replaceState(null, "", dojoHash("rulings", target)); }
    if (result.view === "house-rules") { const target = result.query ?? result.title; setSearchedHouseRule(target); window.history.replaceState(null, "", dojoHash("house-rules", target)); }
  };
  const handleGlobalSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setGlobalSearch("");
      event.currentTarget.blur();
      return;
    }
    if (!orderedGlobalResults.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setGlobalSelection((current) => (current + direction + orderedGlobalResults.length) % orderedGlobalResults.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const result = orderedGlobalResults[Math.min(globalSelection, orderedGlobalResults.length - 1)];
      if (result) chooseResult(result);
    }
  };
  const acknowledgeRulesRevision = () => {
    window.localStorage.setItem(RULES_SEEN_STORAGE_KEY, CURRENT_RULES_REVISION);
    setRulesUpdateAvailable(false);
    setShowRevision(false);
  };
  const renderGlobalResults = (className: string, id: string) => <div className={className} id={id} role="listbox" aria-label="Dojo search results">{groupedGlobalResults.map((group) => <section className="global-result-group" key={group.type}><strong>{SEARCH_GROUP_LABELS[group.type]}</strong>{group.results.map((result) => { const index = orderedGlobalResults.indexOf(result); return <button type="button" role="option" aria-selected={index === globalSelection} className={index === globalSelection ? "is-selected" : ""} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setGlobalSelection(index)} onClick={() => chooseResult(result)} key={`${result.type}-${result.title}-${result.detail}`}><span>{result.type}</span><b>{result.title}</b><small>{result.detail}</small></button>; })}</section>)}</div>;
  const moreActive = view === "story" || view === "rulings" || view === "glossary" || view === "house-rules";
  const toggleTheme = () => setTheme((current) => current === "light" ? "dark" : "light");
  return <div className="site-frame">
    <header className="site-header"><div className="header-inner shell"><button className="brand" onClick={() => goTo("home")} aria-label="Dojo Deckbuilder home"><BrandMark /><span><b>DOJO</b><em>DECKBUILDER</em></span></button><nav id="primary-navigation" aria-label="Primary navigation">{NAV_ITEMS.map((item) => <button className={view === item.id ? "active" : ""} onClick={() => goTo(item.id)} key={item.id}>{item.label}</button>)}</nav><div className="header-search-wrap"><label className="header-search"><span>⌕</span><input ref={searchInputRef} value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} onKeyDown={handleGlobalSearchKeyDown} placeholder="Search the dojo" aria-label="Search cards, rules, rulings, glossary, and house rules" /><kbd>Ctrl K</kbd></label>{globalResults.length > 0 && renderGlobalResults("global-results", "dojo-global-results")}</div>{rulesUpdateAvailable && <button type="button" className="rules-update-pill" onClick={() => setShowRevision(true)} title={`Review ${CURRENT_RULES_REVISION}`}><b>NEW</b><span>{CURRENT_RULES_REVISION}</span></button>}<ThemeToggle theme={theme} onToggle={toggleTheme} /><button className="menu-button" onClick={() => setMenuOpen((open) => !open)} aria-controls="mobile-menu" aria-expanded={menuOpen} aria-label={menuOpen ? "Close site menu" : "Open site menu"}><span /><span /><span /></button></div><div className="reading-progress" role="progressbar" aria-label={`${VIEW_LABELS[view]} reading progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(scrollProgress * 100)}><span style={{ width: `${scrollProgress * 100}%` }} /><b>{VIEW_LABELS[view]}</b></div></header>
    {menuOpen && <><button className="menu-scrim" onClick={() => setMenuOpen(false)} aria-label="Close site menu" /><aside className="mobile-menu-panel" id="mobile-menu" aria-label="Site menu"><div className="mobile-menu-heading"><div><span className="eyebrow">Department directory</span><h2>Find your fight.</h2></div><button className="mobile-menu-close" onClick={() => setMenuOpen(false)} aria-label="Close site menu">×</button></div><label className="mobile-global-search"><span aria-hidden="true">⌕</span><input autoFocus value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} onKeyDown={handleGlobalSearchKeyDown} placeholder="Search the dojo" aria-label="Search cards, rules, rulings, glossary, and house rules" /></label>{globalSearch.trim().length >= 2 && (globalResults.length ? renderGlobalResults("mobile-search-results", "dojo-mobile-search-results") : <div className="mobile-search-results"><p>No matching filing number. Try a shorter search.</p></div>)}{rulesUpdateAvailable && <button type="button" className="mobile-rules-update" onClick={() => setShowRevision(true)}><b>New rules filing</b><span>{CURRENT_RULES_REVISION} · See what changed →</span></button>}<nav className="mobile-menu-links" aria-label="All site pages">{MOBILE_MENU_ITEMS.filter((item) => item.id !== "playtest").map((item) => <button className={view === item.id ? "active" : ""} onClick={() => goTo(item.id)} key={item.id}><span>{item.label}</span><small>{item.detail}</small></button>)}</nav><ThemeToggle theme={theme} onToggle={toggleTheme} full /></aside></>}
    <div key={view} className="view-stage">{view === "home" && <HomeView goTo={goTo} />}{view === "playtest" && <PlaytestView goTo={goTo} />}{view === "quickstart" && <QuickStartView goTo={goTo} />}{view === "story" && <StoryView goTo={goTo} />}{view === "rules" && <RulesView key={`${searchedRuleChapter || "rules"}-${searchedRuleSection}`} initialChapterId={searchedRuleChapter} initialSectionId={searchedRuleSection} />}{view === "cards" && <CardsView initialCard={searchedCard} clearInitialCard={() => setSearchedCard(null)} />}{view === "rulings" && <RulingsView key={searchedRuling || "rulings"} initialQuery={searchedRuling} />}{view === "glossary" && <GlossaryView key={searchedTerm || "glossary"} initialQuery={searchedTerm} />}{view === "house-rules" && <HouseRulesView key={searchedHouseRule || "house-rules"} initialQuery={searchedHouseRule} />}</div>
    <footer className="site-footer"><div className="shell footer-inner"><div className="brand footer-brand"><BrandMark /><span><b>DOJO</b><em>DECKBUILDER</em></span></div><p>Build your deck. Earn your belt. Try not to fold.</p><span>Filed with the Department. Probably correctly.</span></div></footer>
    {showRevision && <DetailModal eyebrow="New Department Filing" title={`${CURRENT_RULES_REVISION} is now current`} onClose={() => setShowRevision(false)} accent="gold"><p className="modal-lede">This browser has not marked the current rules revision as reviewed yet. Here are the changes most likely to matter at the table.</p><ul className="revision-notes">{RULES_REVISION_NOTES.map((note) => <li key={note}>{note}</li>)}</ul><div className="revision-actions"><button className="button primary" type="button" onClick={() => { acknowledgeRulesRevision(); goTo("rules"); }}>Review full rules →</button><button className="button ghost" type="button" onClick={acknowledgeRulesRevision}>Mark reviewed</button></div></DetailModal>}
    {scrollProgress > .2 && <button className="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top"><span aria-hidden="true">↑</span><b>Top</b></button>}
    <nav className="mobile-nav" aria-label="Mobile navigation"><button className={view === "home" ? "active" : ""} onClick={() => goTo("home")}><span aria-hidden="true">⌂</span>Home</button><button className={view === "quickstart" ? "active" : ""} onClick={() => goTo("quickstart")}><span aria-hidden="true">▶</span>Start</button><button className={view === "rules" ? "active" : ""} onClick={() => goTo("rules")}><span aria-hidden="true">§</span>Rules</button><button className={view === "cards" ? "active" : ""} onClick={() => goTo("cards")}><span aria-hidden="true">▤</span>Cards</button><button className={moreActive || menuOpen ? "active" : ""} onClick={() => setMenuOpen((open) => !open)} aria-controls="mobile-menu" aria-expanded={menuOpen}><span aria-hidden="true">☰</span>Menu</button></nav>
  </div>;
}
