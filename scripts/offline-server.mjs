import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { extname, join, resolve } from "node:path";

const root = resolve(process.cwd(), process.argv.find((arg) => arg.startsWith("--root="))?.slice(7) ?? "dist");
const port = Number(process.argv.find((arg) => arg.startsWith("--port="))?.slice(7) ?? 4173) || 4173;
const noOpen = process.argv.includes("--no-open");
const contentTypes = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2" };

function safePath(urlPath) {
  const requested = decodeURIComponent((urlPath || "/").split("?")[0]);
  const candidate = resolve(root, `.${requested}`);
  return candidate === root || candidate.startsWith(`${root}${process.platform === "win32" ? "\\" : "/"}`) ? candidate : null;
}

const server = createServer(async (request, response) => {
  try {
    let filePath = safePath(request.url);
    if (!filePath) { response.writeHead(400); response.end("Bad path"); return; }
    try { if ((await stat(filePath)).isDirectory()) filePath = join(filePath, "index.html"); } catch { /* fall through to SPA fallback */ }
    let body;
    try { body = await readFile(filePath); } catch { body = await readFile(join(root, "index.html")); filePath = join(root, "index.html"); }
    response.writeHead(200, { "content-type": contentTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream", "cache-control": "no-cache" }); response.end(body);
  } catch (error) { response.writeHead(500); response.end(String(error)); }
});

server.listen(port, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${port}/`;
  console.log(`Dojo Deckbuilder offline UI: ${url}`);
  if (!noOpen && process.platform === "win32") spawn("cmd", ["/c", "start", "", url], { detached: true, windowsHide: true, stdio: "ignore" }).unref();
});

process.on("SIGINT", () => server.close(() => process.exit(0)));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
