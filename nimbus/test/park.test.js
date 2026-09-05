import assert from "node:assert/strict";
import { test } from "node:test";
import { createParkDesk, estimateCostUsd } from "../src/park.js";
import { fixedClock, tempState } from "./helpers.js";

test("parks and resumes a session", () => {
  const desk = createParkDesk(tempState(), { now: fixedClock() });
  const started = desk.start({ title: "Brief matin" });
  const parked = desk.park(started.session.id, "pause café");
  assert.equal(parked.session.status, "parked");
  const resumed = desk.resume(started.session.id);
  assert.equal(resumed.session.status, "active");
});

test("refuses double-park and resume of an active session", () => {
  const desk = createParkDesk(tempState(), { now: fixedClock() });
  const started = desk.start({ title: "x" });
  desk.park(started.session.id);
  assert.equal(desk.park(started.session.id).ok, false);
  desk.resume(started.session.id);
  assert.equal(desk.resume(started.session.id).ok, false);
});

test("timeline records actions and rough cost", () => {
  const desk = createParkDesk(tempState(), { now: fixedClock() });
  const started = desk.start({ title: "voix" });
  desk.recordAction(started.session.id, {
    type: "model.turn",
    detail: "réponse",
    tokensIn: 1_000_000,
    tokensOut: 200_000,
  });
  const cost = desk.cost(started.session.id);
  assert.equal(cost.tokensIn, 1_000_000);
  assert.equal(cost.tokensOut, 200_000);
  assert.equal(cost.usdEstimate, estimateCostUsd(1_000_000, 200_000));
  assert.equal(cost.usdEstimate, 6);
  assert.equal(desk.timeline(started.session.id).events.length, 2);
});
