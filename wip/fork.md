# Personal OpenCode V2 fork

## Context and goals

- The user uses **OpenCode V2 in the browser**, not the terminal UI.
- They want to customize the UI for their own tasks and reduce reliance on additional tooling.
- Given the volume of upstream issues and merge requests, they consider a personal fork more practical than waiting for official changes.
- No implementation has been requested or started; this conversation explored options and maintenance considerations.

## Initial customization: project-coloured session tabs

Desired behaviour:

- Assign colours randomly to projects.
- All sessions belonging to the same project share a colour.
- Prefer persisting the project-to-colour mapping so colours remain stable across restarts.
- Use project identity rather than the session's current directory, so related subdirectories and worktrees can share a colour.

A deterministic hash into a palette was discussed as an alternative: it gives random-looking, stable colours without storage, but different projects can receive the same colour.

A coloured dot or small accent could preserve existing session-status colours and active-tab indicators better than recolouring the whole tab.

The assistant initially assumed terminal tabs; the user corrected this to the browser UI. The terminal-specific configuration and plugin discussion does not apply to the requested browser customization.

Browser implementation options discussed:

- **Userscript or browser extension:** potentially quick, but dependent on available project metadata and potentially fragile DOM selectors.
- **Web-app source modification:** a cleaner candidate for a personal fork, with colour assignment kept separate from tab rendering.

The documentation consulted did not describe a browser tab-colour setting or browser UI plugin API. The source implementation was not inspected, so the assessment that this is likely a small frontend feature remains provisional.

## Model awareness of the client environment

The user also wants models to know the OpenCode version and interface they are using, allowing more appropriate visual-tool defaults.

In this session:

- The model's instructions explicitly identified the harness as OpenCode.
- They did not explicitly identify the client as browser, terminal, or desktop.
- Available tools and skills indicate what the model can do; using the browser does not itself grant visualization or browser-control capabilities.

A proposed fork improvement is to provide accurate context such as:

```text
Harness: OpenCode
Version: <actual build version>
Client: web
Rendering capabilities: <capabilities actually supported>
```

Design considerations:

- Associate client context with the originating request rather than permanently labeling a session: a shared session may be accessed from different clients.
- Distinguish the user-facing browser from the machine where tools execute.
- Report actual rendering/tool capabilities rather than assuming capabilities from client type.
- Verify existing implementation behaviour before adding a new mechanism; no source inspection confirmed whether related metadata already exists elsewhere.

Explicit guidance in global `AGENTS.md` was discussed as a workaround if the user normally uses the browser, but per-request metadata would better support mixed-client usage.

## Fork strategy and maintenance

The assistant recommended a lightly modified fork or small patch series on an otherwise unmodified upstream base.

Suggested practices:

- Keep one commit per customization.
- Isolate custom logic in separate modules with minimal connections to upstream code.
- Avoid unrelated formatting changes and dependency changes.
- Update from upstream regularly.
- Add focused tests: a conflict-free merge does not guarantee correct behaviour.
- Verify that the custom build actually serves the modified web assets.

Important caveat: small, non-fundamental changes can still conflict with upstream work, particularly in frequently changing tab-rendering and prompt-assembly code. Budget for occasional adaptation, not just merging.

## Direction and open questions

The user has additional UI ideas intended to replace external tools in their workflow, but has not yet described those tools or requirements.

Suggested next step: choose one frequent annoyance and implement the smallest improvement that removes it. Prefer supported plugin extension points where applicable; use fork changes for browser UI functionality that requires source access.

## Documentation consulted

- [OpenCode V2 introduction](https://opencode.ai/v2/docs/)
- [Browser access and serving](https://opencode.ai/v2/docs/cli/web/)
- [Instructions and AGENTS.md](https://opencode.ai/v2/docs/instructions/)
- [Plugin overview](https://opencode.ai/v2/docs/build/plugins/)
- [CLI plugin API — terminal only](https://opencode.ai/v2/docs/build/plugins/cli)
- [CLI settings — terminal only](https://opencode.ai/v2/docs/cli/config)
