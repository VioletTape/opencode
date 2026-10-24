# Token Efficiency & Context Optimizations for OpenCode

## Existing Baseline in `packages/core`

OpenCode already includes several token-efficiency primitives:

- **Prompt-cache-first prefix ordering** (`packages/core/src/session/context.ts`, `packages/core/src/session/instruction-state.ts`): Initial instructions are frozen at the epoch baseline (`InstructionState.initial`) and ordered from most to least shared across sessions (`CodeModeInstructions`, `mcp`, `references`, `skills`, `discovery`, `builtins`, `entries`). Subsequent instruction or catalog changes are emitted as incremental chronological deltas (`SessionEvent.InstructionsUpdated`) rather than mutating the system prompt and invalidating the KV cache.
- **CodeMode schema compression** (`packages/core/src/codemode/catalog.ts`, `packages/core/src/tool.ts`): Non-direct tools (MCP and plugins) are placed behind a single `execute` tool with a 2,000-token inline signature budget (`INLINE_BUDGET`) and on-demand `search(...)`, avoiding multi-thousand-token JSON Schema definitions in the tool array.
- **Disk-offloaded tool truncation** (`packages/core/src/tool-output.ts`): Caps individual tool outputs at `MAX_LINES = 2_000` and `MAX_BYTES = 50 * 1024` (50 KiB), writing the full payload to `~/.local/share/opencode/tool-output/tool_*` with a 7-day retention policy.
- **Cache-reusing compaction & background precompute** (`packages/core/src/session/compaction.ts`): Appends the summarization prompt to the exact existing conversation prefix so the compaction call reuses the provider's prompt cache, with optional background precomputation (`PRECOMPUTE_RATIO = 0.85`).
- **Stepped image eviction** (`boundImages` in `packages/core/src/session/model-request.ts`): Drops oldest inline images from `IMAGE_BYTES_TRIGGER` (25 MiB) down to `IMAGE_BYTES_TARGET` (15 MiB) in stepped batches so the prompt prefix only shifts at watermark crossings rather than on every request.

---

## Candidate Optimizations

### 1. Stepped Aging / Pruning of Historical Tool Outputs (`boundToolOutputs`)

- **Problem:** Between compactions (which trigger at 85% of the context window, e.g., ~170k tokens on a 200k model), every `read`, `grep`, and `shell` result up to 50 KiB (~12.5k tokens each) remains verbatim in active history (`packages/core/src/session/runner/to-llm-message.ts`). Cached input tokens still incur 10–25% of base input cost on every step, and any cache miss (e.g., 5-minute TTL expiry while the user reads or thinks) re-bills the entire 150k+ prefix at full price.
- **Proposal:** Apply the same stepped hysteresis pattern used by `boundImages` (`packages/core/src/session/model-request.ts`) to historical text `tool-result` parts:
  - Protect the most recent $K$ exchanges (or last ~20k tokens of tool results) verbatim.
  - Track total bytes/tokens of older `tool-result` payloads.
  - When older tool outputs exceed a high watermark (e.g., 160 KiB / ~40k tokens), spill any unsaved payloads via `ToolOutput.save` and replace the oldest tool results down to a low watermark (e.g., 80 KiB / ~20k tokens) with a compact pointer:
    `[Tool output (842 lines) aged out of active context; full output at <path> or re-read if needed]`
  - Stepping between high and low watermarks preserves the prompt cache prefix across all steps between cuts.
- **Upstream survival / touchpoints:** Can be implemented entirely inside a fork-owned `session.context` plugin hook (`hooks.trigger("session", "context", ...)`) or as a small pass alongside `boundImages` in `packages/core/src/session/model-request.ts`.

### 2. Deduplicating Superseded `read` Results in History

- **Problem:** During iterative editing, an agent frequently reads a file, edits it, and reads the same file or line range again. Earlier `read` tool results remain in history even though their contents are stale and superseded by a later read.
- **Proposal:** When running the stepped tool-output pruning pass (or in a `session.context` hook), detect earlier `read` calls whose `{ path, offset, limit }` range is covered by a later successful `read` call in the same session, and collapse the older `tool-result` first:
  `[Superseded by later read of <path> in this session]`
- **Upstream survival / touchpoints:** Zero core changes if combined with the `session.context` hook above.

### 3. Leaner `read` Tool Formatting & Default Page Size

- **Problem:**
  1. `ReadTool.toModelContent` (`packages/core/src/tool/plugin/read.ts`) prefixes every single line with `${start + index}: ${line}`. In LLM tokenizers, `<line_number>: ` adds 2–3 tokens per line (4,000–6,000 tokens of line-number overhead per 2,000-line read), even though OpenCode's `edit` tool matches exact strings (`oldString` / `newString`) rather than line numbers.
  2. `MAX_READ_LINES = 2_000` and `MAX_READ_BYTES = 50 * 1024` (`packages/core/src/tool/read-filesystem.ts`) are used as the default when the model omits `limit`. Exploratory file reads without an explicit `limit` dump up to 2,000 lines into context at once.
- **Proposal:**
  - Lower the default `limit` when omitted (e.g., `800` lines / `32 KiB`) while still allowing explicit `limit` up to `MAX_READ_LINES` when requested.
  - Either omit per-line number prefixes by default (relying on the header `Read file <path>, lines <start>-<end>`), or emit sparse line markers (e.g., every 25–50 lines) unless requested.
- **Upstream survival / touchpoints:** Small constant and formatting adjustment in `packages/core/src/tool/read-filesystem.ts` and `packages/core/src/tool/plugin/read.ts` (or post-processed in a `tool.execute.after` hook for `read`).

### 4. `rtk` Shell Output Compression & Head+Tail Truncation

- **Problem:**
  1. `ToolOutput.truncate` (`packages/core/src/tool-output.ts`) performs **head-only** truncation (`lines.slice(0, limits.maxLines)`). Test suites, compilers, and build tools print passing progress at the top and failure summaries/stack traces at the bottom. Head-only truncation hides the actual error and forces the agent to spend extra turns reading the tail of the saved `tool_*` file.
  2. Raw CLI outputs (`git`, `bun test`, `tsc`, `cargo`) contain repetitive boilerplate and progress noise.
- **Proposal:**
  1. **Head + Tail truncation in `ToolOutput.truncate`:** Keep the first ~60% and last ~40% of the line/byte budget with a middle omission marker (`[... lines X-Y omitted; full output saved to <file> ...]`), matching the `clip()` helper in `packages/core/src/session/compaction.ts`.
  2. **`rtk` integration via plugin hook:** Use a fork-owned `tool.execute.before` hook for the `shell` tool to route supported CLI commands through `rtk` when available on the host, cutting 60–90% of noisy CLI output before truncation even runs.
- **Upstream survival / touchpoints:** `rtk` wrapping requires zero upstream changes via `tool.execute.before`; head+tail truncation is a ~15-line localized change in `packages/core/src/tool-output.ts`.

### 5. Multi-Hop Prompt-Cache Affinity & Compaction Precompute Defaults

- **Problem:**
  1. `SessionAffinity.get` (`packages/core/src/session/affinity.ts`) only resolves one hop (`session.parentID ?? session.fork?.sessionID ?? session.id`), as noted by the `TODO` in `packages/core/src/session/model-request.ts:287`. Nested subagents or subagents spawned inside a forked session compute a different `promptCacheKey` / `x-session-affinity` than the root session, losing provider cache routing for the shared system and instruction prefix.
  2. `SessionCompaction` defaults `precompute` to `false` (`packages/core/src/session/compaction.ts:255`). When `precompute` is off, compaction waits until the context crosses the ceiling, or worse, runs after a user pause when the provider's 5-minute ephemeral prompt cache has expired.
  3. If a separate `compaction` agent model is configured (`selectModel` in `packages/core/src/session/compaction.ts:264`), switching models for the compaction call forfeits the primary model's warm prompt cache across the entire conversation prefix.
- **Proposal:**
  - Persist root affinity / cache lineage on `SessionSchema.Info` (or resolve to the root session) so nested forks and subagents share the root `promptCacheKey`.
  - Enable `compaction.precompute: true` by default when the compaction model matches the session model.
- **Upstream survival / touchpoints:** 1-line setting default in `packages/core/src/session/compaction.ts` (or user config); small helper update in `packages/core/src/session/affinity.ts`.

---

## Summary Matrix

| Optimization | Expected Token Savings | Upstream Conflict Risk | Preferred Mechanism |
| :--- | :--- | :--- | :--- |
| **1. Stepped tool-output aging (`boundToolOutputs`)** | **30–50%** steady-state context reduction on long sessions | Low | Fork `session.context` hook or `model-request.ts` |
| **2. Superseded `read` deduplication** | **10–20%** on iterative edit/read loops | Low | Fork `session.context` hook |
| **3. `read` default limit (`800` lines) & line-prefix cleanup** | **15–25%** per file read | Low | `tool.execute.after` hook or `read.ts` / `read-filesystem.ts` |
| **4. `rtk` shell rewrite + Head/Tail truncation** | **40–80%** on shell outputs + fewer recovery turns | Low | Fork `tool.execute.before` hook + `tool-output.ts` |
| **5. Root cache affinity + `precompute: true`** | Higher cache hit rate on subagents & compaction | Very Low | Config / `compaction.ts` + `affinity.ts` |
