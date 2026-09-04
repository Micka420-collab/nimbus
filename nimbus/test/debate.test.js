import assert from "node:assert/strict";
import { test } from "node:test";
import { createDebate } from "../src/debate.js";
import { fixedClock, tempState } from "./helpers.js";

test("records both briefs; Queen cannot skip a side", () => {
  const debate = createDebate(tempState(), { now: fixedClock() });
  const opened = debate.open({ question: "Déployer ce soir ?" });
  debate.argue(opened.debate.id, "security", "Attendre le backup.");
  const early = debate.queenRecommend(opened.debate.id, "security");
  assert.equal(early.ok, false);
  assert.equal(early.code, "incomplete");
});

test("human pick after Queen closes the ledger with both sides", () => {
  const debate = createDebate(tempState(), { now: fixedClock() });
  const opened = debate.open({ question: "Ouvrir le port 443 ?" });
  debate.argue(opened.debate.id, "security", "Non, trop tôt.", "sentinel");
  debate.argue(opened.debate.id, "speed", "Oui, le client attend.", "bolt");
  const queen = debate.queenRecommend(opened.debate.id, "security", "Backup d'abord.");
  assert.equal(queen.debate.status, "awaiting_human");
  const decided = debate.decide(opened.debate.id, "speed", "human");
  assert.equal(decided.debate.status, "closed");
  assert.equal(decided.debate.decision, "speed");
  assert.equal(decided.debate.briefs.security.argument, "Non, trop tôt.");
  assert.equal(decided.debate.briefs.speed.workerId, "bolt");
});

test("human cannot decide before the Queen", () => {
  const debate = createDebate(tempState(), { now: fixedClock() });
  const opened = debate.open({ question: "?" });
  debate.argue(opened.debate.id, "security", "non");
  debate.argue(opened.debate.id, "speed", "oui");
  assert.equal(debate.decide(opened.debate.id, "speed").code, "not_ready");
});
