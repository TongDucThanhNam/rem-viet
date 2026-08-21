import { afterEach, describe, expect, mock, test } from "bun:test";
import { Database } from "bun:sqlite";
import { defineCmsTask } from "@agency/cms-runtime";
import * as automationSchema from "@rem-viet/db/schema/automation";
import { drizzle } from "drizzle-orm/bun-sqlite";

mock.module("cloudflare:workers", () => ({
  env: {
    BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth",
    BETTER_AUTH_URL: "http://localhost:3000",
    CORS_ORIGIN: "http://localhost:3000",
  },
}));

const {
  cancelCmsJob,
  clearCmsTaskRegistryForTests,
  defineDurableCmsWorkflow,
  enqueueCmsJob,
  listCmsJobs,
  registerCmsTask,
  runDueCmsJobs,
} = await import("../src/services/jobs");
type CmsJobsRuntime = import("../src/services/jobs").CmsJobsRuntime;

function createRuntime() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE cms_job_queues (
      name text PRIMARY KEY NOT NULL,
      concurrency_limit integer DEFAULT 1 NOT NULL,
      paused integer DEFAULT false NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    );
    CREATE TABLE cms_jobs (
      id text PRIMARY KEY NOT NULL,
      task_name text NOT NULL,
      queue_name text NOT NULL REFERENCES cms_job_queues(name),
      payload text NOT NULL,
      result text,
      workflow_state text,
      idempotency_key text NOT NULL UNIQUE,
      status text DEFAULT 'queued' NOT NULL,
      attempt integer DEFAULT 0 NOT NULL,
      max_attempts integer DEFAULT 5 NOT NULL,
      retry_policy text NOT NULL,
      timeout_ms integer NOT NULL,
      available_at integer NOT NULL,
      started_at integer,
      completed_at integer,
      locked_until integer,
      lock_token text,
      cancel_requested integer DEFAULT false NOT NULL,
      last_error text DEFAULT '' NOT NULL,
      retention_until integer NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    );
    CREATE TABLE cms_job_steps (
      id text PRIMARY KEY NOT NULL,
      job_id text NOT NULL REFERENCES cms_jobs(id) ON DELETE CASCADE,
      name text NOT NULL,
      status text DEFAULT 'running' NOT NULL,
      attempt integer DEFAULT 1 NOT NULL,
      idempotency_key text NOT NULL UNIQUE,
      state text,
      last_error text DEFAULT '' NOT NULL,
      started_at integer NOT NULL,
      completed_at integer,
      UNIQUE(job_id, name)
    );
  `);
  const database = drizzle(sqlite, { schema: automationSchema });
  Object.assign(database, {
    batch: async (queries: PromiseLike<unknown>[]) => {
      const results = [];
      for (const query of queries) results.push(await query);
      return results;
    },
  });
  let now = new Date("2026-08-21T00:00:00.000Z");
  const runtime = {
    db: database as unknown as CmsJobsRuntime["db"],
    now: () => now,
    random: () => 0.5,
  } satisfies CmsJobsRuntime;
  return {
    runtime,
    setNow(value: Date) {
      now = value;
    },
    sqlite,
  };
}

const taskDefaults = {
  queue: "test",
  timeoutMs: 1_000,
  retry: {
    maxAttempts: 3,
    initialDelayMs: 100,
    multiplier: 2,
    maxDelayMs: 1_000,
    jitter: 0,
  },
  retentionDays: 30,
};

afterEach(() => clearCmsTaskRegistryForTests());

describe("D1-compatible CMS job engine", () => {
  test("grants one lease when two workers poll the same job concurrently", async () => {
    const { runtime } = createRuntime();
    let effects = 0;
    registerCmsTask(
      defineCmsTask({
        definition: { ...taskDefaults, name: "test/concurrent-claim" },
        parsePayload: (value) => value,
        execute() {
          effects += 1;
          return { claimed: true };
        },
      }),
    );
    await enqueueCmsJob(
      {
        taskName: "test/concurrent-claim",
        payload: {},
        idempotencyKey: "concurrent-claim-1",
      },
      runtime,
    );

    const outcomes = await Promise.all([
      runDueCmsJobs(runtime.now!(), 10, runtime),
      runDueCmsJobs(runtime.now!(), 10, runtime),
    ]);
    expect(outcomes.reduce((sum, item) => sum + item.processed, 0)).toBe(1);
    expect(outcomes.reduce((sum, item) => sum + item.succeeded, 0)).toBe(1);
    expect(effects).toBe(1);
  });

  test("deduplicates enqueue and executes one side effect", async () => {
    const { runtime } = createRuntime();
    let effects = 0;
    registerCmsTask(
      defineCmsTask({
        definition: { ...taskDefaults, name: "test/success" },
        parsePayload(value) {
          if (!value || typeof value !== "object")
            throw new Error("bad payload");
          return value as { value: number };
        },
        execute(payload) {
          effects += 1;
          return { doubled: payload.value * 2 };
        },
      }),
    );
    const first = await enqueueCmsJob(
      {
        taskName: "test/success",
        payload: { value: 4 },
        idempotencyKey: "effect-1",
      },
      runtime,
    );
    const duplicate = await enqueueCmsJob(
      {
        taskName: "test/success",
        payload: { value: 4 },
        idempotencyKey: "effect-1",
      },
      runtime,
    );
    expect(duplicate.id).toBe(first.id);
    await expect(
      enqueueCmsJob(
        {
          taskName: "test/success",
          payload: { value: 5 },
          idempotencyKey: "effect-1",
        },
        runtime,
      ),
    ).rejects.toThrow("already bound to another payload");

    const receipt = await runDueCmsJobs(runtime.now!(), 10, runtime);
    expect(receipt).toMatchObject({ processed: 1, succeeded: 1 });
    expect(effects).toBe(1);
    expect(await listCmsJobs({}, runtime)).toMatchObject([
      { id: first.id, status: "succeeded", attempt: 1 },
    ]);
  });

  test("moves poison work to dead-letter after bounded redacted retries", async () => {
    const { runtime, setNow, sqlite } = createRuntime();
    registerCmsTask(
      defineCmsTask({
        definition: { ...taskDefaults, name: "test/poison" },
        parsePayload: (value) => value,
        execute() {
          throw new Error(
            "Bearer cmsk_aaaaaaaaaaaaaaaa_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb owner@example.com",
          );
        },
      }),
    );
    const job = await enqueueCmsJob(
      {
        taskName: "test/poison",
        payload: {},
        idempotencyKey: "poison-1",
      },
      runtime,
    );

    await runDueCmsJobs(runtime.now!(), 10, runtime);
    setNow(new Date("2026-08-21T00:00:00.100Z"));
    await runDueCmsJobs(runtime.now!(), 10, runtime);
    setNow(new Date("2026-08-21T00:00:00.300Z"));
    const final = await runDueCmsJobs(runtime.now!(), 10, runtime);

    expect(final.deadLetter).toBe(1);
    expect(await listCmsJobs({}, runtime)).toMatchObject([
      { id: job.id, status: "dead_letter", attempt: 3 },
    ]);
    const stored = sqlite
      .query("select last_error from cms_jobs where id = ?")
      .get(job.id) as { last_error: string };
    expect(stored.last_error).toContain("Bearer [redacted-secret]");
    expect(stored.last_error).toContain("[redacted-email]");
    expect(stored.last_error).not.toContain("cmsk_");
  });

  test("persists workflow steps and resumes without repeating completed work", async () => {
    const { runtime, setNow, sqlite } = createRuntime();
    let validates = 0;
    let deliveries = 0;
    registerCmsTask(
      defineDurableCmsWorkflow(
        {
          definition: {
            ...taskDefaults,
            name: "test/durable-workflow",
            steps: [{ name: "validate" }, { name: "deliver" }],
          },
          parsePayload: (value) => value as { value: number },
          initialState: (payload) => ({
            value: payload.value,
            validated: false,
          }),
          handlers: {
            validate(state) {
              validates += 1;
              return { ...state, validated: true };
            },
            deliver(state, context) {
              deliveries += 1;
              if (context.attempt === 1) throw new Error("worker crashed");
              return { ...state, delivered: true };
            },
          },
        },
        runtime,
      ),
    );
    const job = await enqueueCmsJob(
      {
        taskName: "test/durable-workflow",
        payload: { value: 7 },
        idempotencyKey: "durable-workflow-1",
      },
      runtime,
    );

    expect(await runDueCmsJobs(runtime.now!(), 10, runtime)).toMatchObject({
      waiting: 1,
    });
    setNow(new Date(runtime.now!().getTime() + 100));
    expect(await runDueCmsJobs(runtime.now!(), 10, runtime)).toMatchObject({
      succeeded: 1,
    });
    expect({ validates, deliveries }).toEqual({ validates: 1, deliveries: 2 });
    expect(
      sqlite
        .query(
          "select name, attempt from cms_job_steps where job_id = ? order by name",
        )
        .all(job.id),
    ).toEqual([
      { name: "deliver", attempt: 2 },
      { name: "validate", attempt: 1 },
    ]);
  });

  test("cancels queued work before its handler can run", async () => {
    const { runtime } = createRuntime();
    let executed = false;
    registerCmsTask(
      defineCmsTask({
        definition: { ...taskDefaults, name: "test/cancel" },
        parsePayload: (value) => value,
        execute() {
          executed = true;
        },
      }),
    );
    const job = await enqueueCmsJob(
      {
        taskName: "test/cancel",
        payload: {},
        idempotencyKey: "cancel-1",
      },
      runtime,
    );
    await cancelCmsJob(job.id, runtime);
    expect((await runDueCmsJobs(runtime.now!(), 10, runtime)).processed).toBe(
      0,
    );
    expect(executed).toBe(false);
    expect(await listCmsJobs({}, runtime)).toMatchObject([
      { id: job.id, status: "cancelled" },
    ]);
  });

  test("reclaims a running job after its worker lease expires", async () => {
    const { runtime, sqlite } = createRuntime();
    let effects = 0;
    registerCmsTask(
      defineCmsTask({
        definition: { ...taskDefaults, name: "test/reclaim" },
        parsePayload: (value) => value,
        execute() {
          effects += 1;
          return { resumed: true };
        },
      }),
    );
    const job = await enqueueCmsJob(
      {
        taskName: "test/reclaim",
        payload: {},
        idempotencyKey: "reclaim-1",
      },
      runtime,
    );
    sqlite.run(
      "update cms_jobs set status = 'running', attempt = 1, locked_until = ? where id = ?",
      [runtime.now!().getTime() - 1, job.id],
    );

    expect(await runDueCmsJobs(runtime.now!(), 10, runtime)).toMatchObject({
      processed: 1,
      succeeded: 1,
    });
    expect(effects).toBe(1);
    expect(await listCmsJobs({}, runtime)).toMatchObject([
      { id: job.id, status: "succeeded", attempt: 2 },
    ]);
  });
});
