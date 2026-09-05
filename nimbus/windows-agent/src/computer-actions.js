export const STRUCTURED_ACTIONS = Object.freeze([
  "screenshot",
  "left_click",
  "right_click",
  "middle_click",
  "double_click",
  "triple_click",
  "mouse_move",
  "left_click_drag",
  "scroll",
  "type",
  "key",
  "wait",
  "launch_app",
]);

export const UNSUPPORTED_ACTIONS = Object.freeze([
  "hold_key",
  "left_mouse_down",
  "left_mouse_up",
  "screen.record",
]);

const POINT_ACTIONS = new Set([
  "left_click",
  "right_click",
  "middle_click",
  "double_click",
  "triple_click",
  "mouse_move",
]);

export function parseComputerAction(raw) {
  const action = typeof raw === "string" ? safeJson(raw) : raw;
  if (action === null || typeof action !== "object" || Array.isArray(action)) {
    return { ok: false, code: "invalid_action", message: "Action must be an object." };
  }
  const name = action.action ?? action.op;
  if (typeof name !== "string" || name.trim() === "") {
    return { ok: false, code: "invalid_action", message: "action is required." };
  }
  if (UNSUPPORTED_ACTIONS.includes(name) || name === "screen.record") {
    return { ok: false, code: "unsupported_action", message: `${name} is not offered by this node.` };
  }
  if (!STRUCTURED_ACTIONS.includes(name)) {
    return { ok: false, code: "unknown_action", message: `Unknown action ${name}.` };
  }
  if (POINT_ACTIONS.has(name)) {
    if (!isNonNegInt(action.x) || !isNonNegInt(action.y)) {
      return { ok: false, code: "invalid_action", message: `${name} needs integer x,y.` };
    }
  }
  if (name === "left_click_drag") {
    if (!isNonNegInt(action.x) || !isNonNegInt(action.y)) {
      return { ok: false, code: "invalid_action", message: "left_click_drag needs x,y." };
    }
    const start = action.startCoordinate;
    if (!start || !isNonNegInt(start.x) || !isNonNegInt(start.y)) {
      return { ok: false, code: "invalid_action", message: "left_click_drag needs startCoordinate." };
    }
  }
  if (name === "scroll") {
    if (!["up", "down", "left", "right"].includes(action.scrollDirection)) {
      return { ok: false, code: "invalid_action", message: "scrollDirection must be up|down|left|right." };
    }
    if (!isNonNegInt(action.scrollAmount)) {
      return { ok: false, code: "invalid_action", message: "scrollAmount must be a non-negative integer." };
    }
  }
  if (name === "type" && typeof action.text !== "string") {
    return { ok: false, code: "invalid_action", message: "type needs text." };
  }
  if (name === "key" && typeof action.key !== "string" && typeof action.text !== "string") {
    return { ok: false, code: "invalid_action", message: "key needs key or text." };
  }
  if (name === "wait") {
    const duration = action.duration ?? action.ms;
    if (typeof duration !== "number" || duration < 0 || duration > 30) {
      return { ok: false, code: "invalid_action", message: "wait duration must be 0-30 seconds." };
    }
  }
  if (name === "launch_app" && typeof action.app !== "string") {
    return { ok: false, code: "invalid_action", message: "launch_app needs app." };
  }
  if (POINT_ACTIONS.has(name) || name === "left_click_drag") {
    if (typeof action.frameId !== "string" || action.frameId.trim() === "") {
      return { ok: false, code: "stale_frame", message: "Coordinate actions must echo frameId." };
    }
  }
  return { ok: true, action: { ...action, action: name } };
}

export function createActionExecutor(adapter) {
  if (typeof adapter?.execute !== "function") {
    throw new Error("action executor needs an execute adapter");
  }
  return {
    async run(raw, context = {}) {
      const parsed = parseComputerAction(raw);
      if (!parsed.ok) {
        return parsed;
      }
      if (context.frameId && parsed.action.frameId && parsed.action.frameId !== context.frameId) {
        return { ok: false, code: "stale_frame", message: "frameId does not match the last screenshot." };
      }
      if (context.aborted) {
        return { ok: false, code: "aborted", message: "Human aborted desktop control." };
      }
      return adapter.execute(parsed.action, context);
    },
  };
}

function isNonNegInt(value) {
  return Number.isInteger(value) && value >= 0;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
