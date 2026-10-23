import { createMemo, Show } from "solid-js"
import { Icon } from "@opencode/ui/icon"
import { displayName } from "@opencode/ui/project-avatar"
import { useData } from "@/runtime/server/current"
import type { LocalProject } from "@/shell/state/layout"
import "./session-project-context.css"

export function SessionProjectContext(props: { project?: Omit<LocalProject, "expanded">; directory?: string }) {
  const data = useData()
  const name = createMemo(() => displayName(props.project ?? { worktree: props.directory ?? "" }))

  const branch = createMemo(() =>
    props.project?.vcs === "git" && props.directory
      ? data.location.vcs.info({ directory: props.directory })?.branch.current
      : undefined,
  )

  return (
    <Show when={name()}>
      <span class="fork-session-project-context">
        <bdi dir="auto" class="fork-session-project-name" title={props.directory}>
          {name()}
        </bdi>
        <Show when={branch()}>
          {(value) => (
            <span class="fork-session-project-branch" title={value()}>
              <Icon name="branch" class="shrink-0 text-v2-icon-icon-muted" />
              <bdi dir="ltr">{value()}</bdi>
            </span>
          )}
        </Show>
        <span class="fork-session-project-divider" aria-hidden="true" />
      </span>
    </Show>
  )
}
