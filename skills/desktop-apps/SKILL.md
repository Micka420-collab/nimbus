---
name: desktop-apps
description: "Drive a GUI application reliably: pick the cheapest control surface, keep focus, target elements over pixels, verify each step."
homepage: https://docs.openclaw.ai/nodes/computer-use
metadata: { "openclaw": { "emoji": "🖥️" } }
---

# Driving desktop applications

How to make an application do something, on any paired desktop, without turning it into a
guessing game.

## Pick the highest rung that works

Each step down this ladder costs reliability. Start at the top, and say which rung you
used when you report back.

1. **The app's own CLI or HTTP API.** Deterministic, scriptable, no screen needed.
2. **The OS automation bridge.** `osascript` on macOS, PowerShell or COM on Windows,
   DBus or `xdotool` on Linux. Still deterministic, no pixels.
3. **Element and menu targeting** through the computer tool: `list_windows`,
   `invoke_menu`, `set_value`, `get_accessibility_tree`. Names, not coordinates.
4. **Raw coordinates.** Only when nothing above exists.

Most "automate this app" requests are solved on rung 1 or 2 by someone who bothered to
check. Check first.

## Focus before input

Typing into an unfocused window is the single most common silent failure: the keystrokes
land somewhere else, and the screenshot looks almost right.

1. `launch_app` or `bring_to_front` the target.
2. Screenshot, and confirm the window is actually frontmost.
3. Only then type or click.

After any dialog, notification, or app switch, focus is no longer yours. Re-confirm it.

## References go stale

Window, element, page, and dialog references belong to one execution and one provider
generation. Navigation invalidates element observations; a reconnect or driver restart
invalidates all of them. On a stale-reference refusal, re-observe and rebuild the
reference — never retry the old one, and never cache one across steps.

## Wait on a state, not a clock

After an action, re-observe until the expected element exists. Use short `wait` steps
between observations rather than one long sleep — a fixed sleep is either too short on a
slow machine or wasted time on a fast one.

If three consecutive observations show no progress, stop. Report what you see and what
you expected. Escalating to faster, blinder clicking is how automation corrupts data.

## Text entry

- Prefer `set_value` on a field over typing into it.
- When you must type, verify the field content afterwards. Fields that reformat as you
  type — dates, currency, phone numbers, anything with an input mask — rarely contain
  what you typed.
- Never type a password, a recovery code, or a 2FA code. That is the user's job, always.

## Dialogs are decisions, not obstacles

Read a dialog before dismissing it. Never auto-accept a licence agreement, a permission
prompt, a security warning, an update-now prompt, a "send diagnostics" question, or a
cookie banner that consents to tracking. Those are the user's calls; surface them and
wait.

## Confirm before the irreversible

Save As over an existing file, Delete, Empty Trash, Send, Publish, Submit, Pay, Sign,
Reset, Restore Defaults: name the exact file, recipient, or amount, get a human yes, then
act. "The user asked me to handle the invoice" is not consent to press Pay.

## Report in app terms

Close with what you did as application-level steps — "opened the March invoice, changed
the due date to the 15th, saved" — plus what you verified on screen. A list of clicks and
coordinates tells the user nothing about whether the work is correct.
