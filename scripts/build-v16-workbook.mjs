import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectRoot = "/workspace/scratch/9b41c0d6d87f/sites/dojo-deckbuilder";
const outputRoot = "/workspace/scratch/9b41c0d6d87f/outputs/dojo-deckbuilder-v16";
const cardsData = JSON.parse(await fs.readFile(`${projectRoot}/app/data/cards.json`, "utf8"));
const audit = JSON.parse(await fs.readFile(`${projectRoot}/app/data/card-migration-audit.json`, "utf8"));
const balance = JSON.parse(await fs.readFile(`${projectRoot}/app/data/balance-report.json`, "utf8"));
await fs.mkdir(outputRoot, { recursive: true });

const workbook = Workbook.create();
const colors = { ink: "#18221D", green: "#285C4B", red: "#C6432D", gold: "#DDA928", paper: "#FFF9E9", pale: "#EFE2C5", line: "#D8C39A", white: "#FFFFFF" };
const clean = (value) => value === null || value === undefined ? "" : value;
const colName = (number) => {
  let result = "";
  while (number > 0) { number -= 1; result = String.fromCharCode(65 + number % 26) + result; number = Math.floor(number / 26); }
  return result;
};
const title = (sheet, text, subtitle, columns) => {
  sheet.showGridLines = false;
  sheet.getRange(`A1:${colName(columns)}1`).merge();
  sheet.getRange("A1").values = [[text]];
  sheet.getRange("A1").format = { fill: colors.ink, font: { bold: true, color: colors.white, size: 20 }, rowHeight: 33, verticalAlignment: "center" };
  sheet.getRange(`A2:${colName(columns)}2`).merge();
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange("A2").format = { fill: colors.pale, font: { italic: true, color: colors.green }, rowHeight: 28, wrapText: true, verticalAlignment: "center" };
};
const styleTable = (sheet, headerRow, rowCount, columnCount) => {
  const lastColumn = colName(columnCount);
  sheet.getRange(`A${headerRow}:${lastColumn}${headerRow}`).format = { fill: colors.green, font: { bold: true, color: colors.white }, wrapText: true, verticalAlignment: "center", rowHeight: 36, borders: { preset: "all", style: "thin", color: colors.line } };
  if (rowCount) {
    sheet.getRange(`A${headerRow + 1}:${lastColumn}${headerRow + rowCount}`).format = { fill: colors.paper, font: { color: colors.ink }, wrapText: true, verticalAlignment: "top", borders: { preset: "all", style: "thin", color: colors.line } };
    sheet.getRange(`A${headerRow + 1}:B${headerRow + rowCount}`).format.font = { color: colors.red, bold: true };
  }
  sheet.freezePanes.freezeRows(headerRow);
  sheet.getRange(`A${headerRow}:${lastColumn}${headerRow + rowCount}`).format.autofitColumns();
  sheet.getRange(`A${headerRow}:${lastColumn}${Math.min(headerRow + rowCount, headerRow + 50)}`).format.autofitRows();
  for (let column = 1; column <= columnCount; column += 1) {
    const range = sheet.getRange(`${colName(column)}:${colName(column)}`);
    if (range.format.columnWidth > 38) range.format.columnWidth = 38;
  }
};

// Create all sheets up front so formulas and cross-sheet references are stable.
const summary = workbook.worksheets.add("Summary");
const economy = workbook.worksheets.add("Economy Guide");
const starterSheet = workbook.worksheets.add("Starter Deck");
const auditSheet = workbook.worksheets.add("Migration Audit");
const watchSheet = workbook.worksheets.add("Balance Watch");
const sheetGroups = [
  ["Starter Pool", "Starter Pool"], ["Characters", "Characters"], ["Techniques - Attack", "Techniques - Attack"],
  ["Techniques - Defense", "Techniques - Defense"], ["Techniques - Kata", "Techniques - Kata"],
  ["Items - Consumable", "Items - Consumable"], ["Items - Weapons", "Items - Weapons"],
  ["Items - Defense", "Items - Defense"], ["Combos", "Combos"], ["Locations", "Locations"],
  ["Boss Stages", "Boss Stages"], ["Boss Techniques", "Boss Techniques"],
];
const cardSheets = new Map(sheetGroups.map(([source, name]) => [source, workbook.worksheets.add(name)]));

title(summary, "Dojo Deckbuilder — v1.6 Economy Draft", "No-Chi migration dashboard · 413 cards · fixed Starter Deck · complete review audit", 8);
summary.getRange("A4:B12").values = [
  ["Migration Check", "Value"],
  ["Total catalog cards", ""],
  ["One-to-one audit rows", ""],
  ["Cards with rewritten records", ""],
  ["Focused watch-list cards", ""],
  ["Legacy economy terms", balance.catalogChecks.legacyEconomyTerms],
  ["Median first purchase turn", balance.economyResults.firstPurchaseTurn.median],
  ["Mean purchases in 12 turns", balance.economyResults.purchasesWithin12Turns.mean],
  ["Mean zero-Focus turns in 12", balance.economyResults.zeroFocusTurnsWithin12.mean],
];
summary.getRange("B5").formulas = [["=COUNTA('Migration Audit'!B5:B417)"]];
summary.getRange("B6").formulas = [["=COUNTA('Migration Audit'!B5:B417)"]];
summary.getRange("B7").formulas = [["=SUM('Migration Audit'!N5:N417)"]];
summary.getRange("B8").formulas = [["=SUM('Migration Audit'!O5:O417)"]];
styleTable(summary, 4, 8, 2);
summary.getRange("D4:E10").values = [
  ["Focus Cost", "Market Cards"],
  ...Object.entries(balance.catalogChecks.marketCostDistribution).map(([cost, count]) => [Number(cost), count]),
];
styleTable(summary, 4, 6, 5);
summary.getRange("A14:H18").values = [
  ["Status", "Decision", "Reason", "Next Gate", "", "", "", ""],
  ["Draft", "Remove Chi", "It duplicated hand limits and timing without supplying a needed victory function.", "Human combat and matchup playtests", "", "", "", ""],
  ["Locked", "Focus is temporary purchasing power", "Preserves the intended DC-style deckbuilding role without becoming Victory Points.", "Verify purchase pacing by mode", "", "", "", ""],
  ["Locked", "XP is permanent progression", "Belts and victory already give XP a complete job.", "Verify belt timing", "", "", "", ""],
  ["Locked", "Two normal Attacks", "Prevents free-play burst from scaling only with hand size; Flow and Combo Extension create controlled exceptions.", "Watch-list sign-off", "", "", "", ""],
];
summary.getRange("A14:H14").format = { fill: colors.red, font: { bold: true, color: colors.white } };
summary.getRange("A15:H18").format = { fill: colors.paper, wrapText: true, verticalAlignment: "top", borders: { preset: "all", style: "thin", color: colors.line } };
summary.getRange("A14:H18").format.autofitRows();
summary.getRange("A:A").format.columnWidth = 26; summary.getRange("B:B").format.columnWidth = 20; summary.getRange("C:C").format.columnWidth = 47; summary.getRange("D:D").format.columnWidth = 29;

title(economy, "v1.6 Economy Contract", "The authoritative no-Chi baseline used for the rules rewrite and 413-card migration", 4);
const economyRows = [
  ["System", "Rule", "Purpose", "Guardrail"],
  ["Focus", "Cards legally played or Equipped from hand during your own turn generate printed Focus. Spend it during Ascend; lose the remainder during Hide.", "Temporary purchasing power", "No banking; off-turn cards do not generate printed Focus"],
  ["XP", "Gain permanent XP from rounds, legal Attacks, legal Defenses, KOs, and effects.", "Belt progression and victory", "XP is not spent"],
  ["Attack Limit", "Normally two Attacks per turn.", "Bounds free-play burst", "Every Attack still needs legal timing, target, and zone"],
  ["Flow", "The first Flow Attack each turn does not count against the two-Attack limit.", "Controlled tempo engine", "Only one Flow exemption per turn"],
  ["Combo Extension", "Once per turn, a learned Combo may permit its required third Attack as the Finishing Technique.", "Makes multi-Attack Combos functional", "Only the actual required finisher"],
  ["Tempo", "Once per round, a faster fighter gets +1 Damage on an Attack or +1 Guard on a Defense against the slower active opponent.", "Makes Speed matter after initiative", "One use per player per round"],
  ["Defense", "One Defense per Attack. Playing it outside your turn consumes that card from the hand you will use next turn.", "Defensive choice has an opportunity cost", "No automatic replacement draw"],
  ["Bad Habit", "No effect; generates 0 Focus.", "Starter-deck friction and thinning target", "No universal discard-for-Focus action"],
];
economy.getRange(`A4:D${3 + economyRows.length}`).values = economyRows;
styleTable(economy, 4, economyRows.length - 1, 4);
economy.getRange("A:A").format.columnWidth = 20; economy.getRange("B:B").format.columnWidth = 55; economy.getRange("C:C").format.columnWidth = 32; economy.getRange("D:D").format.columnWidth = 38;

title(starterSheet, "Fixed Standard Starter Deck", "Every player uses these exact 15 cards; Core Game entries are numbered before expansion cards", 5);
const starterRows = [
  ["Group", "Catalog ID", "Card", "Quantity", "Focus Value"],
  ["Attack", "DDB-COR-STR-003", "Basic Jab", 1, 1],
  ["Attack", "DDB-COR-STR-002", "Basic Body Kick", 1, 1],
  ["Attack", "DDB-COR-STR-004", "Basic Shin Kick", 1, 1],
  ["Attack", "DDB-COR-STR-011", "Wild Swing", 1, 1],
  ["Defense", "DDB-COR-STR-009", "High Guard", 1, 1],
  ["Defense", "DDB-COR-STR-006", "Center Guard", 1, 1],
  ["Defense", "DDB-COR-STR-010", "Low Guard", 1, 1],
  ["Defense", "DDB-COR-STR-007", "Cover Up", 1, 1],
  ["Kata", "DDB-COR-STR-005", "Breathing Drill", 1, 1],
  ["Kata", "DDB-COR-STR-008", "Footwork Drill", 1, 1],
  ["Junk", "DDB-COR-STR-001", "Bad Habit", 5, 0],
  ["TOTAL", "", "", "=SUM(D5:D15)", ""],
];
starterSheet.getRange(`A4:E${3 + starterRows.length}`).values = starterRows.map((row) => row.map((cell) => typeof cell === "string" && cell.startsWith("=") ? null : cell));
starterSheet.getRange("D16").formulas = [["=SUM(D5:D15)"]];
styleTable(starterSheet, 4, starterRows.length - 1, 5);

const auditHeaders = ["Catalog Order", "Catalog ID", "Release Set", "Source Sheet", "Card Type", "Card", "Old Play Cost", "Focus Cost", "Focus Value", "Old Rules Text", "v1.6 Rules Text", "Directly Impacted", "Text Changed", "Migration Changed", "Watch List", "Review Status", "Balance Note"];
const auditRows = audit.map((entry) => [entry.catalogOrder, entry.catalogId, entry.releaseSet, entry.sourceSheet, entry.cardType, entry.name, clean(entry.oldChiCost), clean(entry.focusCost), clean(entry.focusValue), entry.oldRulesText, entry.newRulesText, entry.directlyImpacted, entry.textChanged, entry.textChanged ? 1 : 0, entry.reviewStatus.includes("watch list") ? 1 : 0, entry.reviewStatus, entry.balanceNote]);
title(auditSheet, "Complete Card Migration Audit", "Exactly one review row for each catalog card · old play-cost column retained only for migration traceability", auditHeaders.length);
auditSheet.getRangeByIndexes(3, 0, auditRows.length + 1, auditHeaders.length).values = [auditHeaders, ...auditRows];
styleTable(auditSheet, 4, auditRows.length, auditHeaders.length);
auditSheet.getRange("A:A").format.columnWidth = 12; auditSheet.getRange("B:B").format.columnWidth = 22; auditSheet.getRange("F:F").format.columnWidth = 30; auditSheet.getRange("J:K").format.columnWidth = 55; auditSheet.getRange("P:Q").format.columnWidth = 48;

title(watchSheet, "Focused Human Playtest Watch List", `${balance.watchList.length} draw, Flow, extra-Attack, or high-Focus effects identified by the deterministic economy smoke test`, 4);
const watchRows = balance.watchList.map((entry) => [entry.catalogId, entry.name, entry.cardType, entry.rulesText]);
watchSheet.getRangeByIndexes(3, 0, watchRows.length + 1, 4).values = [["Catalog ID", "Card", "Type", "v1.6 Rules Text"], ...watchRows];
styleTable(watchSheet, 4, watchRows.length, 4);
watchSheet.getRange("A:A").format.columnWidth = 22; watchSheet.getRange("B:B").format.columnWidth = 31; watchSheet.getRange("D:D").format.columnWidth = 65;

for (const [source, sheet] of cardSheets) {
  const group = cardsData.cards.filter((card) => card.sourceSheet === source).sort((left, right) => left.catalogOrder - right.catalogOrder);
  const detailKeys = [...new Set(group.flatMap((card) => Object.keys(card.details ?? {})))].filter((key) => !["Catalog Order", "Catalog ID", "Release Set", "Focus Cost", "Focus Value", "Rules Text"].includes(key) && !/Chi|\bFP\b/i.test(key));
  const headers = ["Catalog Order", "Catalog ID", "Release Set", "Deck", "Card Type", "Subtype", "Name", "Focus Cost", "Focus Value", "Zone", "Timing", "v1.6 Rules Text", "Tags", "Build Paths", "Flavor Text", ...detailKeys];
  const rows = group.map((card) => [card.catalogOrder, card.catalogId, card.expansion, card.deck, card.cardType, card.subtype, card.name, clean(card.fpCost), clean(card.focusValue), clean(card.zone), clean(card.timing), clean(card.rulesText), (card.tags ?? []).join(", "), (card.buildPaths ?? []).join(" / "), clean(card.flavorText), ...detailKeys.map((key) => clean(card.details?.[key]))]);
  title(sheet, `${source} — v1.6`, `${rows.length} cards · catalog order is Core Game first, then expansions`, headers.length);
  sheet.getRangeByIndexes(3, 0, rows.length + 1, headers.length).values = [headers, ...rows];
  styleTable(sheet, 4, rows.length, headers.length);
  sheet.getRange("A:A").format.columnWidth = 12; sheet.getRange("B:B").format.columnWidth = 22; sheet.getRange("C:D").format.columnWidth = 27; sheet.getRange("G:G").format.columnWidth = 31; sheet.getRange("L:L").format.columnWidth = 55; sheet.getRange("O:O").format.columnWidth = 42;
}

const inspect = await workbook.inspect({ kind: "sheet", include: "id,name", maxChars: 6000 });
await fs.writeFile(`${outputRoot}/workbook-inspect.ndjson`, inspect.ndjson ?? String(inspect));

for (const name of ["Summary", "Economy Guide", "Starter Deck", "Migration Audit", "Balance Watch", ...sheetGroups.map(([, sheetName]) => sheetName)]) {
  const preview = await workbook.render({ sheetName: name, range: name === "Migration Audit" ? "A1:Q22" : name === "Summary" ? "A1:H18" : "A1:P18", scale: 0.85, format: "png" });
  await fs.writeFile(`${outputRoot}/preview-${name.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`, new Uint8Array(await preview.arrayBuffer()));
}

const exported = await SpreadsheetFile.exportXlsx(workbook);
await exported.save(`${outputRoot}/Dojo-Deckbuilder-Card-List-v1.6-Economy-Draft.xlsx`);
console.log(`${outputRoot}/Dojo-Deckbuilder-Card-List-v1.6-Economy-Draft.xlsx`);
