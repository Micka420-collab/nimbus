# Nimbus Windows Agent

Companion **node** for this Nimbus / OpenClaw 2.0 fork. It pairs to a Gateway, exposes a visible push-to-talk path, and runs an Astra-class computer-use loop on the interactive desktop.

This is not a fork of the official WinUI [Windows Hub](https://github.com/openclaw/openclaw-windows-node). That app remains the upstream companion. This tree is an in-repo Electron node: Nimbus branding, a visible HUD, voice PTT, and a dashboard download.

**Do not claim Astra audio.** The public GPT-6 Astra model card is text+image. Voice here is a separate Nimbus STT → `chat.send` → TTS path that talks to the same computer-use agent.

## Architecture

```
GitHub latest /nimbus-agent/*.exe
        │
        ▼
NimbusAgent-Setup-x64.exe  ──pair──►  Gateway (connect / hello-ok / node.invoke)
        │                                      │
        ├── voice.js state machine             ├── chat.send (operator token)
        ├── speech-transport (OpenAI-compatible STT/TTS)
        └── computer-loop (observe → validate → execute → re-observe)
                    │
                    ├── structured computer.act
                    ├── constrained harness (no eval)
                    ├── Playwright goto when installed
                    └── Windows SendKeys / user32 (win32 only)
```

| Module | Owner |
| --- | --- |
| `src/pairing.js` | `oc-pair://`, URL + token |
| `src/session.js` | `connect` / `hello-ok` / `node.invoke` + reconnect |
| `src/voice.js` | `idle \| muted \| listening \| thinking \| speaking` |
| `src/voice-pipeline.js` | STT → chat → TTS + barge-in |
| `src/computer-loop.js` | screenshot hash, stale-UI retry, approvals |
| `src/planner.js` | closed FR/EN phrases; Gateway JSON plan |
| `src/trust-gate.js` | overlay trust scores gate medium `computer.act` |
| `app/main.js` | Electron tray, HUD, hotkeys, IPC |

Core stays plugin-agnostic. This overlay does not import OpenClaw `src/**`.

## Threat model

- **Trusted:** the operator sitting at the paired machine, and the Gateway they chose.
- **Untrusted:** model text, remote `computer.act` payloads, STT transcripts, harness JSON.
- **Visible consent:** mic is off until a visible consent click. No wake word. Pill always shows phase.
- **Visible control:** desktop actions require the HUD **Nimbus contrôle le bureau**. Escape / tray **Arrêter** abort.
- **Default-deny:** `screen.record`, camera, exploit-marker strings. High-impact send/pay/delete/install need a human confirm.
- **No secrets in git or overlay state.** `OPENAI_API_KEY` stays in the process environment.
- **Fail closed:** missing speech keys, missing Playwright, stale UI after one retry, rejected pairing tokens (no reconnect loop).
- **Not in scope:** keyloggers, stealth capture, vulnerability discovery, unsigned-trust bypass.

The installer CI produces an **unsigned** NSIS `.exe`. Windows SmartScreen / Mark-of-the-Web will warn until you add your own Authenticode cert. That is expected, not a green tray fake.

## How to run

### Tests (Linux or Windows)

```bash
node --test nimbus/windows-agent/test/*.test.js
node --test nimbus/test/*.test.js nimbus/windows-agent/test/*.test.js
node nimbus/windows-agent/cli.mjs phrase --text "ouvre le Bloc-notes et écris hello"
node nimbus/windows-agent/cli.mjs speech check
```

### Voice providers

| Variable | Role |
| --- | --- |
| `OPENAI_API_KEY` or `NIMBUS_OPENAI_API_KEY` | Bearer for OpenAI-compatible STT/TTS |
| `OPENAI_BASE_URL` or `NIMBUS_OPENAI_BASE_URL` | Default `https://api.openai.com/v1` |
| `NIMBUS_STT_URL` / `NIMBUS_TTS_URL` | Full URL overrides |
| `NIMBUS_STT_MODEL` / `NIMBUS_TTS_MODEL` / `NIMBUS_TTS_VOICE` | Model / voice ids |
| `NIMBUS_LIVE_SPEECH=1` | Optional live smoke (`scripts/speech-live.mjs`) |

Missing keys return a French error. Tests mock HTTP. Live smoke is off unless the flag is set.

A **node-only** pairing token may invoke `computer.act` but not `chat.send`. PTT then fails in French and tells you to re-pair with an operator token.

### Computer use

1. Pair. Tray is **connecté** only after `hello-ok`.
2. Set a brief, e.g. `ouvre le Bloc-notes et écris hello`.
3. HUD stays up while running or waiting approval.
4. Escape or tray **Arrêter** / **Refuser** / **Confirmer**.

Unknown briefs fail closed locally (`needsModel`) and, when a Gateway session exists, ask the model for a JSON step list. Operators who have GPT-6 Astra can point OpenClaw at it:

```json5
{
  agents: {
    defaults: {
      model: "openai/gpt-6-astra",
    },
  },
}
```

`node nimbus/windows-agent/cli.mjs model apply --config <openclaw.json> --model openai/gpt-6-astra` writes the key only when no model is set (`--force` to replace). This overlay never stores API keys.

Optional Playwright: `cd nimbus/windows-agent && npm i playwright`. `goto` / `navigate` then drive a real browser. Missing Playwright returns `playwright_missing` — not a fake navigation.

### Installer

1. `https://github.com/Micka420-collab/nimbus/releases/latest/download/NimbusAgent-Setup-x64.exe`
2. Local / air-gapped: put the CI artifact on the Gateway host at `/nimbus-agent/NimbusAgent-Setup-x64.exe`.

```bash
cd nimbus/windows-agent
npm install
npm run dist
# dist/NimbusAgent-Setup-x64.exe
```

Workflow: `.github/workflows/nimbus-windows-agent.yml` (`windows-latest` NSIS). Tag `nimbus-agent-v*` to attach the asset.

## What is verified where

| Surface | Linux (`node --test`) | Needs Windows smoke |
| --- | --- | --- |
| Pairing parse / persist | yes | — |
| `connect` / `hello-ok` / invoke (memory transport) | yes | live Gateway |
| Reconnect + rejected token | yes | live drop |
| Voice state machine, barge-in, fail-closed | yes | real mic + OS prompt |
| STT/TTS HTTP adapters | mocked | `NIMBUS_LIVE_SPEECH=1` |
| Phrase planner + harness (no eval) | yes | — |
| Loop hash / stale-UI / abort / approvals | yes | SendKeys + HUD |
| Trust gate on `computer.act` | yes | — |
| Playwright `goto` | injected driver / missing | installed Chromium |
| Tray, global hotkey, screen capture | not run | required |
| NSIS `.exe` | not built here | `windows-latest` CI |
| SmartScreen / signed Authenticode | — | operator cert |

## Astra alignment (behavior, not IP)

| Pattern | In this tree |
| --- | --- |
| Observe → decide → validate → execute → re-observe | `computer-loop.js` |
| Screenshot hash + one stale-UI retry | `observation.js` |
| Structured `computer.act` + constrained harness (no eval) | `computer-actions.js`, `harness.js` |
| High-impact confirm (send, pay, delete, install) | `approvals.js` + tray / HUD |
| Visible HUD + Escape abort | Electron HUD |
| Voice separate from Astra audio | `voice.js` `astraAudio: false` |
| Overlay trust scores | `trust-gate.js` + `nimbus/src/trust.js` |
| Optional `openai/gpt-6-astra` | `applyVisionModel` |

## Safety

No stealth mic. No HUD-less desktop control. No keylogger. No exploit helpers. Isolated to the paired operator machine.
