import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const writeJson = async (path, value) => writeFile(new URL(path, root), `${JSON.stringify(value, null, 2)}\n`, "utf8");

const registryPath = "content/card-effects.json";
const registry = await readJson(registryPath);
registry.cards ??= {};

const power = (id, amount, kind, operator = "eq", value = true) => ({
  id,
  trigger: "onAttackDeclared",
  action: "modifyAttackPower",
  target: "source",
  amount,
  duration: "immediate",
  conditions: [{ kind, operator, value }],
  resolver: "attack.conditionalPower",
});

const speedPenalty = (id, amount) => ({
  id,
  trigger: "onHit",
  action: "modifySpeed",
  target: "opponent",
  amount: -Math.abs(amount),
  duration: "nextHonor",
  resolver: "attack.targetSpeedPenaltyUntilHonor",
});

const focus = (id, trigger = "onHit", amount = 1) => ({
  id,
  trigger,
  action: "gainFocus",
  target: "self",
  amount,
  duration: "immediate",
});

const additions = {
  "DDB-ATK-CORE-017": {
    name: "Dragon Tail Sweep",
    effects: [speedPenalty("attack-dragon-tail-speed", 2)],
  },
  "DDB-ATK-CORE-018": {
    name: "Emotional Support Headbutt",
    effects: [power("attack-emotional-support-hand-size", 2, "hasFewerCardsThanTarget")],
  },
  "DDB-ATK-CORE-022": {
    name: "Flying Front Kick",
    effects: [
      power("attack-flying-front-second-attack", 1, "attackNumber", "eq", 2),
      focus("attack-flying-front-resolve-focus", "afterResolve", 1),
    ],
  },
  "DDB-ATK-CORE-029": {
    name: "Hook Kick",
    effects: [power("attack-hook-kick-low-setup", 2, "priorLowAttack")],
  },
  "DDB-ATK-CORE-031": {
    name: "Horizontal Elbow",
    effects: [power("attack-horizontal-elbow-item-setup", 2, "previousCardIsItemOrConsumable")],
  },
  "DDB-ATK-CORE-037": {
    name: "Mall Ninja Flying Side Kick",
    effects: [power("attack-mall-ninja-improvised-weapon", 2, "hasImprovisedWeapon")],
  },
  "DDB-ATK-CORE-038": {
    name: "Outside Crescent Kick",
    effects: [speedPenalty("attack-outside-crescent-speed", 1)],
  },
  "DDB-ATK-CORE-045": {
    name: "Rear Hand Punch",
    effects: [power("attack-rear-hand-punch-setup", 1, "priorPunchAttack")],
  },
  "DDB-ATK-CORE-046": {
    name: "Rear Thrust Kick",
    effects: [power("attack-rear-thrust-was-hit", 2, "wasHitSinceLastTurn")],
  },
  "DDB-ATK-CORE-050": {
    name: "Roundhouse Kick",
    effects: [power("attack-roundhouse-zone-change", 1, "differentZoneFromPreviousAttack")],
  },
  "DDB-ATK-CORE-051": {
    name: "Second Opinion Straight",
    effects: [
      power("attack-second-opinion-second-attack", 1, "attackNumber", "eq", 2),
      focus("attack-second-opinion-hit-focus", "onHit", 1),
    ],
  },
  "DDB-ATK-CORE-056": {
    name: "Spinning Hook Kick",
    effects: [power("attack-spinning-hook-mid-high-setup", 2, "previousAttackZoneMidOrHigh")],
  },
  "DDB-ATK-CORE-066": {
    name: "Triple Round Kick",
    effects: [power("attack-triple-round-two-zones", 2, "priorDifferentZoneCount", "gte", 2)],
  },
  "DDB-ATK-CORE-068": {
    name: "Turnstile Side Kick",
    effects: [power("attack-turnstile-tempo", 1, "hasTempo")],
  },
  "DDB-ATK-CORE-070": {
    name: "Upward Elbow",
    effects: [power("attack-upward-elbow-faster-target", 2, "targetSpeedHigher")],
  },
  "DDB-ATK-CORE-071": {
    name: "Wheel Kick",
    effects: [power("attack-wheel-kick-spin-setup", 2, "priorSpinAttack")],
  },
};

for (const [catalogId, entry] of Object.entries(additions)) {
  registry.cards[catalogId] = entry;
}

const sortedCards = Object.fromEntries(Object.entries(registry.cards).sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true })));
registry.cards = sortedCards;
await writeJson(registryPath, registry);

const cardEffectsPath = new URL("app/card-effects.ts", root);
let cardEffects = await readFile(cardEffectsPath, "utf8");
const marker = '  "attack.targetNextAttackPenalty",\n';
const addition = '  "attack.targetNextAttackPenalty",\n  "attack.targetSpeedPenaltyUntilHonor",\n';
if (!cardEffects.includes('"attack.targetSpeedPenaltyUntilHonor"')) {
  if (!cardEffects.includes(marker)) throw new Error("Could not locate dedicated Attack resolver registration marker");
  cardEffects = cardEffects.replace(marker, addition);
  await writeFile(cardEffectsPath, cardEffects, "utf8");
}

execFileSync(process.execPath, ["scripts/generate-game-data.mjs"], { cwd: new URL(".", root), stdio: "inherit" });
console.log(`Migrated ${Object.keys(additions).length} additional Attack cards to structured behavior.`);
