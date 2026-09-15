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

# 2) attackDeclared facts only need the Character card shape. Use that narrower
#    lookup contract so the shared runtime catalog (whose name is optional) is a
#    valid default without unsafe casting to the stricter Combo card shape.
path = Path('app/quick-duel-playtest-host.ts')
text = path.read_text()
anchor = 'function quickDuelCharacterAttackDeclaredEvent<Board extends CharacterRuntimeBoard>('
insert = 'type QuickDuelCharacterAttackCardLookup = (id: string) => NonNullable<CharacterRuntimeEvent["card"]> | null | undefined;\n\n'
assert anchor in text and 'type QuickDuelCharacterAttackCardLookup' not in text
text = text.replace(anchor, insert + anchor, 1)
old = '  lookup: ComboHostCardLookup,\n): CharacterRuntimeEvent {'
new = '  lookup: QuickDuelCharacterAttackCardLookup,\n): CharacterRuntimeEvent {'
assert old in text
text = text.replace(old, new, 1)
assert text.count('lookup: ComboHostCardLookup = runtimeCardFor') >= 2
text = text.replace('lookup: ComboHostCardLookup = runtimeCardFor', 'lookup: QuickDuelCharacterAttackCardLookup = runtimeCardFor', 2)
text = text.replace('const isKata = (candidate: ComboRuntimeCard | null | undefined)', 'const isKata = (candidate: ReturnType<QuickDuelCharacterAttackCardLookup>)', 1)
text = text.replace('const isWeapon = (candidate: ComboRuntimeCard | null | undefined)', 'const isWeapon = (candidate: ReturnType<QuickDuelCharacterAttackCardLookup>)', 1)
path.write_text(text)
