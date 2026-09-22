export type EquipmentHandCard = {
  id: string;
  subtype?: string | null;
  tags?: string[];
  stats?: Record<string, unknown>;
  details?: Record<string, unknown>;
};

export type EquipmentCardLookup = (id: string) => EquipmentHandCard | null | undefined;

export const EQUIPMENT_HAND_CAPACITY = 2;

function isWeapon(card: EquipmentHandCard | null | undefined) {
  return Boolean(
    card
    && (
      String(card.subtype ?? "").toLocaleLowerCase() === "weapon"
      || (card.tags ?? []).some((tag) => String(tag).toLocaleLowerCase() === "weapon")
    )
  );
}

export function weaponHandRequirement(card: EquipmentHandCard | null | undefined) {
  if (!isWeapon(card)) return 0;
  const raw = card?.stats?.Hands ?? card?.details?.Hands;
  const match = String(raw ?? "").match(/\d+/);
  return match ? Math.max(1, Number(match[0])) : 1;
}

export function equipmentHandLimit(
  equippedIds: readonly string[],
  candidate: EquipmentHandCard | null | undefined,
  lookup: EquipmentCardLookup,
) {
  const occupied = equippedIds.reduce((total, id) => total + weaponHandRequirement(lookup(id)), 0);
  const required = weaponHandRequirement(candidate);
  const available = Math.max(0, EQUIPMENT_HAND_CAPACITY - occupied);
  return {
    allowed: required === 0 || occupied + required <= EQUIPMENT_HAND_CAPACITY,
    occupied,
    required,
    available,
    capacity: EQUIPMENT_HAND_CAPACITY,
  };
}

export function repairEquipmentHandLimit(
  equippedIds: readonly string[],
  lookup: EquipmentCardLookup,
) {
  const equipment: string[] = [];
  const removed: string[] = [];
  let occupied = 0;

  for (const id of equippedIds) {
    const required = weaponHandRequirement(lookup(id));
    if (!required) {
      equipment.push(id);
      continue;
    }
    if (occupied + required <= EQUIPMENT_HAND_CAPACITY) {
      equipment.push(id);
      occupied += required;
      continue;
    }
    removed.push(id);
  }

  return { equipment, removed, occupied, capacity: EQUIPMENT_HAND_CAPACITY };
}
