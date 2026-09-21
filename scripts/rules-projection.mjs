const phaseChapter = (rules) => rules.chapters?.find((chapter) => chapter.number === 6);

export function buildRulesProjection(source, rules, cards) {
  const definition = source.definition;
  const cardById = new Map((cards.cards ?? []).map((card) => [card.catalogId, card]));
  return {
    schemaVersion: 1,
    rulesVersion: source.rulesVersion,
    rulesRevision: source.rulesRevision,
    authority: "content/dojo-game.json + content/rules.json + content/cards.json",
    setup: {
      mode: definition.mode,
      handSize: definition.turn.handSize,
      starterDeck: definition.starterDeck.map((entry) => ({ ...entry, name: cardById.get(entry.catalogId)?.name ?? entry.catalogId })),
      openingMulligan: definition.openingMulligan,
      market: definition.economy.market,
    },
    phases: definition.turn.phaseRules,
    combat: definition.combat,
    progression: definition.progression,
    publicRules: {
      chapters: rules.chapters,
      officialRulings: rules.officialRulings,
      glossary: rules.glossary,
      houseRules: rules.houseRules,
    },
    phaseDocumentation: phaseChapter?.sections ?? [],
  };
}

const blockMarkdown = (block) => {
  if (block.kind === "paragraph") return block.text;
  if (block.kind === "bullet") return `- ${block.text}`;
  if (block.kind === "table") return block.rows.map((row, index) => `| ${row.join(" | ")} |${index === 0 ? `\n| ${row.map(() => "---").join(" | ")} |` : ""}`).join("\n");
  return "";
};

export function rulesProjectionMarkdown(projection) {
  const lines = [`# Dojo Deckbuilder Canonical Rules`, ``, `Rules ${projection.rulesVersion} · revision ${projection.rulesRevision}`, ``, `> Generated from ${projection.authority}. This file is a public projection, not an independent rules source.`, ``, `## Machine-readable game definition`, ``, `- Mode: ${projection.setup.mode.id}`, `- Players: ${projection.setup.mode.players}`, `- Starting HP: ${projection.setup.mode.startingHp}`, `- Opening hand: ${projection.setup.handSize}`, `- Market row: ${projection.setup.market.rowSize}`, ``, `### Phase contract`, ``];
  for (const phase of projection.phases) { lines.push(`#### ${phase.id} — ${phase.timing}`, ``, `Actor: ${phase.actor}.`, ``); for (const item of phase.automatic ?? []) lines.push(`- Automatic: ${item}`); for (const item of phase.actions ?? []) lines.push(`- Legal capability: ${item}`); lines.push(""); }
  lines.push("## Public rules", "");
  for (const chapter of projection.publicRules.chapters) { lines.push(`## ${chapter.fullTitle ?? chapter.title}`, ""); for (const block of chapter.intro ?? []) lines.push(blockMarkdown(block), ""); for (const section of chapter.sections ?? []) { lines.push(`### ${section.title}`, ""); for (const block of section.content ?? []) lines.push(blockMarkdown(block), ""); } }
  lines.push("## Glossary", ""); for (const entry of projection.publicRules.glossary ?? []) lines.push(`### ${entry.term}`, "", entry.meaning, "");
  lines.push("## Official rulings", ""); for (const ruling of projection.publicRules.officialRulings ?? []) lines.push(`### ${ruling.title}`, "", `${ruling.id} · ${ruling.filed} · ${ruling.tag}`, "", ruling.ruling, "");
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}
