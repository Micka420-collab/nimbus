/**
 * French/English phrase planner. Closed patterns only — not a general LLM.
 * Unknown text fails closed so the Gateway model can supply computer.act steps.
 *
 * Failure modes: empty_brief, unsupported_brief, invalid_plan_json.
 */

import { parseHarnessProgram } from "./harness.js";
import { extractAssistantText } from "./speech-transport.js";

const APP_ALIASES = Object.freeze({
  notepad: "notepad",
  "bloc-notes": "notepad",
  blocnotes: "notepad",
  "bloc notes": "notepad",
  calc: "calc",
  calculatrice: "calc",
  chrome: "chrome",
  edge: "msedge",
  firefox: "firefox",
});

/**
 * @param {string} text
 * @returns {{ ok: boolean, brief?: string, steps?: object[], code?: string, message?: string, needsModel?: boolean }}
 */
export function compileDesktopPhrase(text) {
  const source = String(text ?? "").trim();
  if (!source) {
    return { ok: false, code: "empty_brief", message: "Objectif requis." };
  }
  const lower = source.toLowerCase();
  const steps = [];

  const urlMatch = source.match(/https?:\/\/[^\s]+/iu) ?? source.match(/\bwww\.[^\s]+/iu);
  const browserMatch = lower.match(
    /(?:ouvre|open|lance|launch|navigue|go to|va sur|cherche|recherche|search)\s+(?:dans\s+)?(?:google\s+chrome|chrome|msedge|edge|firefox|navigateur)?/u,
  );
  const launchMatch = lower.match(
    /(?:ouvre|open|lance|launch)\s+(?:le\s+|la\s+|l')?(bloc[-\s]?notes|notepad|calculatrice|calc|chrome|edge|firefox)/u,
  );
  const typeMatch = source.match(/(?:[eé]cris|write|type|saisis|remplis)\s+["«]?(.+?)["»]?$/iu);
  const searchMatch = source.match(/(?:cherche|recherche|search)\s+["«]?(.+?)["»]?$/iu);

  if (urlMatch || (browserMatch && (searchMatch || urlMatch))) {
    const app = launchMatch ? aliasApp(launchMatch[1]) : "chrome";
    if (launchMatch || /chrome|edge|firefox|navigateur/.test(lower) || urlMatch || searchMatch) {
      steps.push({ action: "launch_app", app });
      steps.push({ action: "wait", duration: 0.6 });
    }
    if (urlMatch) {
      const href = urlMatch[0].startsWith("http") ? urlMatch[0] : `https://${urlMatch[0]}`;
      steps.push({ action: "goto", url: href });
    } else if (searchMatch) {
      steps.push({ action: "goto", url: `https://www.google.com/search?q=${encodeURIComponent(searchMatch[1].trim())}` });
    }
    return { ok: true, brief: source, steps };
  }

  if (!launchMatch) {
    return {
      ok: false,
      code: "unsupported_brief",
      needsModel: true,
      message:
        "Pas de plan local. Envoie l'objectif au modèle Gateway (openai/gpt-6-astra) ou des pas computer.act.",
    };
  }
  steps.push({ action: "launch_app", app: aliasApp(launchMatch[1]) });
  if (typeMatch) {
    steps.push({ action: "wait", duration: 0.4 });
    steps.push({ action: "type", text: typeMatch[1].trim() });
  }
  return { ok: true, brief: source, steps };
}

/**
 * Ask the Gateway model for a closed JSON step list. Never eval the reply.
 *
 * @param {{ brief: string, sendChat: Function, observation?: object }} params
 */
export async function planWithGatewayModel(params) {
  const brief = String(params.brief ?? "").trim();
  if (!brief) {
    return { ok: false, code: "empty_brief", message: "Objectif requis." };
  }
  if (typeof params.sendChat !== "function") {
    return { ok: false, code: "offline", message: "Pas de Gateway pour planifier." };
  }
  const sent = await params.sendChat(
    [
      "Plan the desktop task as JSON only: {\"steps\":[{\"action\":\"launch_app|goto|type|key|wait|left_click\",\"...\":true}]}",
      "No prose, no code, no exploits.",
      `Task: ${brief}`,
      params.observation?.hash ? `Last screenshot hash: ${params.observation.hash}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  if (!sent?.ok) {
    return {
      ok: false,
      code: sent?.error?.code ?? sent?.code ?? "plan_failed",
      message: sent?.error?.message ?? sent?.message ?? "Le modèle n'a pas renvoyé de plan.",
    };
  }
  const text = extractAssistantText(sent.payload);
  const parsed = parseJsonObject(text);
  if (!parsed) {
    return { ok: false, code: "invalid_plan_json", message: "Le modèle n'a pas renvoyé un JSON d'étapes." };
  }
  return parseHarnessProgram({ ...parsed, brief });
}

function aliasApp(name) {
  const key = String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  return APP_ALIASES[key] ?? key;
}

function parseJsonObject(text) {
  const source = String(text ?? "").trim();
  if (!source) {
    return null;
  }
  try {
    const direct = JSON.parse(source);
    return direct && typeof direct === "object" ? direct : null;
  } catch {
    const match = source.match(/\{[\s\S]*\}/u);
    if (!match) {
      return null;
    }
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
