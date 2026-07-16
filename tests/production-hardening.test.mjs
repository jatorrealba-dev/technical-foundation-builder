import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateUsagePercentage,
  canManageAiPolicy,
  classifyAgentRuntimeError,
  getAiRuntimeErrorMessage,
} from "../domain/operations/ai-governance.ts";
import {
  OperationTimeoutError,
  runWithTimeout,
} from "../services/operations/run-with-timeout.ts";

test("AI policy is managed only by owner and admin", () => {
  assert.equal(canManageAiPolicy("owner"), true);
  assert.equal(canManageAiPolicy("admin"), true);
  assert.equal(canManageAiPolicy("member"), false);
  assert.equal(canManageAiPolicy(null), false);
});

test("usage percentage is bounded and handles invalid limits", () => {
  assert.equal(calculateUsagePercentage(0, 100), 0);
  assert.equal(calculateUsagePercentage(25, 100), 25);
  assert.equal(calculateUsagePercentage(150, 100), 100);
  assert.equal(calculateUsagePercentage(10, 0), 100);
});

test("runtime errors are classified and mapped to actionable messages", () => {
  assert.equal(
    classifyAgentRuntimeError("ai_daily_run_limit_exceeded"),
    "ai_daily_run_limit_exceeded"
  );
  assert.equal(
    classifyAgentRuntimeError("provider unavailable"),
    "agent_runtime_error"
  );
  assert.match(
    getAiRuntimeErrorMessage("ai_user_concurrency_limit_exceeded"),
    /ejecución de IA activa/i
  );
});

test("runWithTimeout returns fast operations and rejects slow operations", async () => {
  assert.equal(await runWithTimeout(Promise.resolve("ok"), 1), "ok");

  await assert.rejects(
    runWithTimeout(
      new Promise((resolve) => setTimeout(resolve, 30)),
      0.001
    ),
    (error) =>
      error instanceof OperationTimeoutError &&
      error.code === "agent_run_timeout"
  );
});
