export type CharacterModifiedCardType = "Attack" | "Defense";

export const CHARACTER_OPPONENT_CARD_MODIFICATION_QUEUE_MARK = "structuredHost.opponentCardModificationQueue";

type CharacterMarkedBoard = {
  characterMarks?: Record<string, unknown>;
};

type RuntimeCommandLike = {
  effect?: string;
  target?: string;
  duration?: string;
};

function normalizedCardKind(card: { cardType?: string; subtype?: string } | null | undefined) {
  const subtype = String(card?.subtype ?? "").trim().toLocaleLowerCase();
  const cardType = String(card?.cardType ?? "").trim().toLocaleLowerCase();
  if (subtype === "attack" || cardType === "attack") return "Attack" as const;
  if (subtype === "defense" || cardType === "defense") return "Defense" as const;
  return null;
}

export function characterSemanticCardType(card: { cardType?: string; subtype?: string } | null | undefined): CharacterModifiedCardType | null {
  return normalizedCardKind(card);
}

export function queueOpponentCardModification<Board extends CharacterMarkedBoard>(board: Board, type: CharacterModifiedCardType): Board {
  const marks = { ...(board.characterMarks ?? {}) };
  const current = Array.isArray(marks[CHARACTER_OPPONENT_CARD_MODIFICATION_QUEUE_MARK])
    ? (marks[CHARACTER_OPPONENT_CARD_MODIFICATION_QUEUE_MARK] as unknown[]).filter((value): value is CharacterModifiedCardType => value === "Attack" || value === "Defense")
    : [];
  marks[CHARACTER_OPPONENT_CARD_MODIFICATION_QUEUE_MARK] = current.includes(type) ? current : [...current, type];
  return { ...board, characterMarks: marks };
}

export function opponentCardModificationQueue(board: CharacterMarkedBoard): CharacterModifiedCardType[] {
  const value = board.characterMarks?.[CHARACTER_OPPONENT_CARD_MODIFICATION_QUEUE_MARK];
  return Array.isArray(value)
    ? value.filter((entry): entry is CharacterModifiedCardType => entry === "Attack" || entry === "Defense")
    : [];
}

export function clearOpponentCardModificationQueue<Board extends CharacterMarkedBoard>(board: Board): Board {
  if (!board.characterMarks?.[CHARACTER_OPPONENT_CARD_MODIFICATION_QUEUE_MARK]) return board;
  const marks = { ...(board.characterMarks ?? {}) };
  delete marks[CHARACTER_OPPONENT_CARD_MODIFICATION_QUEUE_MARK];
  return { ...board, characterMarks: marks };
}

export function runtimeCommandCardModificationTypes(commands: readonly RuntimeCommandLike[]): CharacterModifiedCardType[] {
  const result = new Set<CharacterModifiedCardType>();
  for (const command of commands) {
    if (command.target !== "opponent") continue;
    if (command.effect === "combat.modifyAttackPower" && command.duration === "nextAttack") result.add("Attack");
    if (command.effect === "combat.modifyGuard" && command.duration === "nextDefense") result.add("Defense");
  }
  return [...result];
}
