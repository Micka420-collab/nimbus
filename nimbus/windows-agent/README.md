# Nimbus Windows Agent

Companion Windows node for this Nimbus / OpenClaw 2.0 fork. It pairs to a Gateway, exposes a visible push-to-talk path, and runs an **Astra-class** computer-use loop on the interactive desktop.

This is not a fork of the official WinUI [Windows Hub](https://github.com/openclaw/openclaw-windows-node). That app remains the upstream companion. This tree adds Nimbus branding, a visible HUD, voice PTT, and a dashboard download in *this* repo.

## What works today

| Surface | Behavior | Proof |
| --- | --- | --- |
| Pairing | Gateway URL + token, or OpenClaw `oc-pair://` / base64url setup code → `windows-agent.json`, then a real `connect` handshake | pairing + session tests |
| Node handshake | `role: node`, `computer.act`, `screen.snapshot`, `talk.ptt.*`, `talk.speak`. `screen.record` / camera omitted | protocol tests |
| Astra loop | Observe → decide → validate → execute → re-observe. HUD required. Escape / tray Stop aborts | computer-action tests |
| Structured actions | click / type / key / scroll / wait / screenshot / launch_app | parser + Windows planner |
| Constrained harness | Closed step list (not `eval`). Phrase compiler for « ouvre le Bloc-notes et écris hello » | harness tests |
| Approvals | send / delete / purchase / install / exec need confirm. record/camera default-deny. Exploit wording blocked | approval tests |
| Voice | Consent + PTT or explicit conversation. Mic indicator always visible. Missing STT/TTS keys fail closed | voice + speech tests |
| Download | GitHub `NimbusAgent-Setup-x64.exe`, or gateway-served `/nimbus-agent/NimbusAgent-Setup-x64.exe` | download tests + Control UI Apps page |

Linux can run the protocol tests. A real `.exe`, tray icon, screen capture, SendKeys, and microphone need a Windows machine.

## Get the installer

1. Control UI → **Apps** → **Download Windows Agent** (this fork).
2. Or the latest release asset:

`https://github.com/Micka420-collab/nimbus/releases/latest/download/NimbusAgent-Setup-x64.exe`

If that 404s, open the [releases page](https://github.com/Micka420-collab/nimbus/releases/latest) and take `NimbusAgent-Setup-x64.exe`.

Local / air-gapped: copy the CI artifact to the Gateway host as a Control UI public file at `/nimbus-agent/NimbusAgent-Setup-x64.exe`. The dashboard prefers that path when present.

## Build

```bash
# Protocol tests (Linux or Windows)
node --test nimbus/windows-agent/test/*.test.js
node nimbus/windows-agent/cli.mjs pair parse --url wss://127.0.0.1:18789 --token test
node nimbus/windows-agent/cli.mjs phrase --text "ouvre le Bloc-notes et écris hello"

# Windows packager (windows-latest or a Windows PC)
cd nimbus/windows-agent
npm install
npm run dist
# dist/NimbusAgent-Setup-x64.exe
```

GitHub Actions workflow: `.github/workflows/nimbus-windows-agent.yml`. Tag `nimbus-agent-v*` or run the workflow to upload the asset.

## Pair

1. Install the `.exe` (per-user, no admin).
2. Enter Gateway URL (`ws://` / `wss://` / `http://` / `https://`) and token **or** paste an `oc-pair://` setup code from Control UI → Devices.
3. Approve the node on the Gateway (`openclaw devices approve` / Devices page).
4. Tray turns to **Nimbus — connecté** only after `hello-ok`. A rejected or closed socket shows **hors ligne** — never a fake green tray.

Default-denied: `screen.record`, `camera.snap`, `camera.clip`. Computer control is foreground-only.

## Voice

Astra’s public model card is text+image. **Do not treat this as Astra audio.**

Nimbus voice is a separate path that talks to the same agent:

1. Click **Autoriser l'écoute** (OS mic prompt still applies).
2. Hold **Maintenir pour parler**, or start a conversation explicitly.
3. STT → Gateway `chat.send` → TTS. This is a Nimbus path, not Astra audio.

Set `OPENAI_API_KEY` (or `NIMBUS_STT_URL` / `NIMBUS_TTS_URL`). Missing keys return a French error. No background wake word.

A node-only pairing token can invoke `computer.act` but may not have `chat.send`. If PTT fails with a permission error, pair with an operator token or speak through Control UI.

## Computer use (Astra-class behavior)

Design target: GPT-6 Astra-style *behavior* on a self-hosted Gateway — observe the screen, keep the task brief visible, confirm high-impact steps, execute structured actions or a constrained harness, then re-observe. No OpenAI IP, no exploit tooling.

1. Enable computer control (default on after pairing).
2. Set a brief, e.g. `ouvre le Bloc-notes et écris hello`.
3. The red HUD **Nimbus contrôle le bureau** stays visible while Running or Waiting approval.
4. Escape or tray **Arrêter le contrôle** aborts before the next action.

Two decision shapes:

- Structured `computer.act` (click, type, key, scroll, drag, wait, screenshot, launch_app).
- Constrained harness programs (`launch`, `type`, `key`, `wait`, …). Not arbitrary Python/JS.

Foreground takeover, like the OpenAI Windows computer-use model: the cursor and keyboard of the interactive session move. There is no hidden background control.

## Optional vision model

Any vision/tool model the Gateway already knows can drive the loop. Operators who have access to GPT-6 Astra can point OpenClaw at it:

```json5
{
  agents: {
    defaults: {
      model: "openai/gpt-6-astra",
    },
  },
}
```

Use your real API key through the normal OpenClaw auth path (`OPENAI_API_KEY` or an auth profile). This overlay never stores keys. `node nimbus/windows-agent/cli.mjs model apply --config ~/.openclaw/openclaw.json --model openai/gpt-6-astra` writes the key only when no model is set (pass `--force` to replace).

Also expose the `computer` tool (`tools.alsoAllow: ["computer"]`) and approve the node’s `computer.act` pairing update.

## Limitations vs OpenAI Computer Use / Astra

- No official WinUI Hub feature parity (WSL easy-setup, Command Center, signed Authenticode).
- No CUA Driver SDK in this package; input is planned SendKeys / user32 on Windows.
- Phrase compiler covers documented journeys only. Broader work goes through the Gateway model + `computer.act`.
- Voice is STT/TTS, not a realtime Astra audio model.
- Multi-display, background delivery, browser CDP, and recording are intentionally absent.
- Installer CI produces an unsigned `.exe` unless you add your own cert.

## Safety

No stealth mic. No HUD-less desktop control. No keylogger. No vulnerability discovery or exploit helpers. Isolated to the paired operator machine.

## Astra alignment

| Pattern | In this tree |
| --- | --- |
| Observe → decide → validate → execute → re-observe | `computer-loop.js` |
| Structured `computer.act` + constrained harness (no eval) | `computer-actions.js`, `harness.js` |
| Intent / high-impact confirm (send, pay, delete, install) | `approvals.js` + Confirm button |
| Visible HUD + abort (Escape / tray) | Electron HUD, `loop.abort` |
| Voice separate from Astra audio | `voice.js` `astraAudio: false` |
| Default-deny record/camera; no exploit tooling | protocol + approvals |
| Dashboard download of `.exe` | Control UI Apps banner |
| Optional `openai/gpt-6-astra` | `applyVisionModel` + this README |
| Live `connect` / `hello-ok` / `node.invoke` | `session.js` (Linux-proven with a memory transport) |
| Signed installer + Windows smoke (mic, SendKeys, tray) | Not done here — needs a Windows machine |
