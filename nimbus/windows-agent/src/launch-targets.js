/**
 * launch_app allowlist. Unlisted targets need a human confirm.
 * Always-confirm shells/installers stay gated even if added to the allowlist.
 */

export const LAUNCH_APP_CANONICAL = Object.freeze(["notepad", "calc", "chrome", "msedge", "firefox"]);

export const LAUNCH_APP_ALIASES = Object.freeze({
  notepad: "notepad",
  "bloc-notes": "notepad",
  blocnotes: "notepad",
  "bloc notes": "notepad",
  calc: "calc",
  calculatrice: "calc",
  calculator: "calc",
  chrome: "chrome",
  "google-chrome": "chrome",
  edge: "msedge",
  msedge: "msedge",
  firefox: "firefox",
});

export const ALWAYS_CONFIRM_LAUNCH = Object.freeze([
  "msiexec",
  "winget",
  "powershell",
  "pwsh",
  "cmd",
  "command",
  "bash",
  "wscript",
  "cscript",
  "mshta",
  "reg",
  "regedit",
  "schtasks",
  "mmc",
  "certutil",
  "bitsadmin",
  "rundll32",
]);

export function normalizeLaunchTarget(app) {
  const raw = String(app ?? "")
    .trim()
    .toLowerCase()
    .replace(/\\/g, "/");
  const base = raw.split("/").pop() ?? "";
  return base.replace(/\.exe$/i, "").replace(/\s+/g, "-");
}

export function canonicalLaunchApp(app) {
  const target = normalizeLaunchTarget(app);
  return LAUNCH_APP_ALIASES[target] ?? target;
}

export function launchAppRequiresConfirm(app) {
  const target = normalizeLaunchTarget(app);
  const canonical = canonicalLaunchApp(app);
  if (ALWAYS_CONFIRM_LAUNCH.includes(target) || ALWAYS_CONFIRM_LAUNCH.includes(canonical)) {
    return true;
  }
  return !LAUNCH_APP_CANONICAL.includes(canonical);
}

export function resolveLaunchExe(app) {
  const canonical = canonicalLaunchApp(app);
  if (!/^[A-Za-z0-9._-]+$/.test(canonical)) {
    return "";
  }
  return canonical.endsWith(".exe") ? canonical : `${canonical}.exe`;
}
