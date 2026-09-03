#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const cards = JSON.parse(fs.readFileSync(path.join(root, "app/data/cards.json"), "utf8")).cards;
const assetDir = path.join(root, "app/assets/cards/consumables");
const outZip = path.join(root, "public/downloads/Dojo_Deckbuilder_v2.3_Consumable_Cards.zip");
const wanted = new Set("001 002 003 004 005 006 009 011 013 014 016 017 018 019 021 022 023 024 025 026 027 028 029 033 035 036 037 041 042 043 046 047 048 049 050 051 052 053 054 055 056 057 059 060 061 062".split(" "));
const files = fs.readdirSync(assetDir);
const imageMagick = process.env.IMAGEMAGICK_BIN || "convert";

for (const card of cards) {
  const match = /^DDB-CON-CORE-(\d{3})$/.exec(card.catalogId || "");
  if (!match || !wanted.has(match[1])) continue;
  const filename = files.find((entry) => entry.startsWith(`ddb-con-core-${match[1]}_`) && entry.endsWith(".webp"));
  if (!filename) throw new Error(`Missing consumable artwork for ${card.catalogId}`);
  const source = path.join(assetDir, filename);
  const temporary = `${source}.paper-fu-tmp.webp`;
  execFileSync(imageMagick, [
    source,
    "(",
    "-size", "410x42",
    "-background", "none",
    "-fill", "#3b3935",
    "-font", "DejaVu-Serif-Italic",
    "-pointsize", "13",
    "-gravity", "center",
    `caption:${card.flavorText || ""}`,
    ")",
    "-gravity", "NorthWest",
    "-geometry", "+70+128",
    "-composite",
    "-quality", "85",
    temporary,
  ], { stdio: "inherit" });
  fs.renameSync(temporary, source);
}

fs.mkdirSync(path.dirname(outZip), { recursive: true });
if (fs.existsSync(outZip)) fs.unlinkSync(outZip);
const cardPaths = fs.readdirSync(assetDir).filter((entry) => entry.endsWith(".webp")).sort().map((entry) => path.join(assetDir, entry));
execFileSync("zip", ["-q", "-j", outZip, ...cardPaths], { stdio: "inherit" });
console.log(`Finalized ${wanted.size} Consumable card faces and the backup ZIP.`);
