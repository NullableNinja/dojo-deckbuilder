import fs from "node:fs";

const path = "scripts/apply-unified-routing.mjs";
let source = fs.readFileSync(path, "utf8");
const marker = 'source = source.slice(0, companionStart) + `';
const start = source.indexOf(marker);
if (start < 0) throw new Error("Companion replacement template marker not found");
const contentStart = start + marker.length;
const endMarker = '`;\n\nfs.writeFileSync(companionPath, source);';
const end = source.indexOf(endMarker, contentStart);
if (end < 0) throw new Error("Companion replacement template end not found");
const template = source.slice(contentStart, end).replaceAll("${", "\\${");
source = source.slice(0, contentStart) + template + source.slice(end);
fs.writeFileSync(path, source);
