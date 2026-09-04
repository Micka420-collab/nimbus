#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  authorize,
  createColony,
  createMemory,
  createParkDesk,
  createVoiceSession,
  describePermissionModes,
  installNimbusProfile,
  readNimbusProfile,
} from "../src/index.js";

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
  const command = positional[0] ?? "help";
  return { command, positional: positional.slice(1), flags };
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
  print(`Nimbus — couche locale optionnelle (fork OpenClaw 2.0)

Usage:
  node nimbus/cli/nimbus.mjs <commande> [options]

Commandes:
  help
  profile show
  profile install --workspace <dir> [--force]
  memory learn --key <k> --value <v> [--kind preference|correction|fact]
  memory forget --id <id> | --key <k>
  memory list [--query <q>]
  colony worker --id <id> [--role lead|worker]
  colony task --title <titre>
  colony assign --task <id> --worker <id>
  colony step --task <id> --action <famille> --summary <texte>
  colony decide --step <id> --verdict approve|reject
  colony run --step <id>
  colony ledger
  park start --title <titre>
  park park --session <id> [--reason <texte>]
  park resume --session <id>
  park action --session <id> --type <type> [--tokens-in N] [--tokens-out N]
  park timeline [--session <id>]
  park cost [--session <id>]
  voice demo          (machine d'états, aucun micro)
  permissions modes
  permissions check --action <famille> [--mode deny] [--approved]

Le micro n'est jamais activé par cette CLI. Voir nimbus/docs/voix-consentement.md.
`);
}

function main() {
  const { command, positional, flags } = parseArgs(process.argv);
  const root = stateDir(flags);
  const sub = positional[0];

  if (command === "help" || command === "-h" || command === "--help") {
    help();
    return;
  }

  if (command === "profile") {
    if (sub === "install") {
      print(installNimbusProfile(flags.workspace, { force: Boolean(flags.force) }));
      return;
    }
    print(readNimbusProfile());
    return;
  }

  if (command === "memory") {
    const memory = createMemory(root);
    if (sub === "learn") {
      print(memory.learn({ key: flags.key, value: flags.value, kind: flags.kind }));
      return;
    }
    if (sub === "forget") {
      print(memory.forget({ id: flags.id, key: flags.key, query: flags.query }));
      return;
    }
    print(memory.recall({ query: flags.query }));
    return;
  }

  if (command === "colony") {
    const colony = createColony(root, { permissionMode: flags.mode ?? "deny" });
    if (sub === "worker") {
      print(colony.addWorker({ id: flags.id, role: flags.role, skills: flags.skills?.split(",") }));
      return;
    }
    if (sub === "task") {
      print(colony.createTask({ title: flags.title, assignee: flags.assignee }));
      return;
    }
    if (sub === "assign") {
      print(colony.assignTask(flags.task, flags.worker));
      return;
    }
    if (sub === "step") {
      print(colony.proposeStep({ taskId: flags.task, action: flags.action, summary: flags.summary }));
      return;
    }
    if (sub === "decide") {
      print(colony.decideStep(flags.step, flags.verdict, "human"));
      return;
    }
    if (sub === "run") {
      print(colony.runStep(flags.step));
      return;
    }
    print(colony.ledger());
    return;
  }

  if (command === "park") {
    const desk = createParkDesk(root);
    if (sub === "start") {
      print(desk.start({ title: flags.title }));
      return;
    }
    if (sub === "park") {
      print(desk.park(flags.session, flags.reason ?? ""));
      return;
    }
    if (sub === "resume") {
      print(desk.resume(flags.session));
      return;
    }
    if (sub === "action") {
      print(
        desk.recordAction(flags.session, {
          type: flags.type,
          detail: flags.detail,
          tokensIn: Number(flags["tokens-in"]) || 0,
          tokensOut: Number(flags["tokens-out"]) || 0,
        }),
      );
      return;
    }
    if (sub === "cost") {
      print(desk.cost(flags.session));
      return;
    }
    print(desk.timeline(flags.session));
    return;
  }

  if (command === "voice") {
    const voice = createVoiceSession();
    if (sub === "demo") {
      voice.grantConsent();
      voice.startListening();
      voice.hearFinal("Bonjour Nimbus");
      voice.agentReady("Oui ?");
      print(voice.snapshot());
      return;
    }
    print(voice.snapshot());
    return;
  }

  if (command === "permissions") {
    if (sub === "check") {
      print(
        authorize({
          action: flags.action,
          mode: flags.mode ?? "deny",
          approved: Boolean(flags.approved),
          consentGranted: Boolean(flags.consent),
          allowlist: flags.allowlist ? String(flags.allowlist).split(",") : [],
        }),
      );
      return;
    }
    print(describePermissionModes());
    return;
  }

  help();
  process.exitCode = 1;
}

main();
