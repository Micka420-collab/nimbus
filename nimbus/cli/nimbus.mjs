#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  applyToOpenClawConfig,
  authorize,
  createNimbus,
  describePermissionModes,
  installNimbusProfile,
  readNimbusProfile,
} from "../src/index.js";

const DEFAULT_STATE = join(homedir(), ".nimbus");
const DEFAULT_OPENCLAW_CONFIG = join(homedir(), ".openclaw", "openclaw.json");

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
  print(`Nimbus — couche locale (fork OpenClaw 2.0)

Usage:
  node nimbus/cli/nimbus.mjs <commande> [options]

Profil / mémoire
  profile show | install --workspace <dir> [--force]
  memory learn --key <k> --value <v> [--kind preference|correction|fact] [--zone perso|collegue|tech] [--ttl weekend|<heures>]
  memory forget --id <id> | --key <k> | --zone <z> | --weekend
  memory list [--query <q>] [--zone <z>]

Colonie
  colony worker --id <id> [--role lead|worker]
  colony task --title <titre>
  colony assign --task <id> --worker <id>
  colony step --task <id> --action <famille> --summary <texte>
  colony decide --step <id> --verdict approve|reject
  colony run --step <id>
  colony ledger

Hors-ligne / confiance / park / permissions
  offline on|off
  offline enqueue --action <a> --summary <texte> [--risk low|high]
  offline reconnect
  offline decide --id <q> --verdict approve|reject
  trust show [--action <a>]
  park start --title <titre>
  park park --session <id> [--reason <texte>]
  park resume --session <id>
  park action --session <id> --type <type> [--tokens-in N] [--tokens-out N]
  park timeline [--session <id>]
  park cost [--session <id>]
  permissions modes
  permissions check --action <famille> [--mode deny] [--approved]
  permissions apply [--config <openclaw.json>] [--mode deny] [--workspace <dir>] [--force]

État : --state <dir> ou NIMBUS_STATE_DIR (défaut ~/.nimbus).
Voix, calendrier, jumeau Docker : non implémentés. Pas de HUD de démo.
`);
}

function main() {
  const { command, positional, flags } = parseArgs(process.argv);
  const root = stateDir(flags);
  const sub = positional[0];
  const nimbus = createNimbus(root, { permissionMode: flags.mode ?? "deny" });

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
    if (sub === "learn") {
      print(
        nimbus.memory.learn({
          key: flags.key,
          value: flags.value,
          kind: flags.kind,
          zone: flags.zone,
          ttl: flags.ttl,
        }),
      );
      return;
    }
    if (sub === "forget") {
      if (flags.weekend) {
        print(nimbus.memory.forgetWeekend());
        return;
      }
      if (flags.zone && !flags.id && !flags.key) {
        print(nimbus.memory.forgetZone(flags.zone));
        return;
      }
      print(nimbus.memory.forget({ id: flags.id, key: flags.key, query: flags.query }));
      return;
    }
    print(nimbus.memory.recall({ query: flags.query, zone: flags.zone }));
    return;
  }

  if (command === "colony") {
    if (sub === "worker") {
      print(nimbus.colony.addWorker({ id: flags.id, role: flags.role, skills: flags.skills?.split(",") }));
      return;
    }
    if (sub === "task") {
      print(nimbus.colony.createTask({ title: flags.title, assignee: flags.assignee }));
      return;
    }
    if (sub === "assign") {
      print(nimbus.colony.assignTask(flags.task, flags.worker));
      return;
    }
    if (sub === "step") {
      print(
        nimbus.colony.proposeStep({
          taskId: flags.task,
          action: flags.action,
          summary: flags.summary,
        }),
      );
      return;
    }
    if (sub === "decide") {
      print(nimbus.colony.decideStep(flags.step, flags.verdict, "human"));
      return;
    }
    if (sub === "run") {
      print(nimbus.colony.runStep(flags.step));
      return;
    }
    print(nimbus.colony.ledger());
    return;
  }

  if (command === "offline") {
    if (sub === "off") {
      print(nimbus.continuum.setOnline(false));
      return;
    }
    if (sub === "on") {
      print(nimbus.continuum.setOnline(true));
      return;
    }
    if (sub === "enqueue") {
      print(
        nimbus.continuum.enqueue({
          action: flags.action,
          summary: flags.summary,
          risk: flags.risk,
          needsApproval: flags.risk !== "low",
        }),
      );
      return;
    }
    if (sub === "reconnect") {
      print(nimbus.continuum.reconnect());
      return;
    }
    if (sub === "decide") {
      print(nimbus.continuum.decide(flags.id, flags.verdict));
      return;
    }
    print(nimbus.continuum.status());
    return;
  }

  if (command === "trust") {
    if (flags.action) {
      print(nimbus.trust.score(flags.action));
      return;
    }
    print(nimbus.trust.list());
    return;
  }

  if (command === "park") {
    if (sub === "start") {
      print(nimbus.park.start({ title: flags.title }));
      return;
    }
    if (sub === "park") {
      print(nimbus.park.park(flags.session, flags.reason ?? ""));
      return;
    }
    if (sub === "resume") {
      print(nimbus.park.resume(flags.session));
      return;
    }
    if (sub === "action") {
      print(
        nimbus.park.recordAction(flags.session, {
          type: flags.type,
          detail: flags.detail,
          tokensIn: Number(flags["tokens-in"]) || 0,
          tokensOut: Number(flags["tokens-out"]) || 0,
        }),
      );
      return;
    }
    if (sub === "cost") {
      print(nimbus.park.cost(flags.session));
      return;
    }
    print(nimbus.park.timeline(flags.session));
    return;
  }

  if (command === "permissions") {
    if (sub === "check") {
      print(
        authorize({
          action: flags.action,
          mode: flags.mode ?? "deny",
          approved: Boolean(flags.approved),
          allowlist: flags.allowlist ? String(flags.allowlist).split(",") : [],
        }),
      );
      return;
    }
    if (sub === "apply") {
      const configPath = resolve(flags.config ?? process.env.OPENCLAW_CONFIG_PATH ?? DEFAULT_OPENCLAW_CONFIG);
      print(
        applyToOpenClawConfig(configPath, {
          mode: flags.mode ?? "deny",
          workspace: flags.workspace,
          force: Boolean(flags.force),
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
