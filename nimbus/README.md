# Nimbus overlay

Optional local layer on this OpenClaw 2.0 fork. Node ≥ 22, zero extra dependencies. It does not replace `openclaw`, the gateway, or bundled plugins.

```bash
node nimbus/cli/nimbus.mjs help
node --test nimbus/test/*.test.js
```

State directory: `--state <dir>` or `NIMBUS_STATE_DIR` (default `~/.nimbus`).

## What works

| Command family | Behavior |
| --- | --- |
| `profile install --workspace <dir>` | Copies the French persona files. Skips existing files unless `--force`. |
| `memory learn\|list\|forget` | Local JSON memory with zones and TTL. Secret-shaped values are refused unless `--force`. |
| `colony …` | Ledger + human approval for high-risk steps. Trust can ready medium steps only. |
| `trust show` | Per-action approval scores from colony decisions. |
| `offline on\|off\|enqueue\|reconnect\|decide` | Local queue. Online/offline is a flag, not a network probe. |
| `permissions apply --config <file>` | Merges `tools.exec.mode` (default `deny`) into an OpenClaw config. Existing mode is kept unless `--force`. Rewriting an existing file writes `<file>.bak-YYYYMMDDTHHMMSS` first. |
| `park …` | Session park/resume, timeline, rough cost. |
| Windows Agent | Pair as a Gateway node, PTT voice, Astra-class computer use with a HUD. | [windows-agent/README.md](windows-agent/README.md) |

Details: [docs/memoire.md](docs/memoire.md), [docs/colonie.md](docs/colonie.md), [docs/permissions.md](docs/permissions.md).

## Windows companion

Download from Control UI → Apps → **Download Windows Agent**, or build `NimbusAgent-Setup-x64.exe` with the `nimbus-windows-agent` workflow. Voice is a Nimbus PTT path (not Astra audio). Desktop control is foreground-only and always shows **Nimbus contrôle le bureau**.

```bash
node --test nimbus/windows-agent/test/*.test.js
node nimbus/windows-agent/cli.mjs phrase --text "ouvre le Bloc-notes et écris hello"
```

## Not ready

Calendar anticipation, Docker/homelab twin, autogen skills, and debate rooms are **not implemented** in `nimbus/src`. There is no demo voice HUD in the overlay CLI.

## OpenClaw host

```bash
pnpm install && pnpm build && pnpm ui:build
```

See the repo root README and https://docs.openclaw.ai

## Attribution

OpenClaw is MIT, © OpenClaw Foundation. Kept in `LICENSE` and `THIRD_PARTY_NOTICES.md`.
