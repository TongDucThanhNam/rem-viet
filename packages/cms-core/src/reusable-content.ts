import { z } from "zod";

import type { CmsJsonValue } from "./fields.js";
import { CmsError } from "./primitives.js";

const reusableContentIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const reusableContentTypeSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/);
const reusableContentPointerSchema = z
  .string()
  .min(1)
  .max(512)
  .regex(/^\/(?:[^/~]|~[01])*(?:\/(?:[^/~]|~[01])*)*$/);

export const cmsReusableContentOverrideSchema = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("set"),
      path: reusableContentPointerSchema,
      value: z.json(),
    })
    .strict(),
  z
    .object({
      op: z.literal("unset"),
      path: reusableContentPointerSchema,
    })
    .strict(),
]);

export type CmsReusableContentOverride = z.infer<
  typeof cmsReusableContentOverrideSchema
>;

/**
 * Provider-neutral marker embedded in arbitrary CMS JSON. A null revision keeps
 * the reference synced to the latest visible fragment; a concrete revision is
 * a deterministic pin used by previews, releases, and historical renders.
 */
export const cmsReusableContentReferenceSchema = z
  .object({
    kind: z.literal("cms.reusable-reference"),
    fragmentId: reusableContentIdSchema,
    contentType: reusableContentTypeSchema,
    revisionId: reusableContentIdSchema.nullable().default(null),
    overrides: z.array(cmsReusableContentOverrideSchema).max(64).default([]),
  })
  .strict();

export type CmsReusableContentReference = z.infer<
  typeof cmsReusableContentReferenceSchema
>;

export const cmsDetachedReusableContentSchema = z
  .object({
    kind: z.literal("cms.detached-content"),
    source: z
      .object({
        fragmentId: reusableContentIdSchema,
        contentType: reusableContentTypeSchema,
        revisionId: reusableContentIdSchema,
        detachedAt: z.iso.datetime(),
      })
      .strict(),
    value: z.json(),
  })
  .strict();

export type CmsDetachedReusableContent = z.infer<
  typeof cmsDetachedReusableContentSchema
>;

export type CmsReusableContentLoadedFragment = Readonly<{
  fragmentId: string;
  contentType: string;
  revisionId: string;
  value: CmsJsonValue;
}>;

export type CmsReusableContentLoader = (
  reference: CmsReusableContentReference,
) => Promise<CmsReusableContentLoadedFragment | null>;

export type CmsReusableContentResolvedUsage = Readonly<{
  fragmentId: string;
  contentType: string;
  revisionId: string;
  path: string;
  depth: number;
  overrideCount: number;
}>;

export type CmsReusableContentResolution<TValue extends CmsJsonValue> =
  Readonly<{
    value: TValue;
    usages: readonly CmsReusableContentResolvedUsage[];
  }>;

function validationError(message: string, details?: Record<string, unknown>) {
  return new CmsError({
    code: "VALIDATION_FAILED",
    message,
    retryable: false,
    ...(details ? { details } : {}),
  });
}

function pointerSegments(path: string) {
  return path
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function assertSafePointerSegment(segment: string, path: string) {
  if (
    segment === "__proto__" ||
    segment === "prototype" ||
    segment === "constructor"
  ) {
    throw validationError(`Unsafe reusable-content override path: ${path}.`, {
      path,
    });
  }
}

function containerAtPointer(root: CmsJsonValue, path: string) {
  const segments = pointerSegments(path);
  const leaf = segments.pop();
  if (leaf === undefined) {
    throw validationError(
      "Reusable-content overrides cannot replace the root.",
    );
  }
  let current: CmsJsonValue = root;
  for (const segment of segments) {
    assertSafePointerSegment(segment, path);
    if (Array.isArray(current)) {
      if (!/^\d+$/.test(segment)) {
        throw validationError(
          `Invalid array index in override path: ${path}.`,
          {
            path,
          },
        );
      }
      const index = Number(segment);
      const next = current[index];
      if (next === undefined) {
        throw validationError(`Override path does not exist: ${path}.`, {
          path,
        });
      }
      current = next;
      continue;
    }
    if (!current || typeof current !== "object") {
      throw validationError(`Override path is not traversable: ${path}.`, {
        path,
      });
    }
    if (!Object.hasOwn(current, segment)) {
      throw validationError(`Override path does not exist: ${path}.`, { path });
    }
    current = (current as Readonly<Record<string, CmsJsonValue>>)[
      segment
    ] as CmsJsonValue;
  }
  assertSafePointerSegment(leaf, path);
  return { container: current, leaf };
}

/** Applies a bounded RFC 6901 set/unset patch without mutating the fragment. */
export function applyCmsReusableContentOverrides<TValue extends CmsJsonValue>(
  value: TValue,
  overrides: readonly CmsReusableContentOverride[],
): TValue {
  const parsed = z
    .array(cmsReusableContentOverrideSchema)
    .max(64)
    .parse(overrides);
  const output = structuredClone(value) as CmsJsonValue;
  for (const override of parsed) {
    const { container, leaf } = containerAtPointer(output, override.path);
    if (Array.isArray(container)) {
      if (override.op === "set" && leaf === "-") {
        container.push(structuredClone(override.value));
        continue;
      }
      if (!/^\d+$/.test(leaf)) {
        throw validationError(
          `Invalid array index in override path: ${override.path}.`,
          { path: override.path },
        );
      }
      const index = Number(leaf);
      if (index < 0 || index >= container.length) {
        throw validationError(
          `Override path does not exist: ${override.path}.`,
          {
            path: override.path,
          },
        );
      }
      if (override.op === "set") {
        container[index] = structuredClone(override.value);
      } else {
        container.splice(index, 1);
      }
      continue;
    }
    if (!container || typeof container !== "object") {
      throw validationError(
        `Override parent is not an object: ${override.path}.`,
        { path: override.path },
      );
    }
    const record = container as Record<string, CmsJsonValue>;
    if (override.op === "set") {
      record[leaf] = structuredClone(override.value);
    } else {
      if (!Object.hasOwn(record, leaf)) {
        throw validationError(
          `Override path does not exist: ${override.path}.`,
          {
            path: override.path,
          },
        );
      }
      delete record[leaf];
    }
  }
  return output as TValue;
}

function appendPointer(path: string, segment: string | number) {
  const encoded = String(segment).replaceAll("~", "~0").replaceAll("/", "~1");
  return `${path}/${encoded}`;
}

function referenceFromUnknown(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (value as Record<string, unknown>).kind !== "cms.reusable-reference"
  ) {
    return null;
  }
  const parsed = cmsReusableContentReferenceSchema.safeParse(value);
  if (!parsed.success) {
    throw validationError("Invalid reusable-content reference.", {
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}

/**
 * Resolves reusable markers recursively with type checks, revision pin checks,
 * override application, a bounded depth, and path-aware cycle diagnostics.
 */
export async function resolveCmsReusableContent<
  TValue extends CmsJsonValue = CmsJsonValue,
>(input: {
  value: TValue;
  load: CmsReusableContentLoader;
  maxDepth?: number;
}): Promise<CmsReusableContentResolution<TValue>> {
  const maxDepth = input.maxDepth ?? 16;
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 1 || maxDepth > 64) {
    throw validationError(
      "Reusable-content maxDepth must be between 1 and 64.",
    );
  }
  const usages: CmsReusableContentResolvedUsage[] = [];

  const visit = async (
    value: CmsJsonValue,
    path: string,
    stack: readonly string[],
  ): Promise<CmsJsonValue> => {
    const reference = referenceFromUnknown(value);
    if (reference) {
      if (stack.length >= maxDepth) {
        throw validationError("Reusable-content resolution depth exceeded.", {
          maxDepth,
          path,
          chain: [...stack, reference.fragmentId],
        });
      }
      const cycleAt = stack.indexOf(reference.fragmentId);
      if (cycleAt >= 0) {
        throw validationError("Reusable-content reference cycle detected.", {
          path,
          cycle: [...stack.slice(cycleAt), reference.fragmentId],
        });
      }
      const fragment = await input.load(reference);
      if (!fragment) {
        throw new CmsError({
          code: "NOT_FOUND",
          message: `Reusable-content fragment "${reference.fragmentId}" was not found.`,
          retryable: false,
          details: { fragmentId: reference.fragmentId, path },
        });
      }
      if (
        fragment.fragmentId !== reference.fragmentId ||
        fragment.contentType !== reference.contentType
      ) {
        throw validationError("Reusable-content reference type mismatch.", {
          fragmentId: reference.fragmentId,
          expectedContentType: reference.contentType,
          actualContentType: fragment.contentType,
          path,
        });
      }
      if (
        reference.revisionId &&
        fragment.revisionId !== reference.revisionId
      ) {
        throw new CmsError({
          code: "CONFLICT",
          message: `Reusable-content revision "${reference.revisionId}" is unavailable.`,
          retryable: false,
          details: {
            fragmentId: reference.fragmentId,
            requestedRevisionId: reference.revisionId,
            resolvedRevisionId: fragment.revisionId,
            path,
          },
        });
      }
      usages.push({
        fragmentId: fragment.fragmentId,
        contentType: fragment.contentType,
        revisionId: fragment.revisionId,
        path: path || "/",
        depth: stack.length,
        overrideCount: reference.overrides.length,
      });
      const overridden = applyCmsReusableContentOverrides(
        fragment.value,
        reference.overrides,
      );
      return visit(overridden, path, [...stack, reference.fragmentId]);
    }
    if (Array.isArray(value)) {
      return Promise.all(
        value.map((entry, index) =>
          visit(entry, appendPointer(path, index), stack),
        ),
      );
    }
    if (!value || typeof value !== "object") return value;
    const output: Record<string, CmsJsonValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      output[key] = await visit(entry, appendPointer(path, key), stack);
    }
    return output;
  };

  return Object.freeze({
    value: (await visit(input.value, "", [])) as TValue,
    usages: Object.freeze(usages),
  });
}

export async function detachCmsReusableContent(input: {
  reference: CmsReusableContentReference;
  load: CmsReusableContentLoader;
  now?: () => Date;
  maxDepth?: number;
}): Promise<CmsDetachedReusableContent> {
  const root = await input.load(input.reference);
  if (!root) {
    throw new CmsError({
      code: "NOT_FOUND",
      message: `Reusable-content fragment "${input.reference.fragmentId}" was not found.`,
      retryable: false,
    });
  }
  let rootAvailable = true;
  const resolution = await resolveCmsReusableContent({
    value: input.reference,
    maxDepth: input.maxDepth,
    load: (reference) => {
      if (
        rootAvailable &&
        reference.fragmentId === input.reference.fragmentId &&
        reference.revisionId === input.reference.revisionId
      ) {
        rootAvailable = false;
        return Promise.resolve(root);
      }
      return input.load(reference);
    },
  });
  return cmsDetachedReusableContentSchema.parse({
    kind: "cms.detached-content",
    source: {
      fragmentId: root.fragmentId,
      contentType: root.contentType,
      revisionId: root.revisionId,
      detachedAt: (input.now?.() ?? new Date()).toISOString(),
    },
    value: resolution.value,
  });
}

export type CmsReusableContentReferenceOccurrence = Readonly<{
  fragmentId: string;
  contentType: string;
  revisionId: string | null;
  path: string;
  overrideCount: number;
}>;

export function collectCmsReusableContentReferences(
  value: CmsJsonValue,
): readonly CmsReusableContentReferenceOccurrence[] {
  const references: CmsReusableContentReferenceOccurrence[] = [];
  const visit = (entry: CmsJsonValue, path: string) => {
    const reference = referenceFromUnknown(entry);
    if (reference) {
      references.push({
        fragmentId: reference.fragmentId,
        contentType: reference.contentType,
        revisionId: reference.revisionId,
        path: path || "/",
        overrideCount: reference.overrides.length,
      });
      return;
    }
    if (Array.isArray(entry)) {
      entry.forEach((item, index) => visit(item, appendPointer(path, index)));
      return;
    }
    if (!entry || typeof entry !== "object") return;
    for (const [key, item] of Object.entries(entry)) {
      visit(item, appendPointer(path, key));
    }
  };
  visit(value, "");
  return Object.freeze(references);
}

export type CmsReusableContentUsageSource = Readonly<{
  sourceType: string;
  sourceId: string;
  value: CmsJsonValue;
}>;

export type CmsReusableContentUsageEdge =
  CmsReusableContentReferenceOccurrence &
    Readonly<{
      sourceType: string;
      sourceId: string;
    }>;

export type CmsReusableContentUsageGraph = Readonly<{
  edges: readonly CmsReusableContentUsageEdge[];
  byFragment: Readonly<Record<string, readonly CmsReusableContentUsageEdge[]>>;
  cycles: readonly (readonly string[])[];
}>;

/** Builds a serializable inbound-usage graph and reports fragment cycles. */
export function buildCmsReusableContentUsageGraph(
  sources: readonly CmsReusableContentUsageSource[],
): CmsReusableContentUsageGraph {
  const edges = sources.flatMap((source) =>
    collectCmsReusableContentReferences(source.value).map((reference) => ({
      ...reference,
      sourceType: source.sourceType,
      sourceId: source.sourceId,
    })),
  );
  const byFragment = Object.create(null) as Record<
    string,
    CmsReusableContentUsageEdge[]
  >;
  for (const edge of edges) {
    (byFragment[edge.fragmentId] ??= []).push(edge);
  }

  const dependencies = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (edge.sourceType !== "reusable-fragment") continue;
    const current = dependencies.get(edge.sourceId) ?? new Set<string>();
    current.add(edge.fragmentId);
    dependencies.set(edge.sourceId, current);
  }
  const cycles: string[][] = [];
  const seenCycles = new Set<string>();
  const visit = (node: string, stack: readonly string[]) => {
    const cycleAt = stack.indexOf(node);
    if (cycleAt >= 0) {
      const cycle = [...stack.slice(cycleAt), node];
      const canonical = [...cycle.slice(0, -1)].sort().join("\u0000");
      if (!seenCycles.has(canonical)) {
        seenCycles.add(canonical);
        cycles.push(cycle);
      }
      return;
    }
    for (const dependency of dependencies.get(node) ?? []) {
      visit(dependency, [...stack, node]);
    }
  };
  for (const node of dependencies.keys()) visit(node, []);

  return Object.freeze({
    edges: Object.freeze(edges),
    byFragment: Object.freeze(
      Object.fromEntries(
        Object.entries(byFragment).map(([key, value]) => [
          key,
          Object.freeze(value),
        ]),
      ),
    ),
    cycles: Object.freeze(cycles.map((cycle) => Object.freeze(cycle))),
  });
}
