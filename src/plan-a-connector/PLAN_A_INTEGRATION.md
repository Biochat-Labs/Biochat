# Plan A Integration — LobeChat + Nexu/OpenClaw

## Overview

Plan A ("Lobe Shell, Nexu Core") injects the OpenClaw execution runtime into LobeChat's frontend via a custom bridge plugin called **BiochatConnector**.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   LobeChat Frontend                      │
│  (Beautiful chat UI, plugin ecosystem, LLM integration)│
└─────────────────────────┬───────────────────────────────┘
                          │ ToolManifest + BuiltinToolExecutor
                          ▼
┌─────────────────────────────────────────────────────────┐
│           BiochatConnector (this package)               │
│  - ToolManifest (12 APIs exposed to LLM)               │
│  - BuiltinToolExecutor (routes to OpenClaw gateway)    │
│  - Gateway HTTP client (localhost:3141)                 │
└─────────────────────────┬───────────────────────────────┘
                          │ POST /exec, /file/read, etc.
                          ▼
┌─────────────────────────────────────────────────────────┐
│           OpenClaw Gateway (localhost)                  │
│  - Shell execution (zsh/bash)                          │
│  - File operations (read/write/edit/list/search)        │
│  - Skill system (SKILL.md + scripts/references)        │
│  - Tool runtime (exec, browser, calendar, etc.)        │
└─────────────────────────────────────────────────────────┘
```

## Fusion Points

### 1. Plugin Registration
`BiochatConnectorManifest` is a standard `BuiltinToolManifest` (from `@lobechat/types`), registered alongside LobeChat's built-in tools (`lobe-local-system`, etc.).

```typescript
// In Biochat's app initialization:
import { BiochatConnectorManifest, biochatConnectorExecutor } from '@biochat/plan-a-connector';
registerBuiltinTool(BiochatConnectorManifest, biochatConnectorExecutor);
```

### 2. Tool Manifest Compatibility
`BiochatConnectorManifest` follows LobeChat's `BuiltinToolManifest` schema exactly:
- `identifier`: `biochat-plan-a-connector`
- `meta`: avatar, title, description, readme, tags
- `api[]`: 12 `LobeChatPluginApi` entries (shell, file ops, search)
- `systemRole`: Custom prompt instructing the LLM how to use the bridge
- `type`: `'builtin'` (same as `lobe-local-system`)

### 3. API Surface (12 APIs)
| API | Description | Human Intervention |
|-----|-------------|-------------------|
| `biochatExecShell` | Run shell command | `required` (always) |
| `biochatReadFile` | Read file content | `pathScopeAudit` |
| `biochatWriteFile` | Write file | `pathScopeAudit` |
| `biochatEditFile` | Edit file (string replace) | `pathScopeAudit` |
| `biochatListDir` | List directory | `pathScopeAudit` |
| `biochatSearchFiles` | Search files by name | `pathScopeAudit` |
| `biochatGrepContent` | Grep regex in files | `pathScopeAudit` |
| `biochatGlobFiles` | Glob pattern match | `pathScopeAudit` |
| `biochatMoveFile` | Move/rename file | `pathScopeAudit` |
| `biochatRenameFile` | Rename in-place | `pathScopeAudit` |
| `biochatGetBackgroundOutput` | Poll background shell | none |
| `biochatKillProcess` | Kill background shell | none |

### 4. OpenClaw Gateway Protocol
All APIs communicate via HTTP POST to the OpenClaw gateway:
- `POST /exec` — shell command
- `POST /exec/:id/output` — poll background output
- `POST /exec/:id/kill` — kill background process
- `POST /file/read`, `/file/write`, `/file/edit`, `/file/list`, `/file/search`, `/file/grep`, `/file/glob`, `/file/move`

Gateway URL is configurable via `BIOCHAT_GATEWAY_URL` or `OPENCLAW_GATEWAY_URL` env var (default: `http://localhost:3141`).

### 5. Nexu Skill Integration (via OpenClaw)
The `skill-creator` SKILL.md in Nexu defines skills as:
```
skill-name/
├── SKILL.md         (YAML frontmatter + markdown body)
├── scripts/         (executable code)
├── references/      (documentation)
└── assets/         (templates, images)
```
The OpenClaw gateway resolves and executes skills. BiochatConnector's `biochatExecShell` can invoke skill scripts directly, or future versions can add a dedicated `biochatInvokeSkill` API.

## Key Differences from `lobe-local-system`

| Aspect | `lobe-local-system` | `biochat-plan-a-connector` |
|--------|---------------------|---------------------------|
| Execution | Electron IPC → native binary | HTTP → OpenClaw gateway |
| Platform | Desktop only | Desktop + remote node |
| Skill system | None | Full Nexu skill runtime |
| Multi-agent | No | Yes (group orchestration) |
| Cross-platform | macOS/Linux only | Any platform with gateway |

## Next Steps (Next Commit)

1. **Implement OpenClaw gateway HTTP routes** — add `/exec`, `/file/*` endpoints to the OpenClaw gateway if not already present
2. **Write gateway integration tests** — verify the HTTP contract between BiochatConnector and the gateway
3. **Add `biochatInvokeSkill` API** — call Nexu skill scripts via the skill SDK
4. **Electron main-process bridge** — for desktop Biochat, replace HTTP with direct IPC to the embedded OpenClaw subprocess
5. **Path scope audit** — implement `pathScopeAudit` dynamic intervention resolver to restrict file ops to workspace root

## References

- LobeChat plugin manifest spec: `packages/types/src/tool/manifest.ts`
- LobeChat builtin tool executor base: `packages/types/src/tool/builtin.ts` (`BaseExecutor`)
- Nexu skill format: `skills/skill-creator/SKILL.md`
- Local system plugin reference: `packages/builtin-tool-local-system/`
