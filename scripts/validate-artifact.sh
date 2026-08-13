#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

worker="${SITES_PROJECT_ROOT}/dist/server/index.js"
hosting="${SITES_PROJECT_ROOT}/dist/.openai/hosting.json"
client_assets="${SITES_PROJECT_ROOT}/dist/client/assets"

[[ -f "${worker}" ]] || {
  echo "Missing Sites Worker entry: dist/server/index.js" >&2
  exit 66
}
[[ -f "${hosting}" ]] || {
  echo "Missing packaged Sites manifest: dist/.openai/hosting.json" >&2
  exit 66
}

shopt -s nullglob
companion_bundles=("${client_assets}"/companion-app-*.js)
shopt -u nullglob

if (( ${#companion_bundles[@]} != 1 )) || [[ ! -s "${companion_bundles[0]:-}" ]]; then
  echo "Expected exactly one current client companion bundle." >&2
  exit 66
fi

node --input-type=module - "${companion_bundles[0]}" <<'NODE'
import { readFile } from "node:fs/promises";

const bundle = await readFile(process.argv[2], "utf8");
const embeddedWebpImages = bundle.match(/data:image\/webp;base64,/g)?.length ?? 0;
if (embeddedWebpImages < 17) {
  throw new Error(`Expected at least 17 embedded WebP images; found ${embeddedWebpImages}.`);
}
NODE

node --input-type=module - "${worker}" "${hosting}" <<'NODE'
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const [workerPath, hostingPath] = process.argv.slice(2);
JSON.parse(await readFile(hostingPath, "utf8"));

const workerUrl = pathToFileURL(workerPath);
workerUrl.searchParams.set("sites-validation", `${process.pid}-${Date.now()}`);
const worker = await import(workerUrl.href);
if (!worker.default || typeof worker.default.fetch !== "function") {
  throw new Error("dist/server/index.js must have an ESM default export with fetch(request, env, ctx)");
}
NODE

echo "Validated Sites artifact: ESM Worker default.fetch and hosting manifest are present."
