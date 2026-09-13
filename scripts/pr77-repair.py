from pathlib import Path

path = Path("app/playtest.tsx")
source = path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global source
    if old not in source:
        raise SystemExit(f"Missing expected fragment for {label}: {old[:180]}")
    source = source.replace(old, new, 1)


replace_once(
    '  | { kind: "character-runtime"; event: CharacterRuntimeEvent; choice: CharacterRuntimeChoice };\n\ntype Match = {',
    '  | { kind: "character-runtime"; event: CharacterRuntimeEvent; choice: CharacterRuntimeChoice };\n\ntype CharacterRuntimePendingChoice = Extract<PendingChoice, { kind: "character-runtime" }>;\n\nfunction characterRuntimePendingChoice(\n  pendingChoice: PendingChoice | null | undefined\n): CharacterRuntimePendingChoice | null {\n  return pendingChoice?.kind === "character-runtime" ? pendingChoice : null;\n}\n\ntype Match = {',
    "typed pending-choice helper",
)

old_resolver = '''  const resolveCharacterRuntimeChoice = (selection: string) => setMatch((current) => {
    const pending = current?.pendingChoice;
    if (!current || !pending || pending.kind !== "character-runtime") return current;
    const base = { ...current, pendingChoice: null };
    const resolved = resolveQuickDuelPlaytestCharacterChoice(base, "player", pending.event, pending.choice, selection);
    const nextChoice = resolved.choices[0];
    const pendingChoice: PendingChoice | null = resolved.event && nextChoice
      ? { kind: "character-runtime", event: resolved.event, choice: nextChoice }
      : null;
    const selectedCard = cardFor(selection);
    const label = selectedCard?.name ?? (["skip", "decline", "cancel"].includes(selection) ? "declined" : selection);
    return write(resolved.match, `${cardFor(current.player.fighterId)?.name ?? "Your fighter"} resolves ${pending.choice.prompt}: ${label}.`, { pendingChoice });
  });'''
new_resolver = '''  const applyCharacterRuntimeChoice = (current: Match, selection: string): Match => {
    const pending = current.pendingChoice;
    if (!pending || pending.kind !== "character-runtime") return current;
    const base = { ...current, pendingChoice: null };
    const resolved = resolveQuickDuelPlaytestCharacterChoice(base, "player", pending.event, pending.choice, selection);
    const nextChoice = resolved.choices[0];
    const pendingChoice: PendingChoice | null = resolved.event && nextChoice
      ? { kind: "character-runtime", event: resolved.event, choice: nextChoice }
      : null;
    const selectedCard = cardFor(selection);
    const label = selectedCard?.name ?? (["skip", "decline", "cancel"].includes(selection) ? "declined" : selection);
    return write(resolved.match, `${cardFor(current.player.fighterId)?.name ?? "Your fighter"} resolves ${pending.choice.prompt}: ${label}.`, { pendingChoice });
  };

  const resolveCharacterRuntimeChoice = (selection: string) => setMatch((current) =>
    current ? applyCharacterRuntimeChoice(current, selection) : current
  );'''
replace_once(old_resolver, new_resolver, "shared Character choice resolver")

replace_once(
    '''    if (current.pendingChoice.kind === "prevent-combat-damage") {
      const choice = current.pendingChoice;
      return resolveDefenseState(current, choice.defenseId, null, true);
    }
    if (current.pendingChoice.kind === "post-block-cycle")''',
    '''    if (current.pendingChoice.kind === "prevent-combat-damage") {
      const choice = current.pendingChoice;
      return resolveDefenseState(current, choice.defenseId, null, true);
    }
    if (current.pendingChoice.kind === "character-runtime") {
      if (!current.pendingChoice.choice.optional) return current;
      const selection = current.pendingChoice.choice.options.find((option) =>
        ["skip", "decline", "cancel"].includes(option)
      ) ?? "decline";
      return applyCharacterRuntimeChoice(current, selection);
    }
    if (current.pendingChoice.kind === "post-block-cycle")''',
    "Character skip routing after damage resume",
)

replace_once(
    '  const effectChoiceTitle = match.pendingChoice?.kind === "character-runtime" ? "Character ability"',
    '  const characterRuntimePending = characterRuntimePendingChoice(match.pendingChoice);\n  const effectChoiceTitle = characterRuntimePending ? "Character ability"',
    "choice title narrowing",
)
replace_once(
    '  const effectChoicePrompt = match.pendingChoice?.kind === "character-runtime" ? match.pendingChoice.choice.prompt',
    '  const effectChoicePrompt = characterRuntimePending ? characterRuntimePending.choice.prompt',
    "choice prompt narrowing",
)
replace_once(
    '  const effectChoiceCanSkip = (match.pendingChoice?.kind === "character-runtime" && match.pendingChoice.choice.optional) ||',
    '  const effectChoiceCanSkip = Boolean(characterRuntimePending?.choice.optional) ||',
    "choice optional narrowing",
)
replace_once(
    '<div className="effect-choice-options">{match.pendingChoice?.kind === "character-runtime" ? match.pendingChoice.choice.options.filter(',
    '<div className="effect-choice-options">{characterRuntimePending ? characterRuntimePending.choice.options.filter(',
    "choice options narrowing",
)
replace_once(
    'onClick={() => { const pending = match.pendingChoice; if (pending?.kind === "character-runtime") { const selection = pending.choice.options.find((option: string) => ["skip", "decline", "cancel"].includes(option)) ?? "decline"; resolveCharacterRuntimeChoice(selection); return; } skipPendingChoice(); }}',
    'onClick={skipPendingChoice}',
    "shared optional-effect footer",
)

replace_once(
    '''  const nextAi = playAreaCleanup(aiAfterPurchase);
  const purchaseLog = purchasedCard ? `Computer buys ${purchasedCard.name}.` : "Computer buys nothing.";
  const finished = { ...current, ai: nextAi, market, marketDeck, marketDiscard, marketPurchasedThisRound: current.marketPurchasedThisRound || Boolean(purchasedCard), winner: nextAi.hp ? current.winner : "player" as const, log: [purchaseLog, ...(promotionLog ? [promotionLog] : []), line, ...current.log].slice(0, 32) };''',
    '''  const hostedHide = publishQuickDuelPlaytestLifecycleEvent({ ...current, ai: aiAfterPurchase }, "ai", "onHide", quickDuelHostOperations, cardFor).match;
  const nextAi = playAreaCleanup(hostedHide.ai);
  const purchaseLog = purchasedCard ? `Computer buys ${purchasedCard.name}.` : "Computer buys nothing.";
  const finished = { ...hostedHide, ai: nextAi, market, marketDeck, marketDiscard, marketPurchasedThisRound: current.marketPurchasedThisRound || Boolean(purchasedCard), winner: nextAi.hp ? current.winner : "player" as const, log: [purchaseLog, ...(promotionLog ? [promotionLog] : []), line, ...hostedHide.log].slice(0, 32) };''',
    "AI Hide publication",
)
replace_once(
    '    const hostedFinished = publishQuickDuelPlaytestLifecycleEvent(finished, "player", "onInitiate", quickDuelHostOperations).match;',
    '    const hostedFinished = withPlayerCharacterChoice(publishQuickDuelPlaytestLifecycleEvent(finished, "player", "onInitiate", quickDuelHostOperations, cardFor));',
    "second-player Initiate choice publication",
)
replace_once(
    '  const hostedInitiate = playerFirst ? publishQuickDuelPlaytestLifecycleEvent(stagedForInitiate, "player", "onInitiate", quickDuelHostOperations).match : stagedForInitiate;',
    '  const hostedInitiate = playerFirst ? withPlayerCharacterChoice(publishQuickDuelPlaytestLifecycleEvent(stagedForInitiate, "player", "onInitiate", quickDuelHostOperations, cardFor)) : stagedForInitiate;',
    "round Initiate choice publication",
)
replace_once(
    'pendingChoice: null, pendingCombatContinuation: null, locationId,',
    'pendingChoice: hostedInitiate.pendingChoice ?? null, pendingCombatContinuation: null, locationId,',
    "preserve Character choice into advanced round",
)
replace_once(
    '  if (sceneChanges && lucky && locationId !== current.locationId) {',
    '  if (!advanced.pendingChoice && sceneChanges && lucky && locationId !== current.locationId) {',
    "Location reveal choice precedence",
)
replace_once(
    '  if (marketRefreshes && lucky) {',
    '  if (!advanced.pendingChoice && marketRefreshes && lucky) {',
    "Market reveal choice precedence",
)

path.write_text(source)

test_path = Path("tests/playtest-character-choice-ui.test.mjs")
test_path.write_text('''import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport test from "node:test";\n\nconst source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");\n\ntest("Quick Duel exposes generic Character runtime choices instead of a Ducktape-specific UI", () => {\n  assert.match(source, /resolveQuickDuelPlaytestCharacterChoice/);\n  assert.match(source, /kind: "character-runtime"/);\n  assert.match(source, /withPlayerCharacterChoice/);\n  assert.ok(\n    (source.match(/"onHide"/g) ?? []).length >= 2,\n    "player and AI Hide must publish through the Character runtime"\n  );\n  assert.doesNotMatch(source, /const borrowEquipment\\s*=/);\n  assert.doesNotMatch(source, /playerFighter\\.name === "Sensei Ducktape"/);\n  assert.doesNotMatch(source, /ducktape-tray/);\n});\n\ntest("player Character choices block Initiate progression and use the shared pending-choice interaction layer", () => {\n  assert.match(source, /current\\?\\.phase === "player-initiate" && !current\\.pendingChoice/);\n  assert.match(source, /type CharacterRuntimePendingChoice = Extract<PendingChoice, \\{ kind: "character-runtime" \\}>/);\n  assert.match(source, /characterRuntimePendingChoice\\(match\\.pendingChoice\\)/);\n  assert.match(source, /const applyCharacterRuntimeChoice =/);\n  assert.match(source, /current\\.pendingChoice\\.kind === "character-runtime"/);\n  assert.match(source, /return applyCharacterRuntimeChoice\\(current, selection\\)/);\n  assert.match(source, /onClick=\\{skipPendingChoice\\}>Skip this optional effect/);\n});\n\ntest("Character choices survive round transitions and take precedence over reveal reactions", () => {\n  assert.match(source, /pendingChoice: hostedInitiate\\.pendingChoice \\?\\? null/);\n  assert.match(source, /!advanced\\.pendingChoice && sceneChanges && lucky/);\n  assert.match(source, /!advanced\\.pendingChoice && marketRefreshes && lucky/);\n});\n''')
