/**
 * Constrained Playwright browser steps. Dynamic import — missing Playwright
 * fails closed. Never eval page scripts from the model.
 *
 * Failure modes: playwright_missing, invalid_url, browser_failed, aborted.
 */

const BROWSER_OPS = new Set(["goto", "navigate"]);

/**
 * @param {{ action?: string, op?: string }} action
 */
export function isBrowserAction(action) {
  return BROWSER_OPS.has(action?.action ?? action?.op);
}

/**
 * @param {object} action
 * @param {{ playwright?: any, loadPlaywright?: () => Promise<any>, signal?: AbortSignal }} [options]
 */
export async function runBrowserAction(action, options = {}) {
  const name = action?.action ?? action?.op;
  if (!isBrowserAction({ action: name })) {
    return { ok: false, code: "not_browser", message: "Not a browser harness step." };
  }
  const url = String(action.url ?? "");
  if (!/^https?:\/\//iu.test(url)) {
    return { ok: false, code: "invalid_url", message: "URL http(s) requise." };
  }
  if (options.signal?.aborted) {
    return { ok: false, code: "aborted", message: "Contrôle bureau interrompu." };
  }
  let playwright = options.playwright;
  if (!playwright && typeof options.loadPlaywright === "function") {
    try {
      playwright = await options.loadPlaywright();
    } catch {
      playwright = null;
    }
  }
  if (!playwright) {
    try {
      playwright = await import("playwright");
    } catch {
      playwright = null;
    }
  }
  if (!playwright) {
    return {
      ok: false,
      code: "playwright_missing",
      message: "Playwright n'est pas installé. `npm i playwright` dans nimbus/windows-agent, puis réessaie.",
    };
  }
  const browser = await playwright.chromium.launch({ headless: false });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    return { ok: true, executed: "goto", url, title: await page.title() };
  } catch (error) {
    return { ok: false, code: "browser_failed", message: error?.message ?? "Navigation échouée." };
  } finally {
    await browser.close().catch(() => undefined);
  }
}
