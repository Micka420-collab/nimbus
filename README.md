# Nimbus

Personal local overlay on a working copy of [OpenClaw 2.0](https://github.com/openclaw/openclaw) (`v2026.8.1`). This is not a rewrite of the OpenClaw runtime. The extra layer lives in [`nimbus/`](nimbus/) and writes its own files under `~/.nimbus` (or `NIMBUS_STATE_DIR`).

## What works today

These commands change real files on disk. Tests: `node --test nimbus/test/*.test.js`.

| Surface | What it does | State |
| --- | --- | --- |
| Memory | `learn` / `forget` / `list` with zones (`perso`, `collegue`, `tech`) and TTL (`weekend` or hours). Secrets are refused, not stored. | `~/.nimbus/memory.json` |
| Colony | Workers, tasks, steps. High-risk actions (`exec`, `network`, `send`, …) stay `needs_approval` until a human decides. | `~/.nimbus/colony-ledger.json` |
| Trust | Approval/reject scores. Can ready **medium** colony steps after enough samples. Never auto-runs high-risk work in deny. | `~/.nimbus/trust.json` |
| Offline queue | Local queue with a manual `offline on\|off` flag. Reconnect returns delivered items plus pending approvals. | `~/.nimbus/continuum.json` |
| Permissions | Default-deny overlay. `permissions apply` merges `tools.exec.mode` into an OpenClaw config (keeps an existing mode unless `--force`). | target `openclaw.json` |
| Profile | Copies `SOUL.md`, `IDENTITY.md`, `USER.md`, `AGENTS.md`, `MEMORY.md` into a workspace. Does not overwrite without `--force`. | workspace files |
| Park | Pause/resume sessions, action timeline, rough token cost. | `~/.nimbus/park.json` |

```bash
node nimbus/cli/nimbus.mjs --state /tmp/nimbus-demo memory learn --key ville --value Paris
node nimbus/cli/nimbus.mjs --state /tmp/nimbus-demo memory list
node nimbus/cli/nimbus.mjs profile install --workspace ~/.openclaw/workspace
node nimbus/cli/nimbus.mjs permissions apply --config ~/.openclaw/openclaw.json
```

## Not ready

No live speech, calendar, or Docker integration. Those paths were removed rather than shipped as demo UIs. OpenClaw’s own speech/calendar plugins can still be configured from upstream docs; this overlay does not pretend they are wired.

## Run OpenClaw (this fork)

Same path as upstream. Node 22.22.3+; `pnpm` is the package manager.

```bash
pnpm install
pnpm build
pnpm ui:build
pnpm openclaw onboard --install-daemon
pnpm openclaw gateway status
```

Install, channels, models, and gateway: https://docs.openclaw.ai

This personal fork does not run the full OpenClaw GitHub Actions suite (org runners, GitHub App, CodeQL). The check that belongs here is [`.github/workflows/nimbus.yml`](.github/workflows/nimbus.yml).

## License

MIT, including the OpenClaw 2.0 sources. See `LICENSE` and `THIRD_PARTY_NOTICES.md`.
Upstream tag: [openclaw/openclaw@v2026.8.1](https://github.com/openclaw/openclaw/releases/tag/v2026.8.1).
Nimbus notes: [CHANGELOG-NIMBUS.md](CHANGELOG-NIMBUS.md).
