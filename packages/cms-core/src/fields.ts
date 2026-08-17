import { z } from "zod";

import {
  cmsFieldKindSchema,
  cmsFieldNameSchema,
  type CmsCollectionData,
  type CmsCollectionDefinition,
  type CmsFieldDefinition,
  type CmsFieldVisibilityCondition,
} from "./collections.js";
import type { CmsBlock } from "./index.js";
import { CmsError, schemaVersionSchema } from "./primitives.js";

type FieldInput<TName extends string, TValue, TRequired extends boolean> = {
  readonly name: TName;
  readonly label: string;
  readonly required?: TRequired;
  readonly defaultValue?: TValue;
  readonly indexed?: boolean;
  readonly unique?: boolean;
  readonly admin?: {
    readonly description?: string;
    readonly readOnly?: boolean;
  };
  readonly visibleWhen?: CmsFieldVisibilityCondition;
};

type FieldMetadata<TValue> = {
  readonly defaultValue?: TValue;
};

export type CmsTextField<
  TName extends string = string,
  TRequired extends boolean = boolean,
> = CmsFieldDefinition<TName, "text", string, TRequired> &
  FieldMetadata<string> & {
    readonly validation?: {
      readonly minLength?: number;
      readonly maxLength?: number;
      readonly pattern?: string;
    };
    readonly multiline?: boolean;
  };

export type CmsNumberField<
  TName extends string = string,
  TRequired extends boolean = boolean,
> = CmsFieldDefinition<TName, "number", number, TRequired> &
  FieldMetadata<number> & {
    readonly validation?: {
      readonly min?: number;
      readonly max?: number;
      readonly integer?: boolean;
    };
  };

export type CmsBooleanField<
  TName extends string = string,
  TRequired extends boolean = boolean,
> = CmsFieldDefinition<TName, "boolean", boolean, TRequired> &
  FieldMetadata<boolean>;

export type CmsDateField<
  TName extends string = string,
  TRequired extends boolean = boolean,
> = CmsFieldDefinition<TName, "date", string, TRequired> &
  FieldMetadata<string> & {
    readonly mode: "date" | "datetime";
    readonly validation?: {
      readonly min?: string;
      readonly max?: string;
    };
  };

export type CmsRichTextBlock = {
  readonly type: string;
  readonly [key: string]: unknown;
};

export type CmsRichTextValue = {
  readonly version: number;
  readonly blocks: readonly CmsRichTextBlock[];
};

export type CmsRichTextField<
  TName extends string = string,
  TRequired extends boolean = boolean,
> = CmsFieldDefinition<TName, "rich-text", CmsRichTextValue, TRequired> &
  FieldMetadata<CmsRichTextValue> & {
    readonly validation?: {
      readonly minBlocks?: number;
      readonly maxBlocks?: number;
      readonly allowedBlocks?: readonly string[];
    };
  };

export type CmsMediaField<
  TName extends string = string,
  TRequired extends boolean = boolean,
  TMultiple extends boolean = boolean,
> = CmsFieldDefinition<
  TName,
  "media",
  TMultiple extends true ? readonly string[] : string,
  TRequired
> &
  FieldMetadata<TMultiple extends true ? readonly string[] : string> & {
    readonly multiple: TMultiple;
    readonly acceptedMimeTypes?: readonly string[];
    readonly validation?: {
      readonly minItems?: number;
      readonly maxItems?: number;
    };
  };

export type CmsBlocksField<
  TName extends string = string,
  TRequired extends boolean = boolean,
> = CmsFieldDefinition<TName, "blocks", readonly CmsBlock[], TRequired> &
  FieldMetadata<readonly CmsBlock[]> & {
    readonly allowedBlocks: readonly string[];
    readonly validation?: {
      readonly minItems?: number;
      readonly maxItems?: number;
    };
  };

export type CmsSelectOption<TValue extends string = string> = {
  readonly label: string;
  readonly value: TValue;
};

export type CmsSelectField<
  TName extends string = string,
  TValue extends string = string,
  TRequired extends boolean = boolean,
  TMultiple extends boolean = boolean,
> = CmsFieldDefinition<
  TName,
  "select",
  TMultiple extends true ? readonly TValue[] : TValue,
  TRequired
> &
  FieldMetadata<TMultiple extends true ? readonly TValue[] : TValue> & {
    readonly multiple: TMultiple;
    readonly options: readonly CmsSelectOption<TValue>[];
    readonly validation?: {
      readonly minItems?: number;
      readonly maxItems?: number;
    };
  };

export type CmsBuiltInField =
  | CmsTextField
  | CmsNumberField
  | CmsBooleanField
  | CmsDateField
  | CmsRichTextField
  | CmsMediaField
  | CmsBlocksField
  | CmsSelectField;

function baseField<
  const TName extends string,
  const TKind extends string,
  TValue,
  const TRequired extends boolean,
>(
  kind: TKind,
  input: FieldInput<TName, TValue, TRequired>,
): CmsFieldDefinition<TName, TKind, TValue, TRequired> & FieldMetadata<TValue> {
  cmsFieldNameSchema.parse(input.name);
  cmsFieldKindSchema.parse(kind);
  z.string().trim().min(1).max(120).parse(input.label);
  return Object.freeze({
    ...input,
    kind,
    required: (input.required ?? false) as TRequired,
  });
}

export function textField<
  const TName extends string,
  const TRequired extends boolean = false,
>(
  input: FieldInput<TName, string, TRequired> &
    Pick<CmsTextField<TName, TRequired>, "validation" | "multiline">,
): CmsTextField<TName, TRequired> {
  const field = {
    ...baseField("text", input),
    ...input,
    kind: "text",
  } as const;
  validateTextFieldDefinition(field);
  return Object.freeze(field);
}

export function numberField<
  const TName extends string,
  const TRequired extends boolean = false,
>(
  input: FieldInput<TName, number, TRequired> &
    Pick<CmsNumberField<TName, TRequired>, "validation">,
): CmsNumberField<TName, TRequired> {
  const field = {
    ...baseField("number", input),
    ...input,
    kind: "number",
  } as const;
  validateNumberFieldDefinition(field);
  return Object.freeze(field);
}

export function booleanField<
  const TName extends string,
  const TRequired extends boolean = false,
>(
  input: FieldInput<TName, boolean, TRequired>,
): CmsBooleanField<TName, TRequired> {
  const field = {
    ...baseField("boolean", input),
    ...input,
    kind: "boolean",
  } as const;
  validateDefault(field);
  return Object.freeze(field);
}

export function dateField<
  const TName extends string,
  const TRequired extends boolean = false,
>(
  input: FieldInput<TName, string, TRequired> &
    Pick<CmsDateField<TName, TRequired>, "mode" | "validation">,
): CmsDateField<TName, TRequired> {
  const field = {
    ...baseField("date", input),
    ...input,
    kind: "date",
  } as const;
  validateDateFieldDefinition(field);
  return Object.freeze(field);
}

export function richTextField<
  const TName extends string,
  const TRequired extends boolean = false,
>(
  input: FieldInput<TName, CmsRichTextValue, TRequired> &
    Pick<CmsRichTextField<TName, TRequired>, "validation">,
): CmsRichTextField<TName, TRequired> {
  const field = {
    ...baseField("rich-text", input),
    ...input,
    kind: "rich-text",
  } as const;
  validateDefault(field);
  return Object.freeze(field);
}

export function mediaField<
  const TName extends string,
  const TRequired extends boolean = false,
  const TMultiple extends boolean = false,
>(
  input: FieldInput<
    TName,
    TMultiple extends true ? readonly string[] : string,
    TRequired
  > &
    Pick<
      CmsMediaField<TName, TRequired, TMultiple>,
      "multiple" | "acceptedMimeTypes" | "validation"
    >,
): CmsMediaField<TName, TRequired, TMultiple> {
  const field = {
    ...baseField("media", input),
    ...input,
    kind: "media",
  } as const;
  validateDefault(field);
  return Object.freeze(field);
}

export function blocksField<
  const TName extends string,
  const TRequired extends boolean = false,
>(
  input: FieldInput<TName, readonly CmsBlock[], TRequired> &
    Pick<CmsBlocksField<TName, TRequired>, "allowedBlocks" | "validation">,
): CmsBlocksField<TName, TRequired> {
  if (
    !input.allowedBlocks.length ||
    new Set(input.allowedBlocks).size !== input.allowedBlocks.length
  ) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: "Blocks fields require unique allowed block types.",
      retryable: false,
    });
  }
  const field = {
    ...baseField("blocks", input),
    ...input,
    kind: "blocks",
  } as const;
  validateDefault(field);
  return Object.freeze(field);
}

export function selectField<
  const TName extends string,
  const TOptions extends readonly CmsSelectOption[],
  const TRequired extends boolean = false,
  const TMultiple extends boolean = false,
>(
  input: Omit<
    FieldInput<
      TName,
      TMultiple extends true
        ? readonly TOptions[number]["value"][]
        : TOptions[number]["value"],
      TRequired
    >,
    "defaultValue"
  > & {
    readonly options: TOptions;
    readonly multiple: TMultiple;
    readonly defaultValue?: TMultiple extends true
      ? readonly TOptions[number]["value"][]
      : TOptions[number]["value"];
    readonly validation?: {
      readonly minItems?: number;
      readonly maxItems?: number;
    };
  },
): CmsSelectField<TName, TOptions[number]["value"], TRequired, TMultiple> {
  if (
    !input.options.length ||
    new Set(input.options.map((option) => option.value)).size !==
      input.options.length
  ) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: "Select fields require unique options.",
      retryable: false,
    });
  }
  const field = {
    ...baseField("select", input),
    ...input,
    kind: "select",
  } as const;
  validateDefault(field);
  return Object.freeze(field) as CmsSelectField<
    TName,
    TOptions[number]["value"],
    TRequired,
    TMultiple
  >;
}

const richTextValueSchema = z.object({
  version: z.number().int().positive(),
  blocks: z.array(z.looseObject({ type: z.string().trim().min(1).max(128) })),
});

const collectionBlockSchema = z.object({
  id: z.string().trim().min(1).max(128),
  type: z.string().trim().min(1).max(128),
  schemaVersion: schemaVersionSchema,
  enabled: z.boolean(),
  data: z.unknown(),
});

function itemBounds<T extends z.ZodType>(
  schema: z.ZodArray<T>,
  validation:
    { readonly minItems?: number; readonly maxItems?: number } | undefined,
) {
  let next = schema;
  if (validation?.minItems !== undefined) next = next.min(validation.minItems);
  if (validation?.maxItems !== undefined) next = next.max(validation.maxItems);
  return next;
}

function schemaForField(field: CmsBuiltInField): z.ZodType {
  switch (field.kind) {
    case "text": {
      let schema = z.string();
      if (field.validation?.minLength !== undefined)
        schema = schema.min(field.validation.minLength);
      if (field.validation?.maxLength !== undefined)
        schema = schema.max(field.validation.maxLength);
      if (field.validation?.pattern !== undefined)
        schema = schema.regex(new RegExp(field.validation.pattern));
      return schema;
    }
    case "number": {
      let schema = z.number();
      if (field.validation?.integer) schema = schema.int();
      if (field.validation?.min !== undefined)
        schema = schema.min(field.validation.min);
      if (field.validation?.max !== undefined)
        schema = schema.max(field.validation.max);
      return schema;
    }
    case "boolean":
      return z.boolean();
    case "date": {
      let schema = field.mode === "date" ? z.iso.date() : z.iso.datetime();
      if (field.validation?.min !== undefined) {
        const minimum = field.validation.min;
        schema = schema.refine(
          (value) => value >= minimum,
          `Date must be on or after ${minimum}.`,
        );
      }
      if (field.validation?.max !== undefined) {
        const maximum = field.validation.max;
        schema = schema.refine(
          (value) => value <= maximum,
          `Date must be on or before ${maximum}.`,
        );
      }
      return schema;
    }
    case "rich-text":
      return richTextValueSchema.superRefine((value, context) => {
        const { minBlocks, maxBlocks, allowedBlocks } = field.validation ?? {};
        if (minBlocks !== undefined && value.blocks.length < minBlocks) {
          context.addIssue({
            code: "custom",
            message: `Expected at least ${minBlocks} rich-text blocks.`,
          });
        }
        if (maxBlocks !== undefined && value.blocks.length > maxBlocks) {
          context.addIssue({
            code: "custom",
            message: `Expected at most ${maxBlocks} rich-text blocks.`,
          });
        }
        if (allowedBlocks) {
          value.blocks.forEach((block, index) => {
            if (!allowedBlocks.includes(block.type)) {
              context.addIssue({
                code: "custom",
                path: ["blocks", index, "type"],
                message: `Rich-text block type \"${block.type}\" is not allowed.`,
              });
            }
          });
        }
      });
    case "media": {
      const id = z.string().trim().min(1).max(128);
      return field.multiple ? itemBounds(z.array(id), field.validation) : id;
    }
    case "blocks": {
      const allowed = field.allowedBlocks;
      const block = collectionBlockSchema.superRefine((value, context) => {
        if (!allowed.includes(value.type)) {
          context.addIssue({
            code: "custom",
            path: ["type"],
            message: `Block type \"${value.type}\" is not allowed.`,
          });
        }
      });
      return itemBounds(z.array(block), field.validation);
    }
    case "select": {
      const optionValues = field.options.map((option) => option.value);
      const option = z
        .string()
        .refine(
          (value) => optionValues.includes(value),
          "Expected a configured option.",
        );
      return field.multiple
        ? itemBounds(z.array(option), field.validation)
        : option;
    }
  }
}

function validateDefault(field: CmsBuiltInField) {
  if (field.defaultValue === undefined) return;
  const parsed = schemaForField(field).safeParse(field.defaultValue);
  if (!parsed.success) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Invalid default value for field \"${field.name}\".`,
      retryable: false,
      details: { issues: parsed.error.issues },
    });
  }
}

function validateTextFieldDefinition(field: CmsTextField) {
  if (field.validation?.pattern !== undefined) {
    try {
      new RegExp(field.validation.pattern);
    } catch {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: `Invalid pattern for field \"${field.name}\".`,
        retryable: false,
      });
    }
  }
  validateDefault(field);
}

function validateNumberFieldDefinition(field: CmsNumberField) {
  if (
    field.validation?.min !== undefined &&
    field.validation.max !== undefined &&
    field.validation.min > field.validation.max
  ) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Invalid numeric range for field \"${field.name}\".`,
      retryable: false,
    });
  }
  validateDefault(field);
}

function validateDateFieldDefinition(field: CmsDateField) {
  if (
    field.validation?.min !== undefined &&
    field.validation.max !== undefined &&
    field.validation.min > field.validation.max
  ) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Invalid date range for field \"${field.name}\".`,
      retryable: false,
    });
  }
  validateDefault(field);
}

export function isCmsFieldVisible(
  field: Pick<CmsFieldDefinition, "visibleWhen">,
  data: Readonly<Record<string, unknown>>,
): boolean {
  const condition = field.visibleWhen;
  if (!condition) return true;
  const value = data[condition.field];
  if ("equals" in condition) return Object.is(value, condition.equals);
  if ("notEquals" in condition) return !Object.is(value, condition.notEquals);
  return condition.in.some((candidate) => Object.is(value, candidate));
}

export function parseCmsCollectionData<
  TCollection extends CmsCollectionDefinition<
    string,
    readonly CmsBuiltInField[]
  >,
>(collection: TCollection, input: unknown): CmsCollectionData<TCollection> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Collection \"${collection.slug}\" data must be an object.`,
      retryable: false,
    });
  }

  const source = input as Record<string, unknown>;
  const knownFields = new Set(collection.fields.map((field) => field.name));
  const unknownFields = Object.keys(source).filter(
    (name) => !knownFields.has(name),
  );
  const output: Record<string, unknown> = {};
  const issues: Array<{ path: readonly (string | number)[]; message: string }> =
    unknownFields.map((name) => ({
      path: [name],
      message: "Unknown collection field.",
    }));

  for (const field of collection.fields) {
    const visible = isCmsFieldVisible(field, { ...source, ...output });
    const supplied = Object.prototype.hasOwnProperty.call(source, field.name);
    const value = supplied ? source[field.name] : field.defaultValue;
    if (value === undefined) {
      if (field.required && visible) {
        issues.push({
          path: [field.name],
          message: "Required field is missing.",
        });
      }
      continue;
    }

    const parsed = schemaForField(field).safeParse(value);
    if (!parsed.success) {
      issues.push(
        ...parsed.error.issues.map((issue) => ({
          path: [
            field.name,
            ...issue.path.map((segment) =>
              typeof segment === "symbol" ? String(segment) : segment,
            ),
          ],
          message: issue.message,
        })),
      );
      continue;
    }
    output[field.name] = parsed.data;
  }

  if (issues.length) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Collection \"${collection.slug}\" data failed validation.`,
      retryable: false,
      details: { issues },
    });
  }
  return output as CmsCollectionData<TCollection>;
}
