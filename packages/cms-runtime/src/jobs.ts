import {
  cmsTaskDefinitionSchema,
  cmsWorkflowDefinitionSchema,
  type CmsJobEnvelope,
  type CmsOutboxEvent,
  type CmsRetryPolicy,
  type CmsTaskDefinition,
  type CmsWorkflowDefinition,
} from "@agency/cms-core";

export type CmsJobEnqueueInput<TPayload = unknown> = Readonly<{
  taskName: string;
  queue: string;
  payload: TPayload;
  idempotencyKey: string;
  availableAt?: Date;
}>;

export interface CmsJobStore {
  enqueue<TPayload>(
    input: CmsJobEnqueueInput<TPayload>,
  ): Promise<CmsJobEnvelope>;
  cancel(jobId: string): Promise<boolean>;
  get(jobId: string): Promise<CmsJobEnvelope | null>;
  list(input?: {
    queue?: string;
    status?: CmsJobEnvelope["status"];
    limit?: number;
  }): Promise<readonly CmsJobEnvelope[]>;
}

export interface CmsOutboxStore {
  append(event: CmsOutboxEvent): Promise<void>;
  dispatch(limit?: number): Promise<{
    delivered: number;
    failed: number;
  }>;
}

export type CmsTaskExecutionContext = Readonly<{
  jobId: string;
  attempt: number;
  idempotencyKey: string;
  signal: AbortSignal;
}>;

export type CmsTask<TPayload = unknown, TResult = unknown> = Readonly<{
  definition: CmsTaskDefinition;
  parsePayload: (payload: unknown) => TPayload;
  execute: (
    payload: TPayload,
    context: CmsTaskExecutionContext,
  ) => TResult | Promise<TResult>;
}>;

export function defineCmsTask<TPayload, TResult>(
  task: CmsTask<TPayload, TResult>,
): CmsTask<TPayload, TResult> {
  cmsTaskDefinitionSchema.parse(task.definition);
  return Object.freeze(task);
}

export function calculateCmsRetryDelay(
  policy: CmsRetryPolicy,
  attempt: number,
  random: () => number = Math.random,
) {
  const base = Math.min(
    policy.maxDelayMs,
    policy.initialDelayMs * policy.multiplier ** Math.max(0, attempt - 1),
  );
  const jitterRange = base * policy.jitter;
  return Math.min(
    policy.maxDelayMs,
    Math.max(0, Math.round(base - jitterRange + random() * jitterRange * 2)),
  );
}

export class CmsJobTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`CMS job timed out after ${timeoutMs}ms`);
    this.name = "CmsJobTimeoutError";
  }
}

export async function runCmsTaskWithTimeout<TResult>(
  timeoutMs: number,
  execute: (signal: AbortSignal) => TResult | Promise<TResult>,
) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(execute(controller.signal)),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort(new CmsJobTimeoutError(timeoutMs));
          reject(new CmsJobTimeoutError(timeoutMs));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export type CmsWorkflowStepContext = CmsTaskExecutionContext &
  Readonly<{ stepIdempotencyKey: string }>;

export type CmsWorkflowStepHandler<TState = unknown> = (
  state: TState,
  context: CmsWorkflowStepContext,
) => TState | Promise<TState>;

export async function runCmsWorkflowSteps<TState>(input: {
  definition: CmsWorkflowDefinition;
  initialState: TState;
  completed: ReadonlyMap<string, TState>;
  handlers: Readonly<Record<string, CmsWorkflowStepHandler<TState>>>;
  context: CmsTaskExecutionContext;
  onStepComplete: (stepName: string, state: TState) => void | Promise<void>;
}) {
  const definition = cmsWorkflowDefinitionSchema.parse(input.definition);
  let state = input.initialState;
  const executed: string[] = [];
  const skipped: string[] = [];
  for (const step of definition.steps) {
    if (input.completed.has(step.name)) {
      state = input.completed.get(step.name)!;
      skipped.push(step.name);
      continue;
    }
    const handler = input.handlers[step.name];
    if (!handler) throw new Error(`Missing workflow handler: ${step.name}`);
    state = await runCmsTaskWithTimeout(
      step.timeoutMs ?? definition.timeoutMs,
      (signal) =>
        handler(state, {
          ...input.context,
          signal,
          stepIdempotencyKey: `${input.context.idempotencyKey}/${step.name}`,
        }),
    );
    await input.onStepComplete(step.name, state);
    executed.push(step.name);
  }
  return { state, executed, skipped } as const;
}
