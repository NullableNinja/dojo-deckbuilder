import { readFile, writeFile } from "node:fs/promises";

const path = "app/effect-resolvers.ts";
let text = await readFile(path, "utf8");
text = text.replace('from "./equipment-structured";', 'from "./equipment-structured.ts";');
if (!text.includes('from "./equipment-structured.ts";')) {
  throw new Error("Unable to normalize Equipment structured resolver import.");
}
await writeFile(path, text, "utf8");
