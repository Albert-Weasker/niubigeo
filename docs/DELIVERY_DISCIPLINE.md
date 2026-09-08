# Delivery Discipline

This document is the mandatory delivery contract for every NiubiGEO change.
It applies to product work, architecture work, tests, data migrations, UI work,
and real Provider validation.

## Non-Negotiable Constraints

- No regular-expression literals or `RegExp` constructors in first-party code,
  tests, scripts, or generated first-party browser code.
- No logic specialized for a monitored brand, domain, alias, language, question
  text, test case, industry, or product scenario.
- Frozen acceptance samples cannot be changed during a test round.
- Code cannot be changed during a test round. A failed round must finish and
  retain its evidence before any correction begins.
- Test data stays outside product data unless the acceptance case explicitly
  requires testing the product store. Such data must be identified and removed
  or retained deliberately.
- A partial result is never reported as complete. An unsupported capability is
  never reported as passed. A mock check is never reported as a real Provider
  or browser validation.

## Acceptance Gates

1. Freeze requirements, cases, expected evidence, and cost budget before work.
2. Implement only the current phase boundary. Do not claim later-phase behavior.
3. Run the frozen automated checks without code or case changes.
4. Run browser operations against the actual local application when a browser
   connection is available. Record the steps, result, persistent data state, and
   screenshot path. If no connection exists, mark browser validation as
   unverified and state why.
5. Verify persistence by reading the actual project store after the operation.
6. Verify failure behavior whenever a requirement includes a failure path.
7. For real Provider work: one-case validation, then three frozen smoke cases,
   then the frozen twenty-case regression. Stop at a failed gate. Do not launch
   the next gate, automatically retry in bulk, modify code, or modify samples
   until the failed round is fully recorded.

## Required Final Report

Every final report must contain only these six sections, in this order:

1. **Actual changes**: each changed file, prior behavior, new behavior, and the
   requirement number. Explicitly say `Not changed` for requested items that
   were not changed.
2. **What the user can now do**: ordinary user operations only. Do not replace
   this with implementation vocabulary.
3. **Acceptance evidence**: command, result, browser steps, resulting persistent
   state, screenshot path, and acceptance criterion for every claimed function.
   Without browser evidence, do not claim the function is usable. Without a
   persistence read, do not claim data is saved. Without a failure-path test, do
   not claim error handling.
4. **Unfinished and known issues**: every missing function, compatibility layer,
   skipped or failed test, unverified behavior, and dependency on old
   architecture. State missing work directly.
5. **Data and cost**: external APIs, call count by category, actual cost or why
   it cannot be known, data created or deleted, and whether test data reached
   the real product store.
6. **Git state**: `git status --short`, changed files, pre-existing user changes,
   and whether a commit was made. Never commit without an explicit request.

## Disallowed Reporting

Do not use these expressions unless they are immediately followed by the
required verifiable evidence: `completed`, `fixed`, `complete support`,
`fully resolved`, `production ready`, `full refactor`, `architecture is
correct`, `tests passed`, `user experience improved`, `strict isolation`,
`backward compatible`, or `stable and reliable`.

Do not infer user-visible behavior from source code. Use exactly one of these
statuses for every direct acceptance question:

- `Verified`: evidence attached.
- `Verification failed`: failure behavior attached.
- `Not verified`: reason attached.

## Fixed Review Questions

When asked for status, answer these questions individually with one of the
three statuses above:

1. Can two separate projects be created?
2. Does a new project survive a refresh?
3. Does a deleted project remain absent after refresh?
4. What does creating the same normalized domain return?
5. Can project A data appear in project B?
6. Does every selected model have a distinct ModelRun and report?
7. How many tests failed, and which ones?
8. Which requirements are not implemented?
9. How many external API calls and what cost occurred?
10. Which conclusions come only from source reading rather than browser evidence?
