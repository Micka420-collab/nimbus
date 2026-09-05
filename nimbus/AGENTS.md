# Nimbus overlay

Optional local-first layer. Do not import OpenClaw `src/**` or other plugins from here.

- User-facing copy: French. Code and comments: English.
- Never add stealth listening, keyloggers, or unauthorized-access tools.
- Secrets stay out of memory files and git. Refuse, do not redact-and-keep.
- Tests: `node --test nimbus/test/*.test.js nimbus/windows-agent/test/*.test.js` (no pnpm, no Vitest).
- Ship only behavior that writes real local state. No demo HUDs, stub feeders, or fake STT/TTS.
- Voice, calendar, and Docker twin stay out of `nimbus/src` until they have a real integration and an honest failure path. The Windows agent in `nimbus/windows-agent/` is that integration: visible mic, visible desktop HUD, keys fail closed.
- Do not add this package to the OpenClaw `pnpm-workspace.yaml` unless an owner explicitly asks.
