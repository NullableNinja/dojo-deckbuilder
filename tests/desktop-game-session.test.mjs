import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import test from "node:test";

function session() {
  const child = spawn(process.execPath, ["engine/desktop-server.mjs"], { stdio: ["pipe", "pipe", "pipe"] });
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const pending = new Map();
  lines.on("line", (line) => { const message = JSON.parse(line); pending.get(message.id)?.(message); pending.delete(message.id); });
  let nextId = 1;
  return {
    command(message) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, resolve);
        child.stdin.write(`${JSON.stringify({ ...message, id })}\n`, (error) => { if (error) reject(error); });
      });
    },
    close() { lines.close(); child.kill(); },
  };
}

test("desktop game session starts playable Boss Blitz without the website runtime", async () => {
  const game = session();
  try {
    const response = await game.command({ type: "start", mode: "boss-blitz", seed: 42 });
    assert.equal(response.ok, true);
    assert.equal(response.view.screen, "game");
    assert.equal(response.view.mode, "boss-blitz");
    assert.equal(response.view.boss.stageName, "Rival");
    assert.equal(response.view.phase, "Initiate");
    assert.ok(response.view.legalActions.some((action) => action.type === "pass"));
  } finally { game.close(); }
});

test("desktop game session advances player actions through the shared engine", async () => {
  const game = session();
  try {
    let response = await game.command({ type: "start", mode: "boss-blitz", seed: 7 });
    const pass = response.view.legalActions.find((action) => action.type === "pass");
    response = await game.command({ type: "action", action: pass });
    assert.equal(response.ok, true);
    assert.notEqual(response.view.phase, "Honor");
    assert.equal(response.view.winner, null);
  } finally { game.close(); }
});

test("desktop Boss Blitz pauses for the human player's defense choice", async () => {
  const game = session();
  try {
    let response = await game.command({ type: "start", mode: "boss-blitz", seed: 42 });
    for (let step = 0; step < 8 && !response.view.pendingChoice; step += 1) {
      const action = response.view.legalActions.find((candidate) => candidate.type === "pass")
        ?? response.view.legalActions.find((candidate) => candidate.type === "hide");
      assert.ok(action, `expected a legal phase action at step ${step}`);
      response = await game.command({ type: "action", action });
    }
    assert.equal(response.ok, true);
    assert.equal(response.view.pendingChoice?.playerId, 0);
    assert.ok(["reaction", "defense"].includes(response.view.pendingChoice?.kind));
    const firstChoice = response.view.pendingChoice.options[0];
    response = await game.command({ type: "choice", choice: { optionId: firstChoice.id } });
    assert.equal(response.ok, true);
    assert.equal(response.view.winner, null);
  } finally { game.close(); }
});
