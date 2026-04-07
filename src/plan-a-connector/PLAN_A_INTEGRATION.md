# Plan A: Lobe Shell, Nexu Core — Integration Guide

## Concept

Inject the Nexu/OpenClaw runtime directly into LobeChat as a **builtin tool plugin** (type: 'builtin'). This gives LobeChat's beautiful UI real-world execution capabilities — 30+ Nexu skills, shell commands, file operations, scheduling, and cross-platform messaging.

**This is not a simulation — based on LobeChat's actual `packages/builtin-tool-local-system` source code.**

## Real Architecture (from source analysis)

```
LobeChat UI (React)
    ↓ Tool call (invoke)
BiochatExecutor extends BaseExecutor
    ↓ HTTP (curl to localhost:3141)
OpenClaw Runtime (Nexu Agent)
    ↓
Shell / File System / 30+ Skills / Feishu API / ...
```

## Based on Real LobeChat Source

| File | Purpose |
|---|---|
| `packages/types/src/tool/builtin.ts` | Real `BaseExecutor`, `BuiltinToolManifest`, `BuiltinToolContext` types |
| `packages/builtin-tool-local-system/src/manifest.ts` | Real `BuiltinToolManifest` declaration pattern |
| `packages/builtin-tool-local-system/src/executor/index.ts` | Real `BaseExecutor` subclass pattern |
| `packages/builtin-tool-local-system/src/types.ts` | Real `LocalSystemApiEnum` pattern |

## Package Structure

```
src/plan-a-connector/
├── manifest.ts           # BuiltinToolManifest (all 11 APIs)
├── BiochatConnector.ts   # HTTP bridge to OpenClaw gateway
├── executor/
│   ├── index.ts          # Executor exports
│   └── BiochatExecutor.ts # extends BaseExecutor<typeof BiochatApiEnum>
└── index.ts              # Package entry point
```

## Implemented APIs (11 total)

| API | Description | Intervention |
|---|---|---|
| `invokeNexuSkill` | Call any Nexu skill by name | default |
| `shell` | Execute shell command | **always required** |
| `readFile` | Read local file | dynamic: pathScopeAudit |
| `writeFile` | Write local file | dynamic: pathScopeAudit |
| `listFiles` | List directory | dynamic: pathScopeAudit |
| `deleteFile` | Delete file/directory | dynamic: pathScopeAudit |
| `searchFiles` | Search files by keywords | dynamic: pathScopeAudit |
| `grepContent` | Regex search in files | dynamic: pathScopeAudit |
| `runBackground` | Run command in background | **always required** |
| `getOutput` | Get background output | default |
| `killProcess` | Kill background process | default |

## How to Register in LobeChat

1. Start Biochat connector server:
   ```bash
   npx ts-node src/plan-a-connector/server.ts
   # Runs on http://localhost:18790
   ```

2. In LobeChat Settings → Plugins → Add Local Plugin:
   ```
   URL: http://localhost:18790/manifest.json
   ```

3. LobeChat will fetch `manifest.ts`, discover all 11 APIs, and register them.

## How It Works (from BaseExecutor source)

```typescript
// BaseExecutor.invoke() from @lobechat/types:
async invoke(apiName: string, params: any, ctx: BuiltinToolContext) {
  const method = this[apiName];  // e.g. this.shell
  return method(params, ctx);     // calls BiochatExecutor.shell()
}
```

Each method in `BiochatExecutor` routes to the corresponding OpenClaw API.

## Next Steps

- [x] Manifest with 11 APIs (matches real LobeChat schema)
- [x] BiochatExecutor extending real BaseExecutor pattern
- [ ] Implement pathScopeAudit dynamic resolver for scope security
- [ ] Write server.ts to serve manifest.json over HTTP for LobeChat discovery
- [ ] Electron: use IPC instead of HTTP for local subprocess communication
- [ ] Test: validate all 11 APIs respond correctly through LobeChat UI

## License

MIT — Biochat Project, Biochat-Labs
