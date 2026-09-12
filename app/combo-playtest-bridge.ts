import {
  comboChoiceOnAttack,
  comboCommandsForTrigger,
  comboDeferredCommandsOnCompletion,
  evaluateStructuredComboRequirements,
  structuredComboEffects,
  type ComboRuntimeCard,
  type ComboRuntimeChoice,
  type ComboRuntimeContext,
  type ComboRequirementResult,
} from "./combo-runtime.ts";
import type { RuntimeCommand, RuntimeTrigger } from "./family-effect-runtime.ts";

export type ComboHostPlan = {
  requirement: ComboRequirementResult;
  commandsByTrigger: Partial<Record<RuntimeTrigger, RuntimeCommand[]>>;
  deferredOnCompletion: RuntimeCommand[];
  choice: ComboRuntimeChoice | null;
  canonicalEffectIds: string[];
  coveredEffectIds: string[];
  unsupportedEffectIds: string[];
};

const runtimeTriggers: RuntimeTrigger[] = [
  "onPlay",
  "onHit",
  "onBlock",
  "afterResolve",
  "onAttackDeclared",
  "onDefenseDeclared",
  "onPurchase",
  "onEquip",
  "onInitiate",
  "onHide",
  "passive",
];

/**
 * Builds the complete machine-readable effect plan for a canonical Combo after
 * the host supplies requirement facts. The plan contains every canonical effect
 * exactly through structured commands/deferred commands/choice follow-ups; it
 * never parses printed requirement or payoff prose.
 */
export function comboPlanForHost(
  combo: ComboRuntimeCard,
  context: ComboRuntimeContext,
  completedAt: RuntimeTrigger = "onAttackDeclared",
): ComboHostPlan {
  const requirement = evaluateStructuredComboRequirements(combo, context);
  const effects = structuredComboEffects(combo);
  const commandsByTrigger: Partial<Record<RuntimeTrigger, RuntimeCommand[]>> = {};
  for (const trigger of runtimeTriggers) {
    const commands = comboCommandsForTrigger(combo, trigger);
    if (commands.length) commandsByTrigger[trigger] = commands;
  }
  const deferredOnCompletion = comboDeferredCommandsOnCompletion(combo, completedAt);
  const choice = comboChoiceOnAttack(combo);
  const canonicalEffectIds = effects.map((effect) => String(effect.id ?? "")).filter(Boolean);
  const covered = new Set<string>();
  for (const commands of Object.values(commandsByTrigger)) {
    for (const command of commands ?? []) covered.add(command.sourceEffectId);
  }
  for (const command of deferredOnCompletion) covered.add(command.sourceEffectId);
  if (choice) {
    covered.add(choice.sourceEffectId);
    choice.followupEffectIds.forEach((id) => covered.add(id));
  }
  return {
    requirement,
    commandsByTrigger,
    deferredOnCompletion,
    choice,
    canonicalEffectIds,
    coveredEffectIds: [...covered].sort(),
    unsupportedEffectIds: canonicalEffectIds.filter((id) => !covered.has(id)),
  };
}
