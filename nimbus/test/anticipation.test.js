import assert from "node:assert/strict";
import { test } from "node:test";
import { createAnticipation } from "../src/anticipation.js";
import { tempState } from "./helpers.js";

function clock(start = "2026-09-04T12:00:00.000Z") {
  let current = start;
  return {
    now: () => current,
    set(next) {
      current = next;
    },
  };
}

test("emits at most one due hint per window", () => {
  const time = clock();
  const hints = createAnticipation(tempState(), { now: time.now, windowMs: 4 * 3600_000 });
  hints.scheduleHint({ context: "calendar", text: "Réunion à 14h", at: "2026-09-04T11:00:00.000Z" });
  hints.scheduleHint({ context: "calendar", text: "Autre réunion", at: "2026-09-04T11:30:00.000Z" });
  const first = hints.dueHints();
  assert.equal(first.hints.length, 1);
  assert.match(first.hints[0].text, /Réunion/);
  const second = hints.dueHints();
  assert.equal(second.hints.length, 0);
  assert.ok(second.suppressed.some((item) => item.reason === "cooldown"));
});

test("not_useful ratings quiet a context", () => {
  const time = clock();
  const hints = createAnticipation(tempState(), {
    now: time.now,
    windowMs: 1,
    suppressBelow: 0.35,
    startWeight: 0.4,
    notUsefulDelta: 0.2,
  });
  hints.scheduleHint({ context: "heartbeat", text: "Rien d'urgent", at: "2026-09-04T11:00:00.000Z" });
  const due = hints.dueHints();
  hints.rate(due.hints[0].id, "not_useful");
  time.set("2026-09-04T18:00:00.000Z");
  hints.scheduleHint({ context: "heartbeat", text: "Encore une ping", at: "2026-09-04T17:00:00.000Z" });
  const later = hints.dueHints();
  assert.equal(later.hints.length, 0);
  assert.ok(later.suppressed.some((item) => item.reason === "calibrated_quiet"));
});

test("useful ratings raise the local weight", () => {
  const hints = createAnticipation(tempState(), { now: () => "2026-09-04T12:00:00.000Z" });
  hints.scheduleHint({ context: "work", text: "Préparer le brief", at: "2026-09-04T10:00:00.000Z" });
  const due = hints.dueHints();
  const rated = hints.rate(due.hints[0].id, "useful");
  assert.equal(rated.ok, true);
  assert.ok(rated.weight > 0.55);
});
