# Plan B: Nexu Platform, Lobe Modules — Integration Guide

## Concept

Adapt LobeChat's rich plugin ecosystem into Nexu's Skill system, enabling cross-platform Nexu agents (Feishu, Discord, Signal) to leverage Lobe's 500+ plugins.

## Architecture

```
LobeChat Plugin (manifest.json)
         ↓
LobePluginAdapter.ts  ← converts manifest → Nexu SKILL.md
         ↓
Nexu Skill (~/.nexu/skills/lobe-*)
         ↓
Nexu Runtime (any channel: Feishu/Discord/Signal)
```

## Implemented Adapters (Phase 1)

| Adapter | Source | Description |
|---|---|---|
| `ArxivAdapter.ts` | arxiv.org | Academic paper search via arXiv API |
| `SearchEngineAdapter.ts` | Brave/DuckDuckGo | Web search, no API key required |
| `FileToolAdapter.ts` | Local filesystem | File read/write/list/delete/glob with scope audit |

## Core: LobePluginAdapter.ts

**Input:** `manifest.json` from any LobeChat plugin
**Output:** Nexu-compatible `SKILL.md` + `references/gateway.md` + `scripts/call-gateway.sh`

### Conversion Rules

| LobeChat Field | Nexu Skill Field |
|---|---|
| `manifest.name` | `name: lobe-{name}` |
| `manifest.description` | `description` (first sentence) |
| `manifest.tags` | `description` triggers |
| `manifest.functions` | `SKILL.md` body + `scripts/call-gateway.sh` |
| `manifest.gateway` | `references/gateway.md` + bridge script target |

## Nexu Skill Metadata Format

Each converted skill follows the Nexu SKILL.md format:

```yaml
---
name: lobe-{plugin-name}
description: Nexu Skill adapter for LobeChat plugin "{name}".
  Provides access to: {description}.
  Use when: user asks to {functions}.
  Triggers: "plugin execution", "gateway call", {tags}.
---
```

## Next Steps

- [ ] Deploy LobePluginAdapter as a Nexu Skill
- [ ] Register adapters in `~/.nexu/skills/`
- [ ] Test by calling "search arxiv for transformer papers" from Feishu
- [ ] Validate gateway responses render correctly in chat
- [ ] Add more plugins: image-generation, calendar, office-doc tools

## License

MIT — Biochat Project, Biochat-Labs
