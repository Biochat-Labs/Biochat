# Biochat

> **Biochat: AI with a Pulse.**
> The Ultimate Fusion of LobeChat UX & Nexu Execution Engine.

## What is Biochat?

Biochat combines the best of two worlds:

- **[LobeChat](https://github.com/lobehub/lobe-chat)**: Beautiful, intuitive UI with a rich plugin ecosystem.
- **[Nexu (OpenClaw)](https://github.com/nexu-ai/nexu)**: Powerful multi-protocol agent runtime with real-world execution capabilities (file management, scheduling, cross-platform messaging).

## Dual-Track Architecture

### Plan A: "Lobe Shell, Nexu Core"
Inject the OpenClaw runtime into LobeChat's frontend, giving it local execution power (shell commands, file operations, scheduled tasks) through a custom bridge.

### Plan B: "Nexu Platform, Lobe Modules"
Adapt LobeChat's plugin ecosystem (manifest-based) into Nexu's Skill format, enabling cross-platform agents (Feishu, Discord, Signal) to leverage Lobe's rich plugin library.

## Roadmap

- [x] Project initialization & GitHub org setup
- [ ] LobeChat source code audit & architecture analysis
- [ ] Nexu/OpenClaw runtime bridge development (Plan A)
- [ ] Lobe plugin → Nexu Skill adapter (Plan B)
- [ ] Biochat Desktop (Electron) build pipeline
- [ ] Public alpha release

## License

MIT
