from pathlib import Path

path = Path("app/companion-app.tsx")
source = path.read_text()

replacements = [
    (
        'import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";',
        'import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";',
    ),
    (
        'const PlaytestView = lazy(() => import("./playtest"));',
        'import PlaytestView from "./playtest";',
    ),
    (
        '{view === "playtest" && <Suspense fallback={<main className="playtest-loading shell"><span className="eyebrow">Field Test</span><h1>Preparing the mat…</h1><p>The Department is locating the correct clipboard.</p></main>}><PlaytestView goTo={goTo} /></Suspense>}',
        '{view === "playtest" && <PlaytestView goTo={goTo} />}',
    ),
]

for old, new in replacements:
    if old not in source:
        raise SystemExit(f"Expected Playtest fragment not found: {old[:120]}")
    source = source.replace(old, new, 1)

path.write_text(source)
