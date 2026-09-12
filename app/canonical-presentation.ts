import cardsJson from "./data/cards.json";
import rulesJson from "./data/rules.json";
import gameDefinitionJson from "./data/game-definition.json";

type RuleBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "table"; rows: (string | number)[][] };
type RuleSection = { id: string; title: string; content: RuleBlock[] };
type RuleChapter = { id: string; number: number; title: string; intro: RuleBlock[]; sections: RuleSection[] };
type CardEntry = {
  name: string;
  catalogId: string;
  cardType: string;
  subtype: string;
  fpCost?: string | number | null;
  focusValue?: string | number | null;
  zone?: string | null;
  timing?: string | null;
  stats: Record<string, string | number>;
};

type RulesData = { chapters: RuleChapter[] };
type GameDefinition = {
  mode: { startingHp: number };
  turn: { handSize: number };
  progression: { belts: { id: string; xp: number }[] };
};

const rules = rulesJson as unknown as RulesData;
const cards = (cardsJson as unknown as { cards: CardEntry[] }).cards;
const gameDefinition = gameDefinitionJson as unknown as GameDefinition;

const chapter = (number: number) => rules.chapters.find((entry) => entry.number === number);
const section = (chapterNumber: number, id: string) => chapter(chapterNumber)?.sections.find((entry) => entry.id === id);
const paragraphs = (blocks: RuleBlock[] | undefined) => (blocks ?? []).filter((block): block is Extract<RuleBlock, { kind: "paragraph" }> => block.kind === "paragraph").map((block) => block.text);
const bullets = (blocks: RuleBlock[] | undefined) => (blocks ?? []).filter((block): block is Extract<RuleBlock, { kind: "bullet" }> => block.kind === "bullet").map((block) => block.text);
const tableRows = (blocks: RuleBlock[] | undefined) => (blocks ?? []).find((block): block is Extract<RuleBlock, { kind: "table" }> => block.kind === "table")?.rows ?? [];
const stripStepNumber = (text: string) => text.replace(/^\s*\d+\.\s*/, "").trim();
const numeric = (value: string | number | null | undefined) => {
  if (typeof value === "number") return value;
  const match = String(value ?? "").match(/-?\d+/);
  return match ? Number(match[0]) : 0;
};

export const HAND_SIZE = gameDefinition.turn.handSize;
export const STARTING_HP = gameDefinition.mode.startingHp;
export const BLACK_BELT_XP = gameDefinition.progression.belts.find((belt) => belt.id === "black")?.xp ?? 0;

export const SETUP_STEPS = paragraphs(section(4, "setup-steps")?.content).map(stripStepNumber);

export const STARTER_CARDS = tableRows(section(4, "standard-starter-deck")?.content).slice(1).map((row) => {
  const [group, count, contents] = row;
  const cardsInGroup = String(contents ?? "").split(";").map((entry) => entry.trim()).filter(Boolean);
  return {
    group: String(group),
    count: Number(count),
    icon: String(group).startsWith("Attack") ? "A" : String(group).startsWith("Defense") ? "D" : String(group).startsWith("Kata") ? "K" : "!",
    purpose: `${count} registered ${String(group).toLocaleLowerCase()} in the fixed Starter Deck.`,
    cards: cardsInGroup,
  };
});

const starterCard = (name: string) => {
  const card = cards.find((entry) => entry.name === name);
  if (!card) throw new Error(`Canonical Starter card '${name}' is missing from generated cards.json`);
  return {
    name: card.name,
    catalogId: card.catalogId,
    zone: card.zone ?? "—",
    timing: card.timing ?? "—",
    focus: numeric(card.focusValue),
    power: numeric(card.stats["Attack Power"] ?? card.stats.Guard ?? card.stats.Power ?? card.stats["Power / Guard"]),
  };
};

export const STARTER_EXAMPLES = {
  basicJab: starterCard("Basic Jab"),
  highGuard: starterCard("High Guard"),
};

const phaseChapter = chapter(6);
const phaseTable = tableRows(phaseChapter?.intro);
const phaseSection = (name: string) => phaseChapter?.sections.find((entry) => entry.title.toLocaleLowerCase().startsWith(name.toLocaleLowerCase()));
const phaseQuips: Record<string, string> = {
  Honor: "One Honor. One Location. Several people insisting they were faster.",
  Initiate: "Stretch, breathe, attach the suspicious helmet.",
  Yell: "Practice the block. Spend the block. Try not to need the block.",
  Ascend: "Turn questionable decisions into a slightly better deck.",
  Hide: "Clean the paper cuts off the mat and pretend it was tactical.",
};

export const PHASES = phaseTable.slice(1).map((row) => {
  const [phase, when, what] = row.map(String);
  const [letterPart, namePart] = phase.split("—").map((entry) => entry.trim());
  return {
    letter: letterPart.replace(/\s+/g, "").slice(0, 1),
    name: namePart || phase,
    when,
    text: what,
  };
});

export const PHASE_DETAILS = PHASES.map((phase) => {
  const current = phaseSection(phase.name);
  const steps = [...paragraphs(current?.content), ...bullets(current?.content)].map(stripStepNumber);
  return {
    name: phase.name,
    when: phase.when,
    who: phase.name === "Honor" ? "Everyone together" : "The active player",
    steps,
    quip: phaseQuips[phase.name] ?? "Filed, stamped, and probably understood.",
  };
});

const modeChapter = chapter(3);
const modeTable = tableRows(modeChapter?.intro);
const MODE_IDS: Record<string, string> = {
  "Standard Clash": "standard-clash",
  "Quick Duel": "quick-duel",
  "Tag Team: Swap-Fu": "tag-team",
  "Dojo Drama: Boss Blitz": "boss-blitz",
};
const MODE_LABELS: Record<string, string> = {
  "standard-clash": "Classic",
  "quick-duel": "Fast",
  "tag-team": "Recommended",
  "boss-blitz": "Solo / Co-op",
};
const MODE_ORDER = ["tag-team", "standard-clash", "quick-duel", "boss-blitz"];

export const GAME_MODES = modeTable.slice(1).map((row) => {
  const [title, players, fighters, win] = row.map(String);
  const id = MODE_IDS[title] ?? title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const canonicalSection = modeChapter?.sections.find((entry) => entry.id === id);
  const detail = paragraphs(canonicalSection?.content)[0] ?? "";
  return {
    id,
    label: MODE_LABELS[id] ?? "Mode",
    title,
    players: players === "1v1" ? "Exactly 2 players" : players.includes("player") ? players : `${players} players`,
    fighters: `${fighters} Character${fighters === "1" ? "" : "s"} each`,
    win,
    detail,
    notes: [] as string[],
  };
}).sort((a, b) => MODE_ORDER.indexOf(a.id) - MODE_ORDER.indexOf(b.id));

export const QUICKSTART_CANONICAL_SUMMARY = paragraphs(section(4, "quickstart")?.content);
export const VICTORY_CONDITIONS = bullets(section(3, "victory-conditions")?.content);
