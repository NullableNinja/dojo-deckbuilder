from pathlib import Path

path = Path("app/quick-duel-transition-host.ts")
source = path.read_text()
old = '''function publishCharacterLifecycleTransitions<Board extends QuickDuelTransitionBoard>(
  previous: QuickDuelTransitionMatch<Board>,
  nextInput: QuickDuelTransitionMatch<Board>,
  roundAdvanced: boolean,
  turnAdvanced: boolean,
): QuickDuelTransitionMatch<Board> {
  let next = nextInput;

  if (roundAdvanced) {
    for (const actor of ["player", "ai"] as const) {
      const board = actorBoard(next, actor);
      if (!looksLikeCharacterRuntimeBoard(board)) continue;
      next = setActorBoard(next, actor, resetCharacterHostRound(board) as Board);
    }
    for (const actor of ["player", "ai"] as const) {
      const published = publishCharacterTransitionEvent(next, actor, { type: "roundStart" });
      next = published.match;
    }
  }

  if (turnAdvanced) {
    const actor = activeActor(next);
    const board = actorBoard(next, actor);
    if (looksLikeCharacterRuntimeBoard(board)) {
      next = setActorBoard(next, actor, resetCharacterHostTurn(board) as Board);
    }
    next = publishCharacterTransitionEvent(next, actor, { type: "turnStart" }).match;
  }

  return next;
}
'''
new = '''function publishCharacterLifecycleTransitions<Board extends QuickDuelTransitionBoard>(
  previous: QuickDuelTransitionMatch<Board>,
  nextInput: QuickDuelTransitionMatch<Board>,
  roundAdvanced: boolean,
  turnAdvanced: boolean,
): QuickDuelTransitionMatch<Board> {
  let next = nextInput;
  const turnActor = turnAdvanced ? activeActor(next) : null;

  if (roundAdvanced) {
    for (const actor of ["player", "ai"] as const) {
      const board = actorBoard(next, actor);
      if (!looksLikeCharacterRuntimeBoard(board)) continue;
      next = setActorBoard(next, actor, resetCharacterHostRound(board) as Board);
    }
  } else if (turnActor) {
    const board = actorBoard(next, turnActor);
    if (looksLikeCharacterRuntimeBoard(board)) {
      next = setActorBoard(next, turnActor, resetCharacterHostTurn(board) as Board);
    }
  }

  if (roundAdvanced) {
    for (const actor of ["player", "ai"] as const) {
      const published = publishCharacterTransitionEvent(next, actor, { type: "roundStart" });
      next = published.match;
    }
  }

  if (turnActor) {
    next = publishCharacterTransitionEvent(next, turnActor, { type: "turnStart" }).match;
  }

  return next;
}
'''
if old not in source:
    raise SystemExit("lifecycle function anchor not found")
path.write_text(source.replace(old, new, 1))
