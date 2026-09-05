import { WINDOWS_AGENT_ASSET } from "./download.js";

export const NODE_COMMANDS = Object.freeze([
  "screen.snapshot",
  "computer.act",
  "system.notify",
  "system.which",
  "talk.ptt.start",
  "talk.ptt.stop",
  "talk.ptt.cancel",
  "talk.ptt.once",
  "talk.speak",
]);

export const NODE_CAPS = Object.freeze(["screen", "talk", "computer"]);

export const COMPUTER_USE_DESCRIPTOR = Object.freeze({
  version: 2,
  actions: [
    "screenshot",
    "left_click",
    "right_click",
    "double_click",
    "mouse_move",
    "left_click_drag",
    "scroll",
    "type",
    "key",
    "wait",
    "launch_app",
  ],
  targets: ["screen"],
  deliveryModes: ["foreground"],
  observations: ["image"],
  features: { recording: false, agentCursor: true, multiDisplay: false },
});

export function buildConnectParams(pairing, extras = {}) {
  if (!pairing?.ok && !pairing?.gatewayUrl) {
    return { ok: false, code: "not_paired", message: "Pairing config required." };
  }
  const auth = {};
  if (pairing.auth?.kind === "bootstrap" && pairing.auth.bootstrapToken) {
    auth.bootstrapToken = pairing.auth.bootstrapToken;
  } else if (pairing.auth?.token) {
    auth.token = pairing.auth.token;
  }
  if (pairing.auth?.deviceToken) {
    auth.deviceToken = pairing.auth.deviceToken;
  }
  if (!auth.token && !auth.bootstrapToken && !auth.deviceToken) {
    return { ok: false, code: "missing_token", message: "Token or setup code required." };
  }
  const commands = extras.computerControlEnabled === false
    ? NODE_COMMANDS.filter((command) => command !== "computer.act")
    : [...NODE_COMMANDS];
  return {
    ok: true,
    gatewayUrl: pairing.gatewayUrl,
    params: {
      minProtocol: 3,
      maxProtocol: 4,
      role: "node",
      locale: pairing.locale ?? "fr-FR",
      client: {
        id: "node-host",
        displayName: pairing.displayName ?? "Nimbus Windows Agent",
        version: extras.version ?? "0.1.0",
        platform: extras.platform ?? "windows",
        deviceFamily: "desktop",
        mode: "node",
        instanceId: extras.instanceId ?? "nimbus-windows-agent",
      },
      caps: [...NODE_CAPS],
      commands,
      computerUse: extras.computerControlEnabled === false ? undefined : { ...COMPUTER_USE_DESCRIPTOR },
      auth,
    },
  };
}

export function buildRequestFrame(id, method, params) {
  return { type: "req", id, method, params };
}

export function dispatchNodeInvoke(command, params, handlers) {
  if (typeof command !== "string" || !command) {
    return { ok: false, code: "invalid_command", message: "command required." };
  }
  if (command === "screen.record" || command.startsWith("camera.")) {
    return { ok: false, code: "default_deny", message: `${command} is denied by default.` };
  }
  if (!NODE_COMMANDS.includes(command) && command !== "system.run") {
    return { ok: false, code: "unknown_command", message: `Command ${command} is not declared.` };
  }
  const handler = handlers?.[command];
  if (typeof handler !== "function") {
    return { ok: false, code: "unbound_command", message: `No handler bound for ${command}.` };
  }
  return handler(params ?? {});
}

export function installerAssetName() {
  return WINDOWS_AGENT_ASSET;
}
