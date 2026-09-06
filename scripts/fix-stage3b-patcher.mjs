import { readFileSync, writeFileSync } from "node:fs";
const path = "scripts/stage3b-finish-attacks.mjs";
let text = readFileSync(path, "utf8");
const old = '  if (text.indexOf(from, index + from.length) >= 0) throw new Error(`Patch anchor is not unique: ${label}`);';
const replacement = '  if (text.indexOf(from, index + from.length) >= 0) {\n    if (label === "player Combo Focus ledger") return text.split(from).join(to);\n    throw new Error(`Patch anchor is not unique: ${label}`);\n  }';
if (!text.includes(old)) throw new Error("replaceOnce guard not found");
text = text.replace(old, replacement);
writeFileSync(path, text);
