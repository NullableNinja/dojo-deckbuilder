import { readFile, writeFile } from "node:fs/promises";

const path = "app/playtest.css";
const source = await readFile(path, "utf8");

const before = 'grid-template-areas: "belt-eyebrow belt-track" "belt-title belt-track" "belt-copy belt-track" "belt-ledger belt-ledger" "belt-promote belt-promote"; grid-template-rows: auto auto auto auto auto;';
const after = 'grid-template-areas: "belt-eyebrow belt-track" "belt-title belt-track" "belt-copy belt-track" "belt-stripes belt-track" "belt-ledger belt-ledger" "belt-promote belt-promote"; grid-template-rows: auto auto auto auto auto auto;';

const matches = source.split(before).length - 1;
if (matches !== 1) {
  throw new Error(`Expected exactly one final Belt Check grid definition; found ${matches}.`);
}

const repaired = source.replace(before, after);
await writeFile(path, repaired);

if (!repaired.includes('"belt-stripes belt-track"')) {
  throw new Error("Belt Check repair did not create the explicit Training Stripe grid row.");
}

console.log("Belt Check grid repaired: Training Stripes now occupy an explicit row before the full-width ledger.");
