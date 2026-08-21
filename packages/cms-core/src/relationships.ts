import type {
  CmsCollectionDefinition,
  CmsCollectionRegistry,
} from "./collections.js";
import type {
  CmsBuiltInField,
  CmsPolymorphicRelationshipField,
  CmsRelationshipField,
} from "./fields.js";
import { CmsError } from "./primitives.js";

export type CmsRelationshipReference = {
  readonly sourceCollection: string;
  readonly sourceField: string;
  readonly targetCollection: string;
  readonly targetId: string;
  readonly onDelete: "restrict" | "nullify";
  readonly localeBehavior: "same" | "default" | "any";
};

export type CmsRelationshipTargetLookup = (input: {
  readonly collection: string;
  readonly id: string;
  readonly localeBehavior: "same" | "default" | "any";
}) => boolean | Promise<boolean>;

export type CmsRelationshipNullificationResult = {
  readonly data: Readonly<Record<string, unknown>>;
  readonly changedFields: readonly string[];
};

export function isCmsRelationshipField(field: {
  readonly kind: string;
}): field is CmsRelationshipField | CmsPolymorphicRelationshipField {
  return (
    field.kind === "relationship" || field.kind === "polymorphic-relationship"
  );
}

export function collectCmsRelationshipReferences(
  collection: CmsCollectionDefinition,
  data: Readonly<Record<string, unknown>>,
): CmsRelationshipReference[] {
  const references: CmsRelationshipReference[] = [];
  const collect = (
    fields: readonly CmsBuiltInField[],
    record: Readonly<Record<string, unknown>>,
    prefix = "",
  ) => {
    for (const field of fields) {
      const fieldPath = prefix ? `${prefix}.${field.name}` : field.name;
      const value = record[field.name];
      if (field.kind === "group") {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          collect(
            field.fields as readonly CmsBuiltInField[],
            value as Record<string, unknown>,
            fieldPath,
          );
        }
        continue;
      }
      if (field.kind === "array") {
        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (item && typeof item === "object" && !Array.isArray(item)) {
              collect(
                field.fields as readonly CmsBuiltInField[],
                item as Record<string, unknown>,
                `${fieldPath}[${index}]`,
              );
            }
          });
        }
        continue;
      }
      if (!isCmsRelationshipField(field)) continue;
      const relations = field.hasMany
        ? value
        : value === undefined
          ? []
          : [value];
      if (!Array.isArray(relations)) continue;
      for (const relation of relations) {
        const targetCollection =
          field.kind === "relationship"
            ? field.relationTo
            : relation &&
                typeof relation === "object" &&
                !Array.isArray(relation) &&
                typeof (relation as Record<string, unknown>).relationTo ===
                  "string"
              ? String((relation as Record<string, unknown>).relationTo)
              : null;
        const targetId =
          field.kind === "relationship"
            ? typeof relation === "string"
              ? relation
              : null
            : relation &&
                typeof relation === "object" &&
                !Array.isArray(relation) &&
                typeof (relation as Record<string, unknown>).id === "string"
              ? String((relation as Record<string, unknown>).id)
              : null;
        if (!targetCollection || !targetId) continue;
        references.push({
          sourceCollection: collection.slug,
          sourceField: fieldPath,
          targetCollection,
          targetId,
          onDelete: field.onDelete,
          localeBehavior: field.localeBehavior ?? "any",
        });
      }
    }
  };
  collect(collection.fields as readonly CmsBuiltInField[], data);
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
        localeBehavior: reference.localeBehavior,
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
  const changedFields: string[] = [];
  const nullifyRecord = (
    fields: readonly CmsBuiltInField[],
    record: Readonly<Record<string, unknown>>,
    prefix = "",
  ): Record<string, unknown> => {
    const data = { ...record };
    for (const field of fields) {
      const fieldPath = prefix ? `${prefix}.${field.name}` : field.name;
      const value = data[field.name];
      if (field.kind === "group") {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          const before = changedFields.length;
          const nested = nullifyRecord(
            field.fields as readonly CmsBuiltInField[],
            value as Record<string, unknown>,
            fieldPath,
          );
          if (changedFields.length > before) data[field.name] = nested;
        }
        continue;
      }
      if (field.kind === "array") {
        if (Array.isArray(value)) {
          data[field.name] = value.map((item, index) =>
            item && typeof item === "object" && !Array.isArray(item)
              ? nullifyRecord(
                  field.fields as readonly CmsBuiltInField[],
                  item as Record<string, unknown>,
                  `${fieldPath}[${index}]`,
                )
              : item,
          );
        }
        continue;
      }
      if (!isCmsRelationshipField(field) || field.onDelete !== "nullify") {
        continue;
      }
      if (field.kind === "polymorphic-relationship") {
        const matches = (candidate: unknown) =>
          Boolean(
            candidate &&
            typeof candidate === "object" &&
            !Array.isArray(candidate) &&
            (candidate as Record<string, unknown>).relationTo ===
              input.targetCollection &&
            (candidate as Record<string, unknown>).id === input.targetId,
          );
        if (field.hasMany) {
          if (!Array.isArray(value) || !value.some(matches)) continue;
          data[field.name] = value.filter((candidate) => !matches(candidate));
          changedFields.push(fieldPath);
        } else if (matches(value)) {
          delete data[field.name];
          changedFields.push(fieldPath);
        }
        continue;
      }
      if (field.relationTo !== input.targetCollection) continue;
      if (field.hasMany) {
        if (!Array.isArray(value) || !value.includes(input.targetId)) continue;
        data[field.name] = value.filter((id) => id !== input.targetId);
        changedFields.push(fieldPath);
      } else if (value === input.targetId) {
        delete data[field.name];
        changedFields.push(fieldPath);
      }
    }
    return data;
  };
  const data = nullifyRecord(
    input.collection.fields as readonly CmsBuiltInField[],
    input.data,
  );
  return { data, changedFields };
}
