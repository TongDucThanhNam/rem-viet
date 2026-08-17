import type {
  CmsCollectionDefinition,
  CmsCollectionRegistry,
} from "./collections.js";
import type { CmsRelationshipField } from "./fields.js";
import { CmsError } from "./primitives.js";

export type CmsRelationshipReference = {
  readonly sourceCollection: string;
  readonly sourceField: string;
  readonly targetCollection: string;
  readonly targetId: string;
  readonly onDelete: "restrict" | "nullify";
};

export type CmsRelationshipTargetLookup = (input: {
  readonly collection: string;
  readonly id: string;
}) => boolean | Promise<boolean>;

export type CmsRelationshipNullificationResult = {
  readonly data: Readonly<Record<string, unknown>>;
  readonly changedFields: readonly string[];
};

export function isCmsRelationshipField(field: {
  readonly kind: string;
}): field is CmsRelationshipField {
  return field.kind === "relationship";
}

export function collectCmsRelationshipReferences(
  collection: CmsCollectionDefinition,
  data: Readonly<Record<string, unknown>>,
): CmsRelationshipReference[] {
  const references: CmsRelationshipReference[] = [];
  for (const field of collection.fields) {
    if (!isCmsRelationshipField(field)) continue;
    const value = data[field.name];
    const ids = field.hasMany ? value : value === undefined ? [] : [value];
    if (!Array.isArray(ids)) continue;
    for (const id of ids) {
      if (typeof id !== "string") continue;
      references.push({
        sourceCollection: collection.slug,
        sourceField: field.name,
        targetCollection: field.relationTo,
        targetId: id,
        onDelete: field.onDelete,
      });
    }
  }
  return references;
}

export async function assertCmsRelationshipIntegrity(input: {
  readonly registry: CmsCollectionRegistry;
  readonly collection: CmsCollectionDefinition;
  readonly data: Readonly<Record<string, unknown>>;
  readonly targetExists: CmsRelationshipTargetLookup;
}): Promise<readonly CmsRelationshipReference[]> {
  if (!input.registry.has(input.collection.slug)) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Collection \"${input.collection.slug}\" is not registered.`,
      retryable: false,
    });
  }
  const references = collectCmsRelationshipReferences(
    input.collection,
    input.data,
  );
  const dangling: CmsRelationshipReference[] = [];
  for (const reference of references) {
    if (
      !(await input.targetExists({
        collection: reference.targetCollection,
        id: reference.targetId,
      }))
    ) {
      dangling.push(reference);
    }
  }
  if (dangling.length) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Collection \"${input.collection.slug}\" contains dangling relationship references.`,
      retryable: false,
      details: { dangling },
    });
  }
  return references;
}

export function nullifyCmsRelationshipTarget(input: {
  readonly collection: CmsCollectionDefinition;
  readonly data: Readonly<Record<string, unknown>>;
  readonly targetCollection: string;
  readonly targetId: string;
}): CmsRelationshipNullificationResult {
  const data = { ...input.data };
  const changedFields: string[] = [];
  for (const field of input.collection.fields) {
    if (
      !isCmsRelationshipField(field) ||
      field.relationTo !== input.targetCollection ||
      field.onDelete !== "nullify"
    ) {
      continue;
    }
    if (field.hasMany) {
      const current = data[field.name];
      if (!Array.isArray(current) || !current.includes(input.targetId))
        continue;
      data[field.name] = current.filter((id) => id !== input.targetId);
      changedFields.push(field.name);
    } else if (data[field.name] === input.targetId) {
      delete data[field.name];
      changedFields.push(field.name);
    }
  }
  return { data, changedFields };
}
