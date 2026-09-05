import { spawn } from "node:child_process";

const NOTEPAD_ALIASES = new Set(["notepad", "bloc-notes", "blocnotes"]);

export function describeWindowsInput(platform = process.platform) {
  return {
    platform,
    available: platform === "win32",
    delivery: "foreground",
    hudRequired: true,
  };
}

export function planWindowsCommand(action) {
  const name = action?.action;
  if (name === "wait") {
    const ms = Math.round((action.duration ?? 0) * 1000);
    return { ok: true, kind: "wait", ms };
  }
  if (name === "screenshot") {
    return { ok: true, kind: "screenshot" };
  }
  if (name === "launch_app") {
    const app = String(action.app ?? "").toLowerCase();
    const exe = NOTEPAD_ALIASES.has(app) ? "notepad.exe" : sanitizeExe(action.app);
    if (!exe) {
      return { ok: false, code: "invalid_app", message: "launch_app exe refused." };
    }
    return { ok: true, kind: "launch", exe };
  }
  if (name === "type") {
    return { ok: true, kind: "type", text: String(action.text ?? "") };
  }
  if (name === "key") {
    return { ok: true, kind: "key", key: String(action.key ?? action.text ?? "") };
  }
  if (name === "scroll") {
    return { ok: true, kind: "scroll", direction: action.scrollDirection, amount: action.scrollAmount };
  }
  if (name?.includes("click") || name === "mouse_move" || name === "left_click_drag") {
    return { ok: true, kind: name, x: action.x, y: action.y, start: action.startCoordinate };
  }
  return { ok: false, code: "unknown_action", message: `No Windows plan for ${name}.` };
}

export function createWindowsAdapter(options = {}) {
  const platform = options.platform ?? process.platform;
  const runner = options.runner ?? defaultRunner;
  return {
    async execute(action) {
      const desc = describeWindowsInput(platform);
      const plan = planWindowsCommand(action);
      if (!plan.ok) {
        return plan;
      }
      if (!desc.available) {
        return {
          ok: false,
          code: "unsupported_platform",
          message: "Desktop input runs on Windows only. Plan is valid; execute on the PC.",
          plan,
        };
      }
      if (plan.kind === "wait") {
        await new Promise((resolve) => setTimeout(resolve, plan.ms));
        return { ok: true, executed: "wait", plan };
      }
      if (plan.kind === "screenshot") {
        if (typeof options.capture !== "function") {
          return { ok: false, code: "capture_unbound", message: "Screenshot capture is not bound." };
        }
        return options.capture(action);
      }
      const ran = await runner(plan);
      return ran.ok ? { ok: true, executed: action.action, plan } : ran;
    },
  };
}

function sanitizeExe(name) {
  const value = String(name ?? "").trim();
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    return "";
  }
  return value.endsWith(".exe") ? value : `${value}.exe`;
}

function defaultRunner(plan) {
  if (plan.kind === "launch") {
    return spawnResult("cmd.exe", ["/c", "start", "", plan.exe]);
  }
  const script = powershellInput(plan);
  if (!script) {
    return Promise.resolve({ ok: false, code: "no_script", message: "No PowerShell mapping for this plan." });
  }
  return spawnResult("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]);
}

/**
 * Literal SendKeys: wrap characters SendKeys would interpret as commands.
 * Failure mode: unescaped `%{F4}` would be Alt+F4.
 */
export function escapeSendKeysLiteral(text) {
  return String(text ?? "").replace(/[+^%~(){}]/g, (ch) => `{${ch}}`);
}

export function mapSendKey(key) {
  const value = String(key ?? "").toLowerCase();
  if (value === "enter" || value === "return") {
    return "{ENTER}";
  }
  if (value === "esc" || value === "escape") {
    return "{ESC}";
  }
  if (value === "tab") {
    return "{TAB}";
  }
  return escapeSendKeysLiteral(key);
}

export function windowsSendKeysPayload(plan) {
  if (plan?.kind === "type") {
    return escapeSendKeysLiteral(plan.text);
  }
  if (plan?.kind === "key") {
    return mapSendKey(plan.key);
  }
  return "";
}

function powershellInput(plan) {
  const keys = windowsSendKeysPayload(plan).replace(/'/g, "''");
  if (plan.kind === "type" || plan.kind === "key") {
    return `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${keys}')`;
  }
  if (plan.kind === "left_click" || plan.kind === "double_click" || plan.kind === "right_click" || plan.kind === "mouse_move") {
    const flags = plan.kind === "right_click" ? "2" : plan.kind === "double_click" ? "1" : "0";
    return `$sig='[DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y); [DllImport("user32.dll")] public static extern void mouse_event(int d,int x,int y,int w,int i);'; Add-Type -Name U -Namespace N -MemberDefinition $sig; [N.U]::SetCursorPos(${plan.x},${plan.y}); if (${flags} -ne '') { [N.U]::mouse_event(0x0002,0,0,0,0); [N.U]::mouse_event(0x0004,0,0,0,0) }`;
  }
  if (plan.kind === "scroll") {
    const delta = (plan.direction === "down" || plan.direction === "right" ? -1 : 1) * (plan.amount ?? 1) * 120;
    return `$sig='[DllImport("user32.dll")] public static extern void mouse_event(int d,int x,int y,int w,int i);'; Add-Type -Name U -Namespace N -MemberDefinition $sig; [N.U]::mouse_event(0x0800,0,0,${delta},0)`;
  }
  return "";
}

function spawnResult(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { windowsHide: true });
    child.on("error", (error) => {
      resolve({ ok: false, code: "spawn_failed", message: error.message });
    });
    child.on("exit", (code) => {
      resolve(code === 0 ? { ok: true } : { ok: false, code: "exit", message: `exit ${code}` });
    });
  });
}
