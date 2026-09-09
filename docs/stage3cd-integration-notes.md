# Stage 3C/3D Final Integration

This branch ports certified structured runtime behavior forward from the Stage 3C/3D donor branches while preserving the current `main` Playtest host.

## Architectural constraints

- Canonical card/rule data remains machine-readable JSON and generated runtime data.
- `app/playtest.tsx` is a host/orchestration surface, not a card-specific rules database.
- Character and Location behavior is executed through structured runtime modules.
- Stage 3C/3D certification runs against committed source only.
- CI must not patch, materialize, commit, or push source changes.
- One-shot installer/materializer scripts and self-modifying workflows are donor scaffolding only and must not enter the final integration branch.

## Donor policy

Reusable:
- structured resolver semantics
- reusable runtime modules
- generic lifecycle/choice/state handling
- certification tests that validate canonical behavior

Rework or reject:
- wholesale donor `playtest.tsx` replacement
- card-ID/name special cases in the Playtest host
- workflows that mutate source
- scripts whose purpose is to install runtime code by textual patching

## Final gates

1. generated data has no drift
2. Character runtime certification passes
3. Location runtime certification passes
4. Character/Location composition certification passes
5. TypeScript compile passes
6. full repository tests pass
7. production build passes
8. working tree remains unchanged after certification
