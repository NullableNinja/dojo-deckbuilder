#!/usr/bin/env bash
set -euo pipefail

python <<'PY'
from pathlib import Path

materializer = Path('scripts/stage3c-integrate-playtest.mjs')
source = materializer.read_text()
before = '''replaceOnce(
  "stage3c helper insertion",
  "\\n\\nfunction cardMatchesDeckFilter(card: CardEntry | undefined, filter: \\"defense-or-kata\\" | \\"technique\\" | \\"item\\") {",
  `${helpers}\\nfunction cardMatchesDeckFilter(card: CardEntry | undefined, filter: "defense-or-kata" | "technique" | "item") {`,
);'''
after = '''if (!source.includes("function isCoreDefenseCard(card: CardEntry)")) {
  replaceOnce(
    "stage3c helper insertion",
    "\\n\\nfunction cardMatchesDeckFilter(card: CardEntry | undefined, filter: \\"defense-or-kata\\" | \\"technique\\" | \\"item\\") {",
    `${helpers}\\nfunction cardMatchesDeckFilter(card: CardEntry | undefined, filter: "defense-or-kata" | "technique" | "item") {`,
  );
}'''
if after not in source:
    if before not in source:
        raise SystemExit('Stage 3C helper insertion marker not found')
    materializer.write_text(source.replace(before, after))

finalizer = Path('scripts/stage3c-finalize.sh')
source = finalizer.read_text()
before = 'rm -f scripts/stage3c-finalize.sh\n'
after = 'rm -f scripts/stage3c-finalize.sh\nrm -f scripts/stage3c-finalize2.sh\n'
if after not in source:
    if before not in source:
        raise SystemExit('Stage 3C finalizer cleanup marker not found')
    finalizer.write_text(source.replace(before, after))
PY

exec bash scripts/stage3c-finalize.sh
