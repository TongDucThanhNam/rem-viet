import type { CmsBuiltInField } from "./fields.js";
import type { CmsCollectionDefinition } from "./collections.js";

export type CmsJsonSchema = Readonly<Record<string, unknown>>;

function arraySchema(
  items: CmsJsonSchema,
  validation?: { readonly minItems?: number; readonly maxItems?: number },
): CmsJsonSchema {
  return {
    type: "array",
    items,
    ...(validation?.minItems === undefined
      ? {}
      : { minItems: validation.minItems }),
    ...(validation?.maxItems === undefined
      ? {}
      : { maxItems: validation.maxItems }),
  };
}

function derivedValueSchema(kind: "text" | "number" | "boolean" | "json") {
  switch (kind) {
    case "text":
      return { type: "string" };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "json":
      return {};
  }
}

function fieldValueSchema(field: CmsBuiltInField): CmsJsonSchema {
  switch (field.kind) {
    case "text":
      return {
        type: "string",
        ...(field.multiline ? { "x-cms-multiline": true } : {}),
        ...(field.validation?.minLength === undefined
          ? {}
          : { minLength: field.validation.minLength }),
        ...(field.validation?.maxLength === undefined
          ? {}
          : { maxLength: field.validation.maxLength }),
        ...(field.validation?.pattern === undefined
          ? {}
          : { pattern: field.validation.pattern }),
      };
    case "number":
      return {
        type: field.validation?.integer ? "integer" : "number",
        ...(field.validation?.min === undefined
          ? {}
          : { minimum: field.validation.min }),
        ...(field.validation?.max === undefined
          ? {}
          : { maximum: field.validation.max }),
      };
    case "boolean":
      return { type: "boolean" };
    case "date":
      return {
        type: "string",
        format: field.mode === "date" ? "date" : "date-time",
        ...(field.validation?.min === undefined
          ? {}
          : { formatMinimum: field.validation.min }),
        ...(field.validation?.max === undefined
          ? {}
          : { formatMaximum: field.validation.max }),
      };
    case "email":
      return {
        type: "string",
        format: "email",
        ...field.validation,
      };
    case "url":
      return {
        type: "string",
        format: "uri",
        ...field.validation,
        "x-cms-allowed-protocols": field.allowedProtocols,
      };
    case "slug":
      return {
        type: "string",
        pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        ...field.validation,
      };
    case "code":
      return {
        type: "string",
        ...field.validation,
        ...(field.language ? { "x-cms-language": field.language } : {}),
      };
    case "json":
      return {};
    case "color":
      return {
        type: "string",
        pattern: field.alpha ? "^#[0-9a-fA-F]{8}$" : "^#[0-9a-fA-F]{6}$",
      };
    case "point":
      return {
        type: "object",
        additionalProperties: false,
        required: ["latitude", "longitude"],
        properties: {
          latitude: { type: "number", minimum: -90, maximum: 90 },
          longitude: { type: "number", minimum: -180, maximum: 180 },
        },
      };
    case "computed":
      return {
        ...derivedValueSchema(field.valueKind),
        readOnly: true,
        "x-cms-derived": "computed",
      };
    case "virtual":
      return {
        ...derivedValueSchema(field.valueKind),
        readOnly: true,
        "x-cms-derived": "virtual",
      };
    case "join": {
      const relation = {
        type: "string",
        minLength: 1,
        maxLength: 128,
      };
      return {
        ...(field.hasMany ? arraySchema(relation) : relation),
        readOnly: true,
        "x-cms-derived": "join",
        "x-cms-relation-to": field.relationTo,
        "x-cms-foreign-field": field.foreignField,
      };
    }
    case "group":
      return fieldRecordSchema(field.fields as readonly CmsBuiltInField[]);
    case "array":
      return arraySchema(
        fieldRecordSchema(field.fields as readonly CmsBuiltInField[]),
        field.validation,
      );
    case "rich-text":
      return {
        type: "object",
        additionalProperties: false,
        required: ["version", "blocks"],
        properties: {
          version: { type: "integer", minimum: 1 },
          blocks: arraySchema(
            {
              type: "object",
              required: ["type"],
              properties: { type: { type: "string" } },
            },
            {
              minItems: field.validation?.minBlocks,
              maxItems: field.validation?.maxBlocks,
            },
          ),
        },
      };
    case "media": {
      const mediaId = { type: "string", minLength: 1, maxLength: 128 };
      return field.multiple ? arraySchema(mediaId, field.validation) : mediaId;
    }
    case "blocks":
      return arraySchema(
        {
          type: "object",
          additionalProperties: false,
          required: ["id", "type", "schemaVersion", "enabled", "data"],
          properties: {
            id: { type: "string" },
            type: { type: "string", enum: field.allowedBlocks },
            schemaVersion: { type: "integer", minimum: 1 },
            enabled: { type: "boolean" },
            data: {},
          },
        },
        field.validation,
      );
    case "select": {
      const option = {
        type: "string",
        enum: field.options.map((candidate) => candidate.value),
      };
      return field.multiple ? arraySchema(option, field.validation) : option;
    }
    case "relationship": {
      const relation = {
        type: "string",
        minLength: 1,
        maxLength: 128,
        "x-cms-relation-to": field.relationTo,
      };
      return field.hasMany ? arraySchema(relation, field.validation) : relation;
    }
    case "polymorphic-relationship": {
      const relation = {
        type: "object",
        additionalProperties: false,
        required: ["relationTo", "id"],
        properties: {
          relationTo: { type: "string", enum: field.relationTo },
          id: { type: "string", minLength: 1, maxLength: 128 },
        },
        "x-cms-relation-to": field.relationTo,
      };
      return field.hasMany ? arraySchema(relation, field.validation) : relation;
    }
  }
}

function visibilityCondition(field: CmsBuiltInField): CmsJsonSchema | null {
  if (!field.required || !field.visibleWhen) return null;
  const condition = field.visibleWhen;
  const valueSchema =
    "equals" in condition
      ? { const: condition.equals }
      : "notEquals" in condition
        ? { not: { const: condition.notEquals } }
        : { enum: condition.in };
  return {
    if: {
      required: [condition.field],
      properties: { [condition.field]: valueSchema },
    },
    then: { required: [field.name] },
  };
}

function fieldRecordSchema(fields: readonly CmsBuiltInField[]): CmsJsonSchema {
  const required = fields
    .filter((field) => field.required && !field.visibleWhen)
    .map((field) => field.name);
  const allOf = fields
    .map(visibilityCondition)
    .filter((condition): condition is CmsJsonSchema => condition !== null);
  return {
    type: "object",
    additionalProperties: false,
    properties: Object.fromEntries(
      fields.map((field) => [
        field.name,
        {
          ...fieldValueSchema(field),
          title: field.label,
          ...(field.defaultValue === undefined
            ? {}
            : { default: field.defaultValue }),
        },
      ]),
    ),
    ...(required.length ? { required } : {}),
    ...(allOf.length ? { allOf } : {}),
  };
}

export function createCmsCollectionJsonSchema(
  collection: CmsCollectionDefinition<string, readonly CmsBuiltInField[]>,
): CmsJsonSchema {
  const properties = Object.fromEntries(
    collection.fields.map((field) => [
      field.name,
      {
        ...fieldValueSchema(field),
        title: field.label,
        ...(field.admin?.description
          ? { description: field.admin.description }
          : {}),
        ...(field.admin?.readOnly ||
        field.kind === "computed" ||
        field.kind === "virtual" ||
        field.kind === "join"
          ? { readOnly: true }
          : {}),
        ...(field.defaultValue === undefined
          ? {}
          : { default: field.defaultValue }),
        ...(field.localized ? { "x-cms-localized": true } : {}),
        ...(field.indexed ? { "x-cms-indexed": true } : {}),
        ...(field.unique ? { "x-cms-unique": true } : {}),
      },
    ]),
  );
  const required = collection.fields
    .filter((field) => field.required && !field.visibleWhen)
    .map((field) => field.name);
  const allOf = collection.fields
    .map(visibilityCondition)
    .filter((condition): condition is CmsJsonSchema => condition !== null);
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `urn:agency-cms:collection:${collection.slug}:v${collection.schemaVersion}`,
    title: collection.labels.singular,
    type: "object",
    additionalProperties: false,
    properties,
    ...(required.length ? { required } : {}),
    ...(allOf.length ? { allOf } : {}),
    "x-cms-collection": collection.slug,
    "x-cms-schema-version": collection.schemaVersion,
  };
}

/** OpenAPI 3.1 consumes JSON Schema directly. This alias makes artifact intent
 * explicit for generators without maintaining a second, divergent contract. */
export const createCmsCollectionOpenApiSchema = createCmsCollectionJsonSchema;
