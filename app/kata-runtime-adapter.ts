import { kataCommandsForHost, type KataHostFacts } from "./kata-playtest-bridge.ts";
import type { RuntimeCardLike, RuntimeCommand, RuntimeDuration, RuntimeTrigger } from "./family-effect-runtime.ts";
import type { KataCommand } from "./kata-effect-resolvers.ts";

export type KataRuntimeFacts = KataHostFacts & {
  firstAttackThisTurn?: boolean;
};

const EFFECT_BY_ACTION: Record<string, string> = {
  draw: "core.draw",
  discard: "core.discard",
  heal: "core.heal",
  gainFocus: "core.gainFocus",
  gainXP: "core.gainXP",
  destroy: "core.destroy",
  reveal: "core.reveal",
  modifySpeed: "combat.modifySpeed",
  modifyAttackPower: "combat.modifyAttackPower",
  modifyDefense: "combat.modifyDefense",
  modifyGuard: "combat.modifyGuard",
  preventDamage: "combat.preventDamage",
  dealDamage: "combat.dealDamage",
  grantFlow: "combat.grantFlow",
  chooseZone: "combat.chooseZone",
  modifyCost: "economy.modifyCost",
  ready: "equipment.ready",
  exhaust: "equipment.exhaust",
};

const DIRECT_RESOLVERS = new Set([
  "kata.conditional",
  "kata.branch",
  "kata.flowGrant",
  "kata.zoneOverride",
]);

function runtimeEffect(command: KataCommand) {
  if (command.kind === "grantFlow" || command.params?.grantFlowTo === "nextAttack") return "combat.grantFlow";
  if (command.kind === "armZoneOverride") return "combat.chooseZone";
  return EFFECT_BY_ACTION[String(command.action ?? "")] ?? "";
}

function runtimeDuration(command: KataCommand, effect: string): RuntimeDuration {
  if (command.duration) return command.duration;
  if (effect === "combat.grantFlow" || effect === "combat.chooseZone") return "nextAttack";
  return "immediate";
}

function commandApplies(command: KataCommand, facts: KataRuntimeFacts) {
  if (command.params?.firstAttackThisTurn === true && facts.firstAttackThisTurn !== true) return false;
  return true;
}

function qualifier(command: KataCommand, effect: string) {
  const next: Record<string, unknown> = {};
  const attackZones = Array.isArray(command.params?.attackZones) ? command.params?.attackZones.map(String) : [];
  if (attackZones.length) next.attackZones = attackZones;
  if (effect === "combat.grantFlow" || effect === "combat.chooseZone") next.nextAttack = true;
  return Object.keys(next).length ? next : undefined;
}

/**
 * Converts the Kata resolver commands that already map cleanly onto Quick Duel's
 * generic RuntimeCommand/status machinery. Stateful choices/deferred event
 * commands are deliberately excluded and are hosted by dedicated Kata adapters.
 */
export function kataDirectRuntimeCommands(
  card: RuntimeCardLike,
  trigger: RuntimeTrigger,
  facts: KataRuntimeFacts = {},
): RuntimeCommand[] {
  const commands: RuntimeCommand[] = [];
  for (const command of kataCommandsForHost(card, trigger, facts)) {
    if (!command.resolver || !DIRECT_RESOLVERS.has(command.resolver)) continue;
    if (!commandApplies(command, facts)) continue;
    const effect = runtimeEffect(command);
    if (!effect) continue;
    commands.push({
      sourceEffectId: String(command.effectId ?? `kata:${command.resolver}`),
      effect,
      trigger,
      target: String(command.target ?? "self"),
      amount: Number(command.amount ?? 0),
      duration: runtimeDuration(command, effect),
      resolver: command.resolver,
      conditions: [],
      qualifier: qualifier(command, effect),
    });
  }
  return commands;
}
