import { Game } from "./core.mjs";
import { BossBlitzGame } from "./boss-blitz.mjs";

export function createGame(data, config = {}) {
  return data?.definition?.mode?.id === "boss-blitz" ? new BossBlitzGame(data, config) : new Game(data, config);
}

export { Game, BossBlitzGame };
