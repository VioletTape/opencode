# 001 — Project-coloured session tabs

- **Status:** Completed, user-accepted
- **Date:** 2026-10-23
- **Origin:** Explicit user request; intentional personal-fork customization, not upstream behavior.
- **Implementation commit:** `dc441cf1f0`
- **Acceptance:** On 2026-10-23, the user confirmed that coloured tabs work
  as intended and the feature is complete.

## Context

The user needs to recognize sessions from the same project at a glance in
the browser UI. A small colour dot was tried and rejected as too subtle.
Easy upstream merges and minimal manual repairs take priority over a small
initial patch.

## Decision

- Colour the full session-tab background, not just a dot or avatar.
- Key assignments by server scope and `session.projectID`, so related
  subdirectories and worktrees share a colour.
- Randomly select unused colours from the existing project-avatar palette,
  excluding gray; allow reuse after the eight colours are exhausted.
- Persist assignments in browser-local `fork.project-tab-colors.v1` storage
  using the existing persistence infrastructure, with cross-window sync.
- Preserve legacy `server.projectColors` assignments when the new key is
  absent. Hydrate the fork store before the server provider can discard the
  legacy field; an existing new store takes precedence.
- Keep readable light/dark backgrounds, an active-tab outline and heavier
  title, and existing status/unread indicators. Terminal UI is out of scope.

## Ownership and upstream adaptation

- Fork-owned implementation: `packages/app/src/fork/project-tab-colors.ts`
  and `packages/app/src/fork/project-tab-colors.css`.
- Upstream touchpoints: provider mounting in `packages/app/src/app.tsx`;
  hook and root class/style in `packages/app/src/shell/titlebar/tab-nav.tsx`.
- On upstream updates, check provider ordering, server-scope/project identity,
  tab selectors, `--tab-base`, and avatar/theme tokens. Keep assignment and
  styling out of upstream registries, shared schemas and base stylesheets.
- A clean merge is not proof of correctness; rerun acceptance checks.

## Acceptance tests

**Automated owner:** `packages/app/e2e/regression/tabs.spec.ts`.

- `session tab backgrounds keep project colours across subdirectories,
  worktrees and reloads`: seed a legacy orange assignment; verify a full
  coloured tab background, the exact preserved assignment, matching colours
  for the project's subdirectory/worktree sessions, a different colour for
  another project, and unchanged colours after reload.
- `inactive session attention dots share the close control without marking
  the avatar or active tab`: retain existing unread/status presentation.
- `tab strip keeps draft tabs as wide as session tabs and navigates on mouse
  down`: retain tab sizing and navigation behavior.

**Manual checks (not all covered by the keeper):** in light and dark themes,
verify readable titles and a distinguishable active tab; reopen the browser
with the same storage and verify stable colours; verify matching assignments
in another window and independent assignments for another server scope.

Run the focused keepers from `packages/app`:

```sh
PLAYWRIGHT_BUILD=1 bunx playwright test e2e/regression/tabs.spec.ts --project chromium --grep 'session tab backgrounds keep project colours|inactive session attention dots|tab strip keeps draft' --workers 1
```

Then run `bun run typecheck:tsc` from `packages/app` and `bun run check` from
the repository root. For session/tab implementation changes, also compare the
production tab-switch benchmark before and after, per the app instructions.
