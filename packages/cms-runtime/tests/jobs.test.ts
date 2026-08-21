import { describe, expect, test } from "bun:test";

import {
  calculateCmsRetryDelay,
  runCmsTaskWithTimeout,
  runCmsWorkflowSteps,
} from "../src";

const retry = {
  maxAttempts: 5,
  initialDelayMs: 1_000,
  multiplier: 2,
  maxDelayMs: 5_000,
  jitter: 0.2,
};

describe("CMS durable execution primitives", () => {
  test("calculates bounded exponential backoff with deterministic jitter", () => {
    expect(calculateCmsRetryDelay(retry, 1, () => 0)).toBe(800);
    expect(calculateCmsRetryDelay(retry, 2, () => 0.5)).toBe(2_000);
    expect(calculateCmsRetryDelay(retry, 5, () => 1)).toBe(5_000);
  });

  test("aborts work at its declared timeout", async () => {
    let aborted = false;
    await expect(
      runCmsTaskWithTimeout(10, async (signal) => {
        await new Promise<void>((resolve) => {
          signal.addEventListener("abort", () => {
            aborted = true;
            resolve();
          });
        });
      }),
    ).rejects.toThrow(/timed out/);
    expect(aborted).toBe(true);
  });

  test("resumes after a crash without re-running a persisted step", async () => {
    const completed = new Map<string, number>();
    const calls: string[] = [];
    const definition = {
      name: "campaign/publish",
      queue: "content",
      steps: [{ name: "validate" }, { name: "deliver" }],
      retry,
      timeoutMs: 1_000,
      retentionDays: 30,
    };
    const context = {
      jobId: "job-1",
      attempt: 1,
      idempotencyKey: "campaign-1",
      signal: new AbortController().signal,
    };
    await expect(
      runCmsWorkflowSteps({
        definition,
        initialState: 0,
        completed,
        context,
        handlers: {
          validate: (state) => {
            calls.push("validate");
            return state + 1;
          },
          deliver: () => {
            calls.push("deliver-crash");
            throw new Error("worker crashed");
          },
        },
        onStepComplete: (name, state) => completed.set(name, state),
      }),
    ).rejects.toThrow("worker crashed");

    const resumed = await runCmsWorkflowSteps({
      definition,
      initialState: 0,
      completed,
      context: { ...context, attempt: 2 },
      handlers: {
        validate: () => {
          calls.push("validate-duplicate");
          return 99;
        },
        deliver: (state, step) => {
          calls.push(step.stepIdempotencyKey);
          return state + 1;
        },
      },
      onStepComplete: (name, state) => completed.set(name, state),
    });

    expect(calls).toEqual(["validate", "deliver-crash", "campaign-1/deliver"]);
    expect(resumed).toEqual({
      state: 2,
      executed: ["deliver"],
      skipped: ["validate"],
    });
  });
});
