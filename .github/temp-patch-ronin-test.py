from pathlib import Path

p = Path('tests/character-runtime-enforcement.test.mjs')
text = p.read_text()
old = '''test("029 Ronin Reroll: replacement reveal is once per game", () => {\n  const first = run("DDB-CHR-CORE-029", { type: "sceneChange", replacementId: "scene-2", optionalAccepted: true });\n  assert.equal(first.event.selectedId, "scene-2");\n  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "sceneChange", replacementId: "scene-3", optionalAccepted: true }, "ai");\n  assert.equal(second.event.selectedId ?? null, null);\n});'''
new = '''test("029 Ronin Reroll: public reveal requests one hidden-safe replacement per game", () => {\n  const first = run("DDB-CHR-CORE-029", {\n    type: "reveal",\n    card: { id: "scene-1" },\n    revealSource: "location",\n    replacementAvailable: true,\n    optionalAccepted: true,\n  });\n  assert.equal(first.event.replacementRequested, true);\n  assert.equal(first.event.replacementId, undefined);\n  assert.equal(first.event.selectedId, undefined);\n  const second = applyCharacterRuntimeEvent(first.self, first.opponent, {\n    type: "reveal",\n    card: { id: "scene-2" },\n    revealSource: "location",\n    replacementAvailable: true,\n    optionalAccepted: true,\n  }, "ai");\n  assert.equal(second.event.replacementRequested, undefined);\n});'''
if old in text:
    text = text.replace(old, new, 1)
else:
    assert 'public reveal requests one hidden-safe replacement per game' in text
p.write_text(text)
