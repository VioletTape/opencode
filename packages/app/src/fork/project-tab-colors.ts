import { createSimpleContext } from "@opencode/ui/context"
import { PROJECT_AVATAR_VARIANTS } from "@opencode/ui/project-avatar"
import { Predicate, Schema } from "effect"
import { createEffect, type Accessor } from "solid-js"
import { Persist, persisted } from "@/runtime/persistence/storage"
import { Persistence } from "@/runtime/persistence/schema"
import { ServerConnection, useServers } from "@/runtime/server/registry"
import type { ServerScope } from "@/runtime/server/scope"
import "./project-tab-colors.css"

const ProjectTabColors = Persistence.record(Persistence.record(Schema.Literals(PROJECT_AVATAR_VARIANTS)))

const { use, provider } = createSimpleContext({
  name: "ProjectTabColors",
  gate: true,
  init: () => {
    const [colors, setColors, , ready] = persisted(
      {
        ...Persist.global("fork.project-tab-colors.v1"),
        sync: true,
        copyFrom: [
          {
            key: "server",
            // The destination schema validates the picked legacy map before it enters the store.
            pick: (value) => (Predicate.hasProperty(value, "projectColors") ? value.projectColors : undefined),
          },
        ],
      },
      ProjectTabColors,
      {},
    )

    return {
      ready,
      color(scope: ServerScope, projectID: string) {
        return colors[scope]?.[projectID]
      },
      assign(scope: ServerScope, projectID: string) {
        const scoped = colors[scope] ?? {}

        if (scoped[projectID]) return
        const palette = PROJECT_AVATAR_VARIANTS.filter((color) => color !== "gray")
        const available = palette.filter((color) => !Object.values(scoped).includes(color))
        const choices = available.length ? available : palette

        setColors((value) => ({
          ...value,
          [scope]: { ...scoped, [projectID]: choices[Math.floor(Math.random() * choices.length)]! },
        }))
      },
    }
  },
})

// Mount outside ServersProvider so legacy colours are copied before its schema drops the old field.
export const ProjectTabColorsProvider = provider

export function useProjectTabColor(server: Accessor<ServerConnection.Key>, projectID: Accessor<string | undefined>) {
  const colors = use()
  const servers = useServers()

  createEffect(() => {
    if (!servers.hydrated() || !colors.ready()) return
    const id = projectID()

    if (id) colors.assign(servers.scope(server()), id)
  })

  return () => {
    const id = projectID()

    return id ? colors.color(servers.scope(server()), id) : undefined
  }
}
