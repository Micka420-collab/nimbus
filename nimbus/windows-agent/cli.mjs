#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  applyVisionModel,
  compileDesktopPhrase,
  githubLatestDownloadUrl,
  loadAgentConfig,
  parseComputerAction,
  parsePairingInput,
  savePairingConfig,
  speechReadiness,
} from "./src/index.js";
import { readFileSync } from "node:fs";

const DEFAULT_STATE = join(homedir(), ".nimbus");

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positional.push(token);
    }
  }
  return { command: positional[0] ?? "help", positional: positional.slice(1), flags };
}

function stateDir(flags) {
  const dir = resolve(flags.state ?? process.env.NIMBUS_STATE_DIR ?? DEFAULT_STATE);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function print(value) {
  process.stdout.write(`${typeof value === "string" ? value : JSON.stringify(value, null, 2)}\n`);
}

function help() {
  print(`Nimbus Windows Agent — nœud bureau (fork OpenClaw)

Usage:
  node nimbus/windows-agent/cli.mjs <commande> [options]

  pair parse --url <gateway> --token <jeton>
  pair parse --setup-code <oc-pair|base64url>
  pair save  --url <gateway> --token <jeton> [--state <dir>]
  pair show  [--state <dir>]
  action parse --json '{"action":"type","text":"hello"}'
  phrase --text "ouvre le Bloc-notes et écris hello"
  speech check
  download-url
  model apply --config <openclaw.json> --model openai/<id> [--force]

La voix n'est pas de l'audio Astra. STT/TTS échoue sans OPENAI_API_KEY
(ou NIMBUS_STT_URL / NIMBUS_TTS_URL). Conversation continue : démarrage explicite.
Le contrôle bureau exige un HUD visible. Échap pour arrêter.
Modèle optionnel : openai/gpt-6-astra via \`model apply\`.
`);
}

function main() {
  const { command, positional, flags } = parseArgs(process.argv);
  if (command === "help" || command === "-h" || command === "--help") {
    help();
    return;
  }

  if (command === "pair") {
    const sub = positional[0];
    const input = {
      gatewayUrl: flags.url,
      token: flags.token,
      setupCode: flags["setup-code"],
    };
    if (sub === "save") {
      print(savePairingConfig(stateDir(flags), input));
      return;
    }
    if (sub === "show") {
      print(loadAgentConfig(stateDir(flags)));
      return;
    }
    print(parsePairingInput(input));
    return;
  }

  if (command === "action") {
    print(parseComputerAction(flags.json ?? positional[0]));
    return;
  }

  if (command === "phrase") {
    print(compileDesktopPhrase(flags.text ?? positional.join(" ")));
    return;
  }

  if (command === "speech") {
    print(speechReadiness(process.env));
    return;
  }

  if (command === "download-url") {
    print({ ok: true, href: githubLatestDownloadUrl() });
    return;
  }

  if (command === "model") {
    if (positional[0] !== "apply" || !flags.config || !flags.model) {
      print({ ok: false, code: "usage", message: "model apply --config <file> --model openai/<id>" });
      process.exitCode = 1;
      return;
    }
    const raw = JSON.parse(readFileSync(flags.config, "utf8"));
    print(applyVisionModel(raw, flags.model, { force: Boolean(flags.force) }));
    return;
  }

  print({ ok: false, code: "unknown_command", message: command });
  process.exitCode = 1;
}

main();
