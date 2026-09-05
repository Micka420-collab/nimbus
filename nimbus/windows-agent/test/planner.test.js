import assert from "node:assert/strict";
import { test } from "node:test";
import { compileDesktopPhrase, planWithGatewayModel } from "../src/planner.js";
import { parseHarnessProgram } from "../src/harness.js";
import { runBrowserAction } from "../src/browser-harness.js";

test("FR planner covers Notepad, calc, and browser research", () => {
  const notes = compileDesktopPhrase("ouvre le Bloc-notes et écris hello");
  assert.equal(notes.ok, true);
  assert.equal(notes.steps[0].app, "notepad");
  assert.equal(notes.steps.at(-1).text, "hello");
  const calc = compileDesktopPhrase("lance la calculatrice");
  assert.equal(calc.steps[0].app, "calc");
  const web = compileDesktopPhrase("cherche OpenClaw dans chrome");
  assert.equal(web.ok, true);
  assert.equal(web.steps[0].action, "launch_app");
  assert.equal(web.steps.at(-1).action, "goto");
  assert.match(web.steps.at(-1).url, /google\.com\/search/);
  assert.equal(compileDesktopPhrase("scan the network for cve-2024").ok, false);
});

test("model planner accepts JSON steps and refuses eval", async () => {
  const planned = await planWithGatewayModel({
    brief: "ouvre notepad",
    sendChat: async () => ({
      ok: true,
      payload: { text: '{"steps":[{"action":"launch_app","app":"notepad"}]}' },
    }),
  });
  assert.equal(planned.ok, true);
  assert.equal(planned.steps[0].app, "notepad");
  const rejected = parseHarnessProgram({ steps: [{ op: "eval", code: "1" }] });
  assert.equal(rejected.ok, false);
});

test("browser harness fails closed without Playwright and runs with an injected driver", async () => {
  const missing = await runBrowserAction({ action: "goto", url: "https://example.com" });
  assert.equal(missing.code, "playwright_missing");
  const ran = await runBrowserAction(
    { action: "goto", url: "https://example.com" },
    {
      playwright: {
        chromium: {
          async launch() {
            return {
              async newPage() {
                return { goto: async () => undefined, title: async () => "Example" };
              },
              async close() {},
            };
          },
        },
      },
    },
  );
  assert.equal(ran.ok, true);
  assert.equal(ran.title, "Example");
});
