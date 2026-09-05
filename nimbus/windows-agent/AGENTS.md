# Nimbus Windows Agent

Standalone desktop node. Do not import OpenClaw `src/**`.

- User-facing copy: French. Code and comments: English.
- No stealth mic, hidden desktop control, keyloggers, or exploit tooling.
- Computer use requires a visible HUD. Voice requires a visible mic indicator.
- Tests: `node --test nimbus/windows-agent/test/*.test.js` (no pnpm, no Vitest).
- Electron is Windows packaging only. Linux CI runs the protocol tests without Electron.
