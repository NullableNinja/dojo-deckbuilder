# Quick Duel UI Recovery — 50 Implemented Improvements

Scope: restore a playable, non-overlapping Quick Duel interface without changing card effects or combat rules. The list below is both the audited recommendation set and the implementation ledger for this pass.

## Cascade and layout ownership

1. **Retire the late external hotfix link.** The HTML shell no longer loads a stylesheet after the Vite bundle, so source order is deterministic.
2. **Neutralize the legacy hotfix asset.** The old public file remains inert so a cached HTML shell cannot restore viewport-fixed gameplay panels during deployment.
3. **Bundle one final recovery layer.** `playtest-functional-recovery.css` loads last from the application entry point.
4. **Establish one live-shell geometry contract.** The recovery layer owns the HUD, arena, action bar, hand, and utility order.
5. **Return the game to document flow.** The page grows naturally instead of pretending every surface fits in one fixed-height canvas.
6. **Prevent page-wide horizontal overflow.** The shell and hosting frame clip stray inline overflow while local rails retain their own scrolling.
7. **Replace extreme gameplay z-indexes with a small scale.** Ordinary panels use normal stacking; only sticky HUD, VFX, dialogs, and results rise above them.
8. **Remove the post-render DOM mutation patcher.** Combo and fighter presentation now render declaratively through React.

## HUD and fighter boards

9. **Add a semantic player HUD summary.** The top bar now contains the player's name and Belt rather than a CSS pseudo-label.
10. **Add a semantic opponent HUD summary.** The opponent receives the same stable, readable treatment.
11. **Show exact HP in both HUD summaries.** Current and maximum HP remain readable without hunting through the board.
12. **Add proportional HUD health bars.** Each bar is a real progress indicator with accessible numeric values.
13. **Make the HUD sticky without removing it from flow.** It stays useful while scrolling and still reserves its own space.
14. **Return fighter HP tracks to their cards.** Fighter-card progress bars are no longer stolen and fixed against the viewport.
15. **Protect fighter headings from clipping.** Long fighter names truncate inside their own heading instead of crossing the Belt badge.
16. **Contain fighter art inside the illustration window.** Transparent character art scales by `object-fit` and cannot spill into adjacent panels.
17. **Give long abilities an internal scroll area.** Rules copy remains available without changing fighter-card height.
18. **Keep the Loadout launcher inside the fighter card.** Equipment access gets a dedicated bottom-row target and no hover panel can cover combat.
19. **Make the Combo launcher a native React button.** It is keyboard reachable, exposes the learned count, and opens the existing docket directly.

## Arena, Scene, and combat record

20. **Stabilize the three-column combat table.** Player, stage, and opponent use bounded columns with one shared height.
21. **Use an adaptive but bounded arena height.** Fighter boards and the combat stage align without pushing into acquisition controls.
22. **Remove accidental fighter-column scroll ownership.** Columns no longer create hidden independent page scroll traps.
23. **Guard the center stage against min-content overflow.** Long card and Scene text cannot widen the whole page.
24. **Return the acquisition rail to normal flow.** It no longer floats over the hand at the bottom-right of the viewport.
25. **Restore a full-width persistent acquisition rail.** Market, Combo, and Belt remain neighboring board objects below the arena.
26. **Keep all seven Market slots reachable.** The row has its own bounded horizontal scroll when the viewport is narrow.
27. **Keep both Combo and Belt dockets visible.** Neither station is collapsed behind an unrelated panel.
28. **Increase acquisition controls to usable targets.** Rail and docket actions have a minimum 40-pixel hit area.
29. **Rename the active label to “Current Scene.”** The board now uses the player's preferred, more vivid vocabulary.
30. **Enlarge the active Scene name.** It now reads as a major state element rather than a muted subheading.
31. **Place the Scene rule on a contrasting paper slip.** The active modifier is readable at a glance.
32. **Give each Scene family a themed edge accent.** Cool, concrete, civic, retail, and dojo locations gain distinct restrained color cues.
33. **Reserve the center viewport lane for Scene Change.** Its cue now appears in one deterministic position regardless of scroll.
34. **Bound the clash grid.** Declaration, seal, and response cards cannot expand beyond the combat stage.
35. **Fit stage card artwork within its slots.** Card visuals crop or contain without covering labels or the combat seal.
36. **Keep all three combat zones readable.** The zone row retains a consistent minimum height.
37. **Strengthen the active-zone contrast.** The hot zone now has a clear red-and-gold selected state.
38. **Make both filed-card ledgers independently scrollable.** Long turn histories stay in one row and never widen the stage.
39. **Bound the impact receipt.** Large exchange notes scroll inside the receipt instead of covering the next surface.
40. **Make selected hand cards unmistakable.** A stronger gold ring and offset red shadow identify the pending choice.

## Actions, hand, utilities, dialogs, and VFX

41. **Move the primary action dock before the hand in DOM order.** Visual order, reading order, and keyboard order now agree.
42. **Return the primary action dock to normal flow.** It can no longer cover playable cards at any scroll position.
43. **Set primary action targets to at least 44 pixels tall.** Phase progression remains comfortable to click and tap.
44. **Allow action groups to wrap.** Long phase labels and multiple legal actions remain reachable at narrower widths.
45. **Return the hand and its counters to normal flow.** The hand header wraps and never sits beneath acquisition or command panels.
46. **Give the hand a visible, snap-assisted horizontal rail.** Every card remains reachable without shrinking text into illegibility.
47. **Return the utility bar to normal flow and allow wrapping.** Coach, log, motion, navigation, and sync controls cannot cover cards.
48. **Fit Ascend and inspectors to the viewport.** Dialogs own their scrolling, suppress horizontal spill, and retain reachable close/actions.
49. **Give player and opponent combat cues fixed viewport lanes.** Attack, Block, damage, Tempo, and summary notices no longer use scrolled element rectangles.
50. **Give milestone cues a fixed center lane and serialized replacement.** KO, Scene Change, Combo, and promotion stay centered while newer actions replace stale queued visuals.

## Audit baseline

- GitHub `main` audited at `6063d98e137fa6b6ed2f6398af24a76cd35bb83b`.
- Baseline repository gate: 227 tests passing before UI recovery.
- Live-browser audit covered setup, Initiate, Yell, attack declaration, block resolution, Ascend Market, nested inspection, Combo/Belt navigation, and the defense window.
- Primary failure: acquisition, action, utility, HUD, and fighter HP rules had accumulated contradictory fixed-position overrides across many late cascade layers.
- Card-effect implementation is intentionally outside this recovery scope.
