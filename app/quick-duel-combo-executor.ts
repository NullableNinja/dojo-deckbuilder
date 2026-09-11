import {
  applyRuntimeCommands,
  createFamilyRuntimeState,
  type FamilyRuntimeState,
  type RuntimeCommand,
  type RuntimeTrigger,
} from "./family-effect-runtime.ts";
import { comboFollowupCommands, type ComboRuntimeCard, type ComboRuntimeChoice } from "./combo-runtime.ts";
import type { ComboHostPlan } from "./combo-playtest-bridge.ts";

export type ComboHostChoiceAction = {
  action: "discard";
  cardId: string;
};

export type QuickDuelComboExecution = {
  plan: ComboHostPlan;
  completedAt: RuntimeTrigger;
  runtime: FamilyRuntimeState;
  active: boolean;
  firedTriggers: RuntimeTrigger[];
  executedEffectIds: string[];
  queuedEffectIds: string[];
  pendingChoice: ComboRuntimeChoice | null;
};

export type ComboTriggerResult = {
  execution: QuickDuelComboExecution;
  commands: RuntimeCommand[];
};

export type ComboChoiceResult = {
  execution: QuickDuelComboExecution;
  accepted: boolean;
  action: ComboHostChoiceAction | null;
  commands: RuntimeCommand[];
};

const lower = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase();
const tags = (card: ComboRuntimeCard) => (card.tags ?? []).map(lower);

function cardMatchesChoiceFilter(choice: ComboRuntimeChoice, card: ComboRuntimeCard) {
  const requiredTag = lower(choice.filter.tag);
  if (requiredTag && !tags(card).some((tag) => tag === requiredTag || tag.includes(requiredTag))) return false;
  const requiredFamily = lower(choice.filter.family);
  if (requiredFamily) {
    const actual = [card.cardType, card.subtype].map(lower);
    if (!actual.includes(requiredFamily) && !tags(card).includes(requiredFamily)) return false;
  }
  return true;
}

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))];
}

function withCommands(
  execution: QuickDuelComboExecution,
  commands: RuntimeCommand[],
  classification: "executed" | "queued",
): QuickDuelComboExecution {
  if (!commands.length) return execution;
  return {
    ...execution,
    runtime: applyRuntimeCommands(execution.runtime, commands),
    executedEffectIds: classification === "executed"
      ? unique([...execution.executedEffectIds, ...commands.map((command) => command.sourceEffectId)])
      : execution.executedEffectIds,
    queuedEffectIds: classification === "queued"
      ? unique([...execution.queuedEffectIds, ...commands.map((command) => command.sourceEffectId)])
      : execution.queuedEffectIds,
  };
}

function deferredCommandIsDueOnCompletion(command: RuntimeCommand, completedAt: RuntimeTrigger) {
  return completedAt === "onAttackDeclared" && command.qualifier?.activateAt === "nextTurnAttack";
}

function commandDueNow(command: RuntimeCommand): RuntimeCommand {
  return { ...command, duration: "immediate" };
}

/**
 * Activates a fully structured Combo host plan at the gameplay event that
 * completed its requirement. The host supplies facts; this executor only
 * consumes the canonical plan and never reads printed rules or card identity.
 *
 * Commands for later triggers remain active in the session so a Combo completed
 * on Attack declaration can still resolve canonical onHit/afterResolve effects.
 * Deferred effects are installed immediately as runtime statuses because their
 * structured duration/qualifier describes the future consumption window.
 *
 * A nextTurnAttack payoff is special only at the semantic event level: when the
 * Combo itself becomes eligible on an Attack declaration, that declaration is
 * already the canonical next-turn Attack and the payoff is due now. Completions
 * on earlier events (for example, a Defense) keep the same command deferred.
 */
export function activateQuickDuelComboPlan(
  plan: ComboHostPlan,
  completedAt: RuntimeTrigger,
  runtime: FamilyRuntimeState = createFamilyRuntimeState(),
): ComboTriggerResult {
  let execution: QuickDuelComboExecution = {
    plan,
    completedAt,
    runtime,
    active: plan.requirement.eligible && plan.requirement.supported,
    firedTriggers: [],
    executedEffectIds: [],
    queuedEffectIds: [],
    pendingChoice: null,
  };
  if (!execution.active) return { execution, commands: [] };

  const dueNow = plan.deferredOnCompletion
    .filter((command) => deferredCommandIsDueOnCompletion(command, completedAt))
    .map(commandDueNow);
  const deferred = plan.deferredOnCompletion.filter((command) => !deferredCommandIsDueOnCompletion(command, completedAt));
  const immediate = [...(plan.commandsByTrigger[completedAt] ?? []), ...dueNow];
  execution = withCommands(execution, immediate, "executed");
  execution = withCommands(execution, deferred, "queued");
  execution = {
    ...execution,
    firedTriggers: [completedAt],
    pendingChoice: plan.choice && completedAt === "onAttackDeclared" ? plan.choice : null,
  };
  return { execution, commands: immediate };
}

/** Publish a later generic gameplay trigger to an already completed Combo. */
export function publishQuickDuelComboTrigger(
  execution: QuickDuelComboExecution,
  trigger: RuntimeTrigger,
): ComboTriggerResult {
  if (!execution.active || execution.firedTriggers.includes(trigger)) return { execution, commands: [] };
  const commands = execution.plan.commandsByTrigger[trigger] ?? [];
  let next = withCommands(execution, commands, "executed");
  next = { ...next, firedTriggers: [...execution.firedTriggers, trigger] };
  return { execution: next, commands };
}

/**
 * Validates a structured Combo choice against its machine-readable filter and
 * exposes the host action separately from the canonical payoff commands. The
 * UI/board host performs the actual card movement; no card-specific rule is
 * embedded here.
 */
export function resolveQuickDuelComboChoice(
  execution: QuickDuelComboExecution,
  combo: ComboRuntimeCard,
  selectedCard: ComboRuntimeCard,
): ComboChoiceResult {
  const choice = execution.pendingChoice;
  if (!execution.active || !choice || !cardMatchesChoiceFilter(choice, selectedCard)) {
    return { execution, accepted: false, action: null, commands: [] };
  }
  const commands = comboFollowupCommands(combo, choice.followupEffectIds);
  const next = withCommands({ ...execution, pendingChoice: null }, commands, "executed");
  return {
    execution: next,
    accepted: true,
    action: { action: choice.action, cardId: selectedCard.id },
    commands,
  };
}

/**
 * Retires the transient plan after the host has published all resolution events
 * for the action that completed the Combo. Deferred runtime statuses remain in
 * runtime state and are consumed by their normal generic duration windows.
 */
export function closeQuickDuelComboExecution(execution: QuickDuelComboExecution): QuickDuelComboExecution {
  return { ...execution, active: false, pendingChoice: null };
}
