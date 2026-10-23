# 003 — Ctrl+Enter composer newline

- **Status:** Completed, user-accepted
- **Date:** 2026-10-23
- **Origin:** Explicit user request; intentional personal-fork web UI customization.
- **Acceptance:** The user verified Ctrl+Enter works in the web UI on 2026-10-23.

## Decision and acceptance criteria

- Ctrl+Enter inserts a line break at the selection in the message composer,
  without submitting a prompt or accepting a suggestion.
- Plain Enter still submits; Shift+Enter retains its existing newline behavior.
- Leave IME composition alone. Native browser editing preserves selection,
  input events and undo rather than replacing the whole draft.
- Move alternate queue/steer delivery to Mod+Alt+Enter and update the toolbar
  and follow-up settings hints. The alternate toolbar button remains available.
- Applies to the shared web/desktop composer, including new-session drafts;
  TUI bindings and question/elicitation form shortcuts are unchanged.
- No new settings, persistence, dependencies or server contracts.

## Ownership and upstream adaptation

Fork-owned shortcut handling and hint definition live in
`packages/app/src/fork/composer-newline.ts`. The integration runs first in
`ComposerEditor`'s keydown handler, ahead of upstream suggestion and submit
handling. Composer and general settings consume the alternate hint definition.
After upstream updates, check keydown ordering, browser editing operations and
alternate-delivery handling/hints.

## Validation

The composer keeper in `packages/app/e2e/regression/composer.spec.ts` protects
caret insertion, literal newline with suggestions open, Shift+Enter and exact
multiline submission. Existing tests covered paste and submission, but not
Ctrl+Enter; restoring the original submit-first handler must fail this keeper.
The queue keeper retains alternate-delivery coverage using its new shortcut;
the new-session keeper retains disabled-submit coverage.

Run these keepers in built mode, repeat the changed cases with five workers
and no retries, then run app type checks and root `bun run check`.

The original keydown handler failed the new keeper by submitting the draft.
After the fix, all 63 composer, queue and new-session keepers passed in built
mode without retries. App `typecheck:tsc` and root `bun run check` passed.
The separate e2e type check reports existing errors in unchanged benchmark,
provider-catalog, review and timeline-stream code; none in the new case.
The newline keeper (including selection replacement) and alternate-delivery
keeper each passed 10/10 repetitions with five workers, full parallelism and
no retries (20/20 total).
