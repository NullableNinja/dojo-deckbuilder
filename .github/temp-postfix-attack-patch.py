from pathlib import Path

# Fix the final compiler-level details after the main attackDeclared migration patch.
# 1) El Pollo Rojo's catch-up damage is now owned by the canonical Hit runtime,
#    so no legacy fighterModifier damage term should remain in Playtest.
path = Path('app/playtest.tsx')
text = path.read_text()
text = text.replace(' + fighterModifier.damage', '')
text = text.replace('fighterModifier.damage + ', '')
assert 'fighterModifier' not in text, 'legacy fighterModifier reference remains after attackDeclared migration'
path.write_text(text)

# 2) Declaration fact derivation only needs card classification from the lookup.
# Use a deliberately small structural contract that accepts both generated
# RuntimeCatalogCard values (nullable subtype, optional name) and Playtest cards.
path = Path('app/quick-duel-playtest-host.ts')
text = path.read_text()
anchor = 'function quickDuelCharacterAttackDeclaredEvent<Board extends CharacterRuntimeBoard>('
insert = '''type QuickDuelCharacterAttackLookupCard = {\n  cardType?: string | null;\n  subtype?: string | null;\n  tags?: string[] | null;\n};\ntype QuickDuelCharacterAttackCardLookup = (id: string) => QuickDuelCharacterAttackLookupCard | null | undefined;\n\n'''
assert anchor in text and 'type QuickDuelCharacterAttackCardLookup' not in text
text = text.replace(anchor, insert + anchor, 1)

# Restrict the replacement to the attackDeclared host block so existing Combo
# host APIs keep their stricter card contract.
block_start = text.index('type QuickDuelCharacterAttackLookupCard')
block_end = text.index('export type QuickDuelPlaytestEquipResult<Match>', block_start)
block = text[block_start:block_end]
block = block.replace('ComboHostCardLookup', 'QuickDuelCharacterAttackCardLookup')
block = block.replace('const isKata = (candidate: ComboRuntimeCard | null | undefined)', 'const isKata = (candidate: ReturnType<QuickDuelCharacterAttackCardLookup>)')
block = block.replace('const isWeapon = (candidate: ComboRuntimeCard | null | undefined)', 'const isWeapon = (candidate: ReturnType<QuickDuelCharacterAttackCardLookup>)')
assert 'ComboHostCardLookup' not in block, 'attackDeclared block still depends on ComboHostCardLookup'
text = text[:block_start] + block + text[block_end:]
path.write_text(text)
