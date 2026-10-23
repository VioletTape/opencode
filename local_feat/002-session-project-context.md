# 002 — Visible session project and branch

- **Status:** Completed, user-accepted
- **Date:** 2026-10-23
- **Origin:** Explicit user request; intentional personal-fork web UI customization.
- **Acceptance:** On 2026-10-23, the user checked the UI and confirmed it works
  as intended.

## Context

Tab-hover details are insufficient when working across several projects. The
active session's project and branch need to remain visible in the existing
session header without adding another row.

## Decision

- Keep the existing project menu icon, then show project display name and branch
  before session title/agent information, separated by a subtle divider.
- Resolve the project from the session and the branch from its actual Location,
  including subdirectories and worktrees. React to existing branch updates.
- Use muted semantic theme tokens, bounded widths and ellipsis. Hover reveals
  the full session directory and branch. Isolate names and LTR paths for RTL.
- Omit branch information for non-Git projects or unavailable branch data.
- Preserve existing menus, title editing, usage indicators and layout controls.
- Reuse current client data: no additional requests, persistence, server fields,
  or shared-state schema changes. TUI and new-session drafts are out of scope.

## Ownership and upstream adaptation

- Fork-owned implementation: `packages/app/src/fork/session-project-context.tsx`
  and `packages/app/src/fork/session-project-context.css`.
- Upstream integration: append the component beside the existing menu inside
  `SessionProjectMenu` in `packages/app/src/session/session-identity-header.tsx`.
  Both loading and mounted timeline headers already use that menu.
- After upstream updates, check menu reuse, session project resolution,
  Location-scoped VCS data, header flex sizing and theme tokens.
- Test harness support: VCS responses honor the requested directory and may
  provide different branches per directory.

## Acceptance tests

Automated owner: `packages/app/e2e/regression/tabs.spec.ts`, case
`session header keeps the active project's name and worktree branch visible`.
It covers display names, subdirectories, worktree branches, live branch updates,
switching projects, non-Git branch omission and switching back.
It also checks full hover values and keeps the title and review control visible
at a narrow desktop width with forced RTL direction.

Manual checks: long names at narrow and wide widths, light/dark themes, hover
details, RTL layout, and preservation of header controls and title editing.

Run the keeper in production-build mode, app type checks and root
`bun run check`. Compare production tab-switch benchmarks before and after.

Validation artifacts stay in ignored `packages/app/e2e/performance/results/`:
`project-context-before` and `project-context-after`. Three serial repetitions
per scenario completed after the change (15/15); the baseline had one unrelated
initial-title setup failure (14/15). The small sample showed no consistent
slowdown; it is a smoke comparison, not a statistically conclusive benchmark.

The focused project-context, tab-colour and tab-sizing keepers pass in built
mode. The new keeper also passes 10/10 repetitions with five workers, full
parallelism and no retries. App `typecheck:tsc` and root `bun run check` pass
(existing lint warnings remain). The separate e2e type-check reports errors in unchanged benchmark,
composer, review and timeline-stream files; none in this feature's files.
