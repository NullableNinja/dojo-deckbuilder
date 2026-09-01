import { useEffect, useRef, useState } from "react";

type SimulationResult = {
  games: number;
  rulesVersion: string;
  averageRounds: number;
  averageTurns: number;
  roundLimitRate: number;
  averagePurchases: number;
  wins: Record<string, { games: number; wins: number; winRate: number }>;
  curves: { round: number; xp: number; focus: number }[];
  cardPicks: { id: string; name: string; purchases: number; pickRate: number }[];
};

function ResourceCurve({ points }: { points: SimulationResult["curves"] }) {
  if (points.length < 2) return null;
  const width = 480;
  const height = 150;
  const maxRound = Math.max(...points.map((point) => point.round), 1);
  const maxValue = Math.max(...points.flatMap((point) => [point.xp, point.focus]), 1);
  const plot = (key: "xp" | "focus") => points.map((point) => {
    const x = 16 + (point.round / maxRound) * (width - 32);
    const y = height - 18 - (point[key] / maxValue) * (height - 36);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return <figure className="simulation-curve">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Average XP and unspent Focus by round">
      <line x1="16" y1={height - 18} x2={width - 16} y2={height - 18} />
      <polyline className="curve-xp" points={plot("xp")} />
      <polyline className="curve-focus" points={plot("focus")} />
    </svg>
    <figcaption><span><i className="curve-xp" />XP</span><span><i className="curve-focus" />Unspent Focus before Hide</span></figcaption>
  </figure>;
}

export default function SimulationLab() {
  const workerRef = useRef<Worker | null>(null);
  const [games, setGames] = useState(250);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const run = () => {
    workerRef.current?.terminate();
    const worker = new Worker(new URL("./simulation-worker.mjs", import.meta.url), { type: "module" });
    workerRef.current = worker;
    setRunning(true);
    setProgress(0);
    setResult(null);
    setError(null);
    worker.onmessage = ({ data }) => {
      if (data.type === "progress") setProgress(data.completed / data.games);
      if (data.type === "complete") {
        setResult(data.result as SimulationResult);
        setRunning(false);
        worker.terminate();
        workerRef.current = null;
      }
    };
    worker.onerror = (event) => {
      setError(event.message || "The simulation clerk dropped the clipboard.");
      setRunning(false);
      worker.terminate();
      workerRef.current = null;
    };
    worker.postMessage({ games });
  };

  return <section className="simulation-lab paper-stack">
    <header><div><span className="eyebrow">Automated test lab</span><h2>Run the dojo overnight—in about a second</h2></div><span className="simulation-cap">1–1,000 games</span></header>
    <p>Deterministic bots use the same rules snapshot and Market configuration as the headless engine. Results stay in this browser.</p>
    <div className="simulation-controls">
      <label>Games<input type="number" min="1" max="1000" step="50" value={games} onChange={(event) => setGames(Math.max(1, Math.min(1000, Number(event.target.value) || 1)))} /></label>
      <button className="button primary" disabled={running} onClick={run}>{running ? `Simulating ${Math.round(progress * 100)}%` : `Run ${games.toLocaleString()} games`}</button>
      {running && <progress max="1" value={progress} aria-label="Simulation progress" />}
    </div>
    {error && <p className="simulation-error">{error}</p>}
    {result && <div className="simulation-results" aria-live="polite">
      <div className="simulation-kpis"><b>{result.averageRounds}<small>AVG ROUNDS</small></b><b>{result.averagePurchases}<small>PICKS / PLAYER</small></b><b>{(result.roundLimitRate * 100).toFixed(1)}%<small>ROUND LIMIT</small></b><b>{result.games}<small>GAMES</small></b></div>
      <ResourceCurve points={result.curves} />
      <div className="simulation-tables"><table><caption>Strategy win rate</caption><tbody>{Object.entries(result.wins).map(([strategy, row]) => <tr key={strategy}><th>{strategy}</th><td>{(row.winRate * 100).toFixed(1)}%</td></tr>)}</tbody></table><table><caption>Most purchased cards</caption><tbody>{result.cardPicks.slice(0, 5).map((card) => <tr key={card.id}><th>{card.name}</th><td>{(card.pickRate * 100).toFixed(1)}%</td></tr>)}</tbody></table></div>
      <small className="simulation-version">Rules snapshot {result.rulesVersion} · seeded and reproducible</small>
    </div>}
  </section>;
}
