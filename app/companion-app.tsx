"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
const COMPLETE_CARD_URLS_BY_CATALOG_ID = Object.fromEntries(
  Object.entries({ ...ATTACK_CARD_URLS, ...DEFENSE_CARD_URLS, ...KATA_CARD_URLS, ...CONSUMABLE_CARD_URLS, ...DEFENSE_EQUIPMENT_CARD_URLS }).flatMap(([path, url]) => {
    const match = path.match(/\/(ddb-(?:atk|def|kat|con|deq)-core-\d{3})_/i);
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
type GlobalResult = { type: "Card" | "Glossary" | "Rule" | "Ruling" | "House Rule"; title: string; detail: string; view: ViewId; card?: CardEntry | null; query?: string; chapterId?: string };

const cardData = cardsJson as unknown as { version: string; cards: CardEntry[]; counts: Record<string, number>; decks: string[]; total: number };
const rulesData = rulesJson as { version: string; chapters: RuleChapter[]; officialRulings: OfficialRuling[]; glossary: { term: string; meaning: string }[]; houseRules: HouseRule[] };
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
  { id: "home", label: "Home", detail: "Return to the field test." },
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
  7: { label: "Read before 