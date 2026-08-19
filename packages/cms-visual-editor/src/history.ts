export type CmsDraftHistory<T> = Readonly<{
  past: readonly T[];
  present: T;
  future: readonly T[];
  lastGroup: string | null;
  lastCommittedAt: number | null;
}>;

export type CommitCmsDraftHistoryOptions = Readonly<{
  group?: string;
  limit?: number;
  mergeWindowMs?: number;
  now?: number;
}>;

const normalizeHistoryLimit = (limit: number | undefined) =>
  Number.isSafeInteger(limit) && Number(limit) > 0 ? Number(limit) : 50;

export function createCmsDraftHistory<T>(present: T): CmsDraftHistory<T> {
  return Object.freeze({
    past: Object.freeze([]) as readonly T[],
    present,
    future: Object.freeze([]) as readonly T[],
    lastGroup: null,
    lastCommittedAt: null,
  });
}

export function commitCmsDraftHistory<T>(
  history: CmsDraftHistory<T>,
  next: T,
  options: CommitCmsDraftHistoryOptions = {},
): CmsDraftHistory<T> {
  if (Object.is(history.present, next)) return history;
  const limit = normalizeHistoryLimit(options.limit);
  const now = options.now ?? Date.now();
  const mergeWindowMs = Math.max(0, options.mergeWindowMs ?? 700);
  const group = options.group?.trim() || null;
  const mergeWithPresent =
    group !== null &&
    history.lastGroup === group &&
    history.lastCommittedAt !== null &&
    now >= history.lastCommittedAt &&
    now - history.lastCommittedAt <= mergeWindowMs;
  const past = mergeWithPresent
    ? history.past
    : [...history.past, history.present].slice(-limit);
  return Object.freeze({
    past: Object.freeze(past),
    present: next,
    future: Object.freeze([]) as readonly T[],
    lastGroup: group,
    lastCommittedAt: now,
  });
}

export function undoCmsDraftHistory<T>(
  history: CmsDraftHistory<T>,
): CmsDraftHistory<T> {
  if (history.past.length === 0) return history;
  const previous = history.past.at(-1) as T;
  return Object.freeze({
    past: Object.freeze(history.past.slice(0, -1)),
    present: previous,
    future: Object.freeze([history.present, ...history.future]),
    lastGroup: null,
    lastCommittedAt: null,
  });
}

export function redoCmsDraftHistory<T>(
  history: CmsDraftHistory<T>,
): CmsDraftHistory<T> {
  if (history.future.length === 0) return history;
  const next = history.future[0] as T;
  return Object.freeze({
    past: Object.freeze([...history.past, history.present]),
    present: next,
    future: Object.freeze(history.future.slice(1)),
    lastGroup: null,
    lastCommittedAt: null,
  });
}
