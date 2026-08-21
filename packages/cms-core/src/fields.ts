import { z } from "zod";

import {
  cmsFieldKindSchema,
  cmsFieldNameSchema,
  type CmsCollectionData,
  type CmsCollectionDefinition,
  type CmsFieldData,
  type CmsFieldAccess,
  type CmsFieldAsyncValidator,
  type CmsFieldDefinition,
  type CmsFieldHooks,
  type CmsFieldLifecycleContext,
  type CmsFieldOperation,
  type CmsFieldValueResolver,
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
  readonly localized?: boolean;
  readonly admin?: {
    readonly description?: string;
    readonly readOnly?: boolean;
  };
  readonly visibleWhen?: CmsFieldVisibilityCondition;
  readonly access?: CmsFieldAccess;
  readonly hooks?: CmsFieldHooks<TValue>;
  readonly validateAsync?: CmsFieldAsyncValidator<TValue>;
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

type StringLengthValidation = {
  readonly minLength?: number;
  readonly maxLength?: number;
};

export type CmsEmailField<
  TName extends string = string,
  TRequired extends boolean = boolean,
> = CmsFieldDefinition<TName, "email", string, TRequired> &
  FieldMetadata<string> & {
    readonly validation?: StringLengthValidation;
  };

export type CmsUrlField<
  TName extends string = string,
  TRequired extends boolean = boolean,
> = CmsFieldDefinition<TName, "url", string, TRequired> &
  FieldMetadata<string> & {
    readonly allowedProtocols: readonly string[];
    readonly validation?: StringLengthValidation;
  };

export type CmsSlugField<
  TName extends string = string,
  TRequired extends boolean = boolean,
> = CmsFieldDefinition<TName, "slug", string, TRequired> &
  FieldMetadata<string> & {
    readonly validation?: StringLengthValidation;
  };

export type CmsCodeField<
  TName extends string = string,
  TRequired extends boolean = boolean,
> = CmsFieldDefinition<TName, "code", string, TRequired> &
  FieldMetadata<string> & {
    readonly language?: string;
    readonly validation?: StringLengthValidation;
  };

export type CmsJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly CmsJsonValue[]
  | { readonly [key: string]: CmsJsonValue };

export type CmsJsonField<
  TName extends string = string,
  TRequired extends boolean = boolean,
> = CmsFieldDefinition<TName, "json", CmsJsonValue, TRequired> &
  FieldMetadata<CmsJsonValue>;

export type CmsColorField<
  TName extends string = string,
  TRequired extends boolean = boolean,
> = CmsFieldDefinition<TName, "color", string, TRequired> &
  FieldMetadata<string> & {
    readonly alpha: boolean;
  };

export type CmsGeoPoint = Readonly<{
  latitude: number;
  longitude: number;
}>;

export type CmsPointField<
  TName extends string = string,
  TRequired extends boolean = boolean,
> = CmsFieldDefinition<TName, "point", CmsGeoPoint, TRequired> &
  FieldMetadata<CmsGeoPoint>;

export type CmsDerivedValueKind = "text" | "number" | "boolean" | "json";

export type CmsDerivedValue<TKind extends CmsDerivedValueKind> =
  TKind extends "text"
    ? string
    : TKind extends "number"
      ? number
      : TKind extends "boolean"
        ? boolean
        : CmsJsonValue;

export type CmsComputedField<
  TName extends string = string,
  TKind extends CmsDerivedValueKind = CmsDerivedValueKind,
> = CmsFieldDefinition<TName, "computed", CmsDerivedValue<TKind>, true> & {
  readonly valueKind: TKind;
  readonly compute: CmsFieldValueResolver<CmsDerivedValue<TKind>>;
} & FieldMetadata<CmsDerivedValue<TKind>>;

export type CmsVirtualField<
  TName extends string = string,
  TKind extends CmsDerivedValueKind = CmsDerivedValueKind,
> = CmsFieldDefinition<TName, "virtual", CmsDerivedValue<TKind>, false> & {
  readonly valueKind: TKind;
  readonly resolve: CmsFieldValueResolver<CmsDerivedValue<TKind>>;
} & FieldMetadata<CmsDerivedValue<TKind>>;

export type CmsJoinField<
  TName extends string = string,
  TTarget extends string = string,
  THasMany extends boolean = boolean,
> = CmsFieldDefinition<
  TName,
  "join",
  THasMany extends true
    ? readonly CmsRelationId<TTarget>[]
    : CmsRelationId<TTarget>,
  false
> & {
  readonly relationTo: TTarget;
  readonly foreignField: string;
  readonly hasMany: THasMany;
  readonly resolve: CmsFieldValueResolver<
    THasMany extends true
      ? readonly CmsRelationId<TTarget>[]
      : CmsRelationId<TTarget>
  >;
} & FieldMetadata<
    THasMany extends true
      ? readonly CmsRelationId<TTarget>[]
      : CmsRelationId<TTarget>
  >;

export type CmsGroupField<
  TName extends string = string,
  TFields extends readonly CmsFieldDefinition[] = readonly CmsFieldDefinition[],
  TRequired extends boolean = boolean,
> = CmsFieldDefinition<TName, "group", CmsFieldData<TFields>, TRequired> &
  FieldMetadata<CmsFieldData<TFields>> & {
    readonly fields: TFields;
  };

export type CmsArrayField<
  TName extends string = string,
  TFields extends readonly CmsFieldDefinition[] = readonly CmsFieldDefinition[],
  TRequired extends boolean = boolean,
> = CmsFieldDefinition<
  TName,
  "array",
  readonly CmsFieldData<TFields>[],
  TRequired
> &
  FieldMetadata<readonly CmsFieldData<TFields>[]> & {
    readonly fields: TFields;
    readonly validation?: {
      readonly minItems?: number;
      readonly maxItems?: number;
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

export type CmsRelationId<TCollectionSlug extends string = string> = string & {
  readonly __cmsRelationTarget?: TCollectionSlug;
};

export type CmsRelationshipField<
  TName extends string = string,
  TTarget extends string = string,
  TRequired extends boolean = boolean,
  THasMany extends boolean = boolean,
> = CmsFieldDefinition<
  TName,
  "relationship",
  THasMany extends true
    ? readonly CmsRelationId<TTarget>[]
    : CmsRelationId<TTarget>,
  TRequired
> &
  FieldMetadata<
    THasMany extends true
      ? readonly CmsRelationId<TTarget>[]
      : CmsRelationId<TTarget>
  > & {
    readonly relationTo: TTarget;
    readonly hasMany: THasMany;
    readonly onDelete: "restrict" | "nullify";
    /** How a relationship resolves when its target collection is localized. */
    readonly localeBehavior?: "same" | "default" | "any";
    readonly validation?: {
      readonly minItems?: number;
      readonly maxItems?: number;
    };
  };

export type CmsPolymorphicRelation<TCollectionSlug extends string = string> =
  Readonly<{
    relationTo: TCollectionSlug;
    id: CmsRelationId<TCollectionSlug>;
  }>;

export type CmsPolymorphicRelationshipField<
  TName extends string = string,
  TTargets extends string = string,
  TRequired extends boolean = boolean,
  THasMany extends boolean = boolean,
> = CmsFieldDefinition<
  TName,
  "polymorphic-relationship",
  THasMany extends true
    ? readonly CmsPolymorphicRelation<TTargets>[]
    : CmsPolymorphicRelation<TTargets>,
  TRequired
> &
  FieldMetadata<
    THasMany extends true
      ? readonly CmsPolymorphicRelation<TTargets>[]
      : CmsPolymorphicRelation<TTargets>
  > & {
    readonly relationTo: readonly TTargets[];
    readonly hasMany: THasMany;
    readonly onDelete: "restrict" | "nullify";
    readonly localeBehavior?: "same" | "default" | "any";
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
  | CmsEmailField
  | CmsUrlField
  | CmsSlugField
  | CmsCodeField
  | CmsJsonField
  | CmsColorField
  | CmsPointField
  | CmsComputedField
  | CmsVirtualField
  | CmsJoinField
  | CmsGroupField
  | CmsArrayField
  | CmsRichTextField
  | CmsMediaField
  | CmsBlocksField
  | CmsSelectField
  | CmsRelationshipField
  | CmsPolymorphicRelationshipField;

export type CmsFieldGroup<
  TId extends string = string,
  TFields extends readonly CmsFieldDefinition[] = readonly CmsFieldDefinition[],
> = Readonly<{
  id: TId;
  fields: TFields;
}>;

function assertComposableFieldNames(
  fields: readonly CmsFieldDefinition[],
  subject: string,
) {
  if (!fields.length) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `${subject} requires at least one field.`,
      retryable: false,
    });
  }
  const names = fields.map(({ name }) => name);
  const duplicate = names.find((name, index) => names.indexOf(name) !== index);
  if (duplicate) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `${subject} has duplicate field "${duplicate}".`,
      retryable: false,
    });
  }
}

export function defineCmsFieldGroup<
  const TId extends string,
  const TFields extends readonly CmsFieldDefinition[],
>(input: CmsFieldGroup<TId, TFields>): CmsFieldGroup<TId, TFields> {
  cmsFieldKindSchema.parse(input.id);
  assertComposableFieldNames(input.fields, `Field group "${input.id}"`);
  return Object.freeze({
    id: input.id,
    fields: Object.freeze([...input.fields]) as unknown as TFields,
  });
}

type ComposedCmsField<TGroups extends readonly CmsFieldGroup[]> =
  TGroups[number]["fields"][number];

export function composeCmsFieldGroups<
  const TGroups extends readonly CmsFieldGroup[],
>(...groups: TGroups): readonly ComposedCmsField<TGroups>[] {
  const fields = groups.flatMap((group) => group.fields);
  assertComposableFieldNames(fields, "Composed field groups");
  return Object.freeze([...fields]) as readonly ComposedCmsField<TGroups>[];
}

export function extendCmsFieldGroup<
  const TBaseId extends string,
  const TBaseFields extends readonly CmsFieldDefinition[],
  const TId extends string,
  const TFields extends readonly CmsFieldDefinition[],
>(
  base: CmsFieldGroup<TBaseId, TBaseFields>,
  extension: CmsFieldGroup<TId, TFields>,
): CmsFieldGroup<TId, readonly [...TBaseFields, ...TFields]> {
  return defineCmsFieldGroup({
    id: extension.id,
    fields: [...base.fields, ...extension.fields],
  } as CmsFieldGroup<TId, readonly [...TBaseFields, ...TFields]>);
}

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

export function emailField<
  const TName extends string,
  const TRequired extends boolean = false,
>(
  input: FieldInput<TName, string, TRequired> &
    Pick<CmsEmailField<TName, TRequired>, "validation">,
): CmsEmailField<TName, TRequired> {
  const field = {
    ...baseField("email", input),
    ...input,
    kind: "email",
  } as const;
  validateStringFieldDefinition(field);
  return Object.freeze(field);
}

export function urlField<
  const TName extends string,
  const TRequired extends boolean = false,
>(
  input: FieldInput<TName, string, TRequired> &
    Partial<Pick<CmsUrlField<TName, TRequired>, "allowedProtocols">> &
    Pick<CmsUrlField<TName, TRequired>, "validation">,
): CmsUrlField<TName, TRequired> {
  const field = {
    ...baseField("url", input),
    ...input,
    kind: "url",
    allowedProtocols: input.allowedProtocols ?? ["http:", "https:"],
  } as const;
  if (
    !field.allowedProtocols.length ||
    field.allowedProtocols.some((value) => !/^[a-z][a-z0-9+.-]*:$/.test(value))
  ) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `URL field "${field.name}" requires valid protocols.`,
      retryable: false,
    });
  }
  validateStringFieldDefinition(field);
  return Object.freeze(field);
}

export function slugField<
  const TName extends string,
  const TRequired extends boolean = false,
>(
  input: FieldInput<TName, string, TRequired> &
    Pick<CmsSlugField<TName, TRequired>, "validation">,
): CmsSlugField<TName, TRequired> {
  const field = {
    ...baseField("slug", input),
    ...input,
    kind: "slug",
  } as const;
  validateStringFieldDefinition(field);
  return Object.freeze(field);
}

export function codeField<
  const TName extends string,
  const TRequired extends boolean = false,
>(
  input: FieldInput<TName, string, TRequired> &
    Pick<CmsCodeField<TName, TRequired>, "language" | "validation">,
): CmsCodeField<TName, TRequired> {
  const field = {
    ...baseField("code", input),
    ...input,
    kind: "code",
  } as const;
  if (field.language) cmsFieldKindSchema.parse(field.language);
  validateStringFieldDefinition(field);
  return Object.freeze(field);
}

export function jsonField<
  const TName extends string,
  const TRequired extends boolean = false,
>(
  input: FieldInput<TName, CmsJsonValue, TRequired>,
): CmsJsonField<TName, TRequired> {
  const field = {
    ...baseField("json", input),
    ...input,
    kind: "json",
  } as const;
  validateDefault(field);
  return Object.freeze(field);
}

export function colorField<
  const TName extends string,
  const TRequired extends boolean = false,
>(
  input: FieldInput<TName, string, TRequired> & { readonly alpha?: boolean },
): CmsColorField<TName, TRequired> {
  const field = {
    ...baseField("color", input),
    ...input,
    kind: "color",
    alpha: input.alpha ?? false,
  } as const;
  validateDefault(field);
  return Object.freeze(field);
}

export function pointField<
  const TName extends string,
  const TRequired extends boolean = false,
>(
  input: FieldInput<TName, CmsGeoPoint, TRequired>,
): CmsPointField<TName, TRequired> {
  const field = {
    ...baseField("point", input),
    ...input,
    kind: "point",
  } as const;
  validateDefault(field);
  return Object.freeze(field);
}

type DerivedFieldInput<TName extends string, TValue> = Omit<
  FieldInput<TName, TValue, false>,
  "required" | "defaultValue" | "indexed" | "unique" | "hooks" | "validateAsync"
>;

export function computedField<
  const TName extends string,
  const TKind extends CmsDerivedValueKind,
>(
  input: DerivedFieldInput<TName, CmsDerivedValue<TKind>> & {
    readonly valueKind: TKind;
    readonly compute: CmsFieldValueResolver<CmsDerivedValue<TKind>>;
  },
): CmsComputedField<TName, TKind> {
  const field = {
    ...baseField("computed", { ...input, required: true }),
    ...input,
    kind: "computed",
    required: true,
    admin: { ...input.admin, readOnly: true },
  } as const;
  return Object.freeze(field) as CmsComputedField<TName, TKind>;
}

export function virtualField<
  const TName extends string,
  const TKind extends CmsDerivedValueKind,
>(
  input: DerivedFieldInput<TName, CmsDerivedValue<TKind>> & {
    readonly valueKind: TKind;
    readonly resolve: CmsFieldValueResolver<CmsDerivedValue<TKind>>;
  },
): CmsVirtualField<TName, TKind> {
  const field = {
    ...baseField("virtual", input),
    ...input,
    kind: "virtual",
    required: false,
    admin: { ...input.admin, readOnly: true },
  } as const;
  return Object.freeze(field) as CmsVirtualField<TName, TKind>;
}

export function joinField<
  const TName extends string,
  const TTarget extends string,
  const THasMany extends boolean = true,
>(
  input: DerivedFieldInput<
    TName,
    THasMany extends true
      ? readonly CmsRelationId<TTarget>[]
      : CmsRelationId<TTarget>
  > & {
    readonly relationTo: TTarget;
    readonly foreignField: string;
    readonly hasMany: THasMany;
    readonly resolve: CmsFieldValueResolver<
      THasMany extends true
        ? readonly CmsRelationId<TTarget>[]
        : CmsRelationId<TTarget>
    >;
  },
): CmsJoinField<TName, TTarget, THasMany> {
  cmsFieldKindSchema.parse(input.relationTo);
  cmsFieldNameSchema.parse(input.foreignField);
  const field = {
    ...baseField("join", input),
    ...input,
    kind: "join",
    required: false,
    admin: { ...input.admin, readOnly: true },
  } as const;
  return Object.freeze(field) as CmsJoinField<TName, TTarget, THasMany>;
}

function validateNestedFields(
  fields: readonly CmsBuiltInField[],
  containerName: string,
) {
  if (!fields.length) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Structured field "${containerName}" requires at least one nested field.`,
      retryable: false,
    });
  }
  const names = fields.map((field) => field.name);
  const duplicate = names.find((name, index) => names.indexOf(name) !== index);
  if (duplicate) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Structured field "${containerName}" has duplicate nested field "${duplicate}".`,
      retryable: false,
    });
  }
  const available = new Set(names);
  for (const field of fields) {
    if (field.localized) {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: `Nested field "${field.name}" cannot be localized independently; localize "${containerName}" instead.`,
        retryable: false,
      });
    }
    if (
      field.visibleWhen &&
      (!available.has(field.visibleWhen.field) ||
        field.visibleWhen.field === field.name)
    ) {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: `Nested field "${field.name}" has an invalid visibility dependency.`,
        retryable: false,
      });
    }
  }
}

export function groupField<
  const TName extends string,
  const TFields extends readonly CmsFieldDefinition[],
  const TRequired extends boolean = false,
>(
  input: FieldInput<TName, CmsFieldData<TFields>, TRequired> & {
    readonly fields: TFields;
  },
): CmsGroupField<TName, TFields, TRequired> {
  validateNestedFields(input.fields as readonly CmsBuiltInField[], input.name);
  const field = {
    ...baseField("group", input),
    ...input,
    kind: "group",
  } as const;
  validateDefault(field);
  return Object.freeze(field);
}

export function arrayField<
  const TName extends string,
  const TFields extends readonly CmsFieldDefinition[],
  const TRequired extends boolean = false,
>(
  input: FieldInput<TName, readonly CmsFieldData<TFields>[], TRequired> & {
    readonly fields: TFields;
    readonly validation?: {
      readonly minItems?: number;
      readonly maxItems?: number;
    };
  },
): CmsArrayField<TName, TFields, TRequired> {
  validateNestedFields(input.fields as readonly CmsBuiltInField[], input.name);
  const field = {
    ...baseField("array", input),
    ...input,
    kind: "array",
  } as const;
  validateDefault(field);
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

export function relationshipField<
  const TName extends string,
  const TTarget extends string,
  const TRequired extends boolean = false,
  const THasMany extends boolean = false,
>(
  input: FieldInput<
    TName,
    THasMany extends true
      ? readonly CmsRelationId<TTarget>[]
      : CmsRelationId<TTarget>,
    TRequired
  > &
    Pick<
      CmsRelationshipField<TName, TTarget, TRequired, THasMany>,
      "relationTo" | "hasMany" | "onDelete" | "validation" | "localeBehavior"
    >,
): CmsRelationshipField<TName, TTarget, TRequired, THasMany> {
  cmsFieldKindSchema.parse(input.relationTo);
  if (input.required && input.onDelete === "nullify") {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Required relationship field \"${input.name}\" cannot use nullify on delete.`,
      retryable: false,
    });
  }
  const field = {
    ...baseField("relationship", input),
    ...input,
    kind: "relationship",
  } as const;
  validateDefault(field);
  return Object.freeze(field);
}

export function polymorphicRelationshipField<
  const TName extends string,
  const TTargets extends readonly [string, string, ...string[]],
  const TRequired extends boolean = false,
  const THasMany extends boolean = false,
>(
  input: FieldInput<
    TName,
    THasMany extends true
      ? readonly CmsPolymorphicRelation<TTargets[number]>[]
      : CmsPolymorphicRelation<TTargets[number]>,
    TRequired
  > & {
    readonly relationTo: TTargets;
    readonly hasMany: THasMany;
    readonly onDelete: "restrict" | "nullify";
    readonly localeBehavior?: "same" | "default" | "any";
    readonly validation?: {
      readonly minItems?: number;
      readonly maxItems?: number;
    };
  },
): CmsPolymorphicRelationshipField<
  TName,
  TTargets[number],
  TRequired,
  THasMany
> {
  for (const target of input.relationTo) cmsFieldKindSchema.parse(target);
  if (new Set(input.relationTo).size !== input.relationTo.length) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: "Polymorphic relationship fields require unique targets.",
      retryable: false,
    });
  }
  if (input.required && input.onDelete === "nullify") {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Required polymorphic relationship field "${input.name}" cannot use nullify on delete.`,
      retryable: false,
    });
  }
  const field = {
    ...baseField("polymorphic-relationship", input),
    ...input,
    kind: "polymorphic-relationship",
  } as const;
  validateDefault(field);
  return Object.freeze(field) as CmsPolymorphicRelationshipField<
    TName,
    TTargets[number],
    TRequired,
    THasMany
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

function derivedValueSchema(kind: CmsDerivedValueKind): z.ZodType {
  switch (kind) {
    case "text":
      return z.string();
    case "number":
      return z.number();
    case "boolean":
      return z.boolean();
    case "json":
      return z.json();
  }
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
    case "email": {
      let schema = z.email();
      if (field.validation?.minLength !== undefined)
        schema = schema.min(field.validation.minLength);
      if (field.validation?.maxLength !== undefined)
        schema = schema.max(field.validation.maxLength);
      return schema;
    }
    case "url": {
      let schema = z.url();
      if (field.validation?.minLength !== undefined)
        schema = schema.min(field.validation.minLength);
      if (field.validation?.maxLength !== undefined)
        schema = schema.max(field.validation.maxLength);
      return schema.refine(
        (value) => field.allowedProtocols.includes(new URL(value).protocol),
        "URL protocol is not allowed.",
      );
    }
    case "slug": {
      let schema = z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected a lowercase slug.");
      if (field.validation?.minLength !== undefined)
        schema = schema.min(field.validation.minLength);
      if (field.validation?.maxLength !== undefined)
        schema = schema.max(field.validation.maxLength);
      return schema;
    }
    case "code": {
      let schema = z.string();
      if (field.validation?.minLength !== undefined)
        schema = schema.min(field.validation.minLength);
      if (field.validation?.maxLength !== undefined)
        schema = schema.max(field.validation.maxLength);
      return schema;
    }
    case "json":
      return z.json();
    case "color":
      return z
        .string()
        .regex(
          field.alpha ? /^#[0-9a-fA-F]{8}$/ : /^#[0-9a-fA-F]{6}$/,
          field.alpha
            ? "Expected an 8-digit hex color."
            : "Expected a 6-digit hex color.",
        );
    case "point":
      return z
        .object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        })
        .strict();
    case "computed":
    case "virtual":
      return derivedValueSchema(field.valueKind);
    case "join": {
      const id = z.string().trim().min(1).max(128);
      return field.hasMany ? z.array(id) : id;
    }
    case "group":
      return nestedFieldRecordSchema(
        field.fields as readonly CmsBuiltInField[],
        field.name,
      );
    case "array":
      return itemBounds(
        z.array(
          nestedFieldRecordSchema(
            field.fields as readonly CmsBuiltInField[],
            field.name,
          ),
        ),
        field.validation,
      );
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
    case "relationship": {
      const id = z.string().trim().min(1).max(128);
      return field.hasMany ? itemBounds(z.array(id), field.validation) : id;
    }
    case "polymorphic-relationship": {
      const targets = field.relationTo;
      const relation = z
        .object({
          relationTo: z
            .string()
            .refine(
              (value) => targets.includes(value),
              "Expected a configured relationship target.",
            ),
          id: z.string().trim().min(1).max(128),
        })
        .strict();
      return field.hasMany
        ? itemBounds(z.array(relation), field.validation)
        : relation;
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

function validateStringFieldDefinition(
  field: CmsEmailField | CmsUrlField | CmsSlugField | CmsCodeField,
) {
  if (
    field.validation?.minLength !== undefined &&
    field.validation.maxLength !== undefined &&
    field.validation.minLength > field.validation.maxLength
  ) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Invalid string length range for field "${field.name}".`,
      retryable: false,
    });
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

function parseFieldRecord(
  fields: readonly CmsBuiltInField[],
  input: unknown,
  subject: string,
) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `${subject} must be an object.`,
      retryable: false,
    });
  }

  const source = input as Record<string, unknown>;
  const knownFields = new Set(fields.map((field) => field.name));
  const derivedFields = new Set(
    fields
      .filter(({ kind }) => ["computed", "virtual", "join"].includes(kind))
      .map(({ name }) => name),
  );
  const authorSource = Object.fromEntries(
    Object.entries(source).filter(([name]) => !derivedFields.has(name)),
  );
  const unknownFields = Object.keys(source).filter(
    (name) => !knownFields.has(name),
  );
  const output: Record<string, unknown> = {};
  const issues: Array<{ path: readonly (string | number)[]; message: string }> =
    unknownFields.map((name) => ({
      path: [name],
      message: "Unknown collection field.",
    }));

  for (const field of fields) {
    const visible = isCmsFieldVisible(field, { ...authorSource, ...output });
    const supplied = Object.prototype.hasOwnProperty.call(source, field.name);
    const value = supplied ? source[field.name] : field.defaultValue;
    if (value === undefined) {
      if (field.required && field.kind !== "computed" && visible) {
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
      message: `${subject} failed validation.`,
      retryable: false,
      details: { issues },
    });
  }
  return output;
}

function nestedFieldRecordSchema(
  fields: readonly CmsBuiltInField[],
  containerName: string,
) {
  return z.unknown().transform((value, context) => {
    try {
      return parseFieldRecord(
        fields,
        value,
        `Structured field "${containerName}" data`,
      );
    } catch (error) {
      if (error instanceof CmsError && Array.isArray(error.details?.issues)) {
        for (const issue of error.details.issues) {
          if (!issue || typeof issue !== "object") continue;
          context.addIssue({
            code: "custom",
            path:
              "path" in issue && Array.isArray(issue.path) ? issue.path : [],
            message:
              "message" in issue && typeof issue.message === "string"
                ? issue.message
                : error.message,
          });
        }
        return z.NEVER;
      }
      throw error;
    }
  });
}

export function parseCmsCollectionData<
  TCollection extends CmsCollectionDefinition<
    string,
    readonly CmsBuiltInField[]
  >,
>(collection: TCollection, input: unknown): CmsCollectionData<TCollection> {
  return parseFieldRecord(
    collection.fields,
    input,
    `Collection "${collection.slug}" data`,
  ) as CmsCollectionData<TCollection>;
}

export type CmsCollectionFieldRuntimeContext = Readonly<{
  operation: Extract<CmsFieldOperation, "create" | "update">;
  actorId?: string;
  documentId?: string;
  locale?: string | null;
  previousData?: Readonly<Record<string, unknown>> | null;
}>;

export type CmsCollectionFieldReadContext = Readonly<{
  actorId?: string;
  documentId?: string;
  locale?: string | null;
}>;

type FieldIssue = {
  readonly path: readonly (string | number)[];
  readonly message: string;
};

function cmsFieldContext(input: {
  readonly operation: CmsFieldOperation;
  readonly collection: string;
  readonly actorId?: string;
  readonly documentId?: string;
  readonly locale?: string | null;
  readonly path: readonly (string | number)[];
  readonly data: Readonly<Record<string, unknown>>;
  readonly previousData: Readonly<Record<string, unknown>> | null;
}): CmsFieldLifecycleContext {
  return Object.freeze(input);
}

function appendNestedIssues(
  issues: FieldIssue[],
  prefix: readonly (string | number)[],
  error: unknown,
) {
  if (!(error instanceof CmsError) || !Array.isArray(error.details?.issues)) {
    throw error;
  }
  for (const issue of error.details.issues) {
    if (!issue || typeof issue !== "object") continue;
    issues.push({
      path: [
        ...prefix,
        ...(Array.isArray(issue.path)
          ? issue.path.map((segment: unknown) =>
              typeof segment === "number" ? segment : String(segment),
            )
          : []),
      ],
      message:
        typeof issue.message === "string" ? issue.message : error.message,
    });
  }
}

function valuesEqual(left: unknown, right: unknown) {
  if (Object.is(left, right)) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

async function parseFieldRecordAsync(
  fields: readonly CmsBuiltInField[],
  input: unknown,
  runtime: Omit<CmsFieldLifecycleContext, "path" | "data" | "previousData">,
  previousData: Readonly<Record<string, unknown>> | null,
  subject: string,
  path: readonly (string | number)[] = [],
): Promise<Record<string, unknown>> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `${subject} must be an object.`,
      retryable: false,
    });
  }

  const source = input as Record<string, unknown>;
  const knownFields = new Set(fields.map((field) => field.name));
  const derivedFields = new Set(
    fields
      .filter(({ kind }) => ["computed", "virtual", "join"].includes(kind))
      .map(({ name }) => name),
  );
  const authorSource = Object.fromEntries(
    Object.entries(source).filter(([name]) => !derivedFields.has(name)),
  );
  const output: Record<string, unknown> = {};
  const issues: FieldIssue[] = Object.keys(source)
    .filter((name) => !knownFields.has(name))
    .map((name) => ({
      path: [...path, name],
      message: "Unknown collection field.",
    }));

  for (const field of fields) {
    const fieldPath = [...path, field.name];
    const visible = isCmsFieldVisible(field, { ...authorSource, ...output });
    const supplied = Object.prototype.hasOwnProperty.call(source, field.name);
    const previousValue = previousData?.[field.name];
    let rawValue = supplied ? source[field.name] : field.defaultValue;
    const context = cmsFieldContext({
      ...runtime,
      path: fieldPath,
      data: { ...authorSource, ...output },
      previousData,
    });
    if (field.kind === "virtual" || field.kind === "join") continue;
    if (field.kind === "computed") {
      rawValue = await field.compute(context);
    }
    const access = (field as CmsFieldDefinition).access?.[runtime.operation];
    const permitted = access ? await access(context) : true;
    if (!permitted) {
      if (
        supplied &&
        (runtime.operation === "create" ||
          !valuesEqual(rawValue, previousValue))
      ) {
        throw new CmsError({
          code: "FORBIDDEN",
          message: `Field "${fieldPath.join(".")}" cannot be changed.`,
          retryable: false,
          details: { operation: runtime.operation, path: fieldPath },
        });
      }
      if (runtime.operation === "update" && previousValue !== undefined) {
        output[field.name] = previousValue;
        continue;
      }
    }
    if (rawValue === undefined) {
      if (field.required && visible) {
        issues.push({
          path: fieldPath,
          message: "Required field is missing.",
        });
      }
      continue;
    }

    try {
      const callbacks = field as CmsFieldDefinition;
      const normalized = callbacks.hooks?.beforeValidate
        ? await callbacks.hooks.beforeValidate(rawValue, context)
        : rawValue;
      let parsed: unknown;
      if (field.kind === "group") {
        parsed = await parseFieldRecordAsync(
          field.fields as readonly CmsBuiltInField[],
          normalized,
          runtime,
          previousValue &&
            typeof previousValue === "object" &&
            !Array.isArray(previousValue)
            ? (previousValue as Record<string, unknown>)
            : null,
          `Structured field "${field.name}" data`,
          fieldPath,
        );
      } else if (field.kind === "array") {
        if (!Array.isArray(normalized)) {
          throw new CmsError({
            code: "VALIDATION_FAILED",
            message: `Structured field "${field.name}" data must be an array.`,
            retryable: false,
            details: {
              issues: [{ path: [], message: "Expected an array." }],
            },
          });
        }
        const { minItems, maxItems } = field.validation ?? {};
        if (minItems !== undefined && normalized.length < minItems) {
          issues.push({
            path: fieldPath,
            message: `Expected at least ${minItems} items.`,
          });
          continue;
        }
        if (maxItems !== undefined && normalized.length > maxItems) {
          issues.push({
            path: fieldPath,
            message: `Expected at most ${maxItems} items.`,
          });
          continue;
        }
        const previousItems = Array.isArray(previousValue) ? previousValue : [];
        parsed = await Promise.all(
          normalized.map((item, index) =>
            parseFieldRecordAsync(
              field.fields as readonly CmsBuiltInField[],
              item,
              runtime,
              previousItems[index] &&
                typeof previousItems[index] === "object" &&
                !Array.isArray(previousItems[index])
                ? (previousItems[index] as Record<string, unknown>)
                : null,
              `Structured field "${field.name}" item`,
              [...fieldPath, index],
            ),
          ),
        );
      } else {
        const result = schemaForField(field).safeParse(normalized);
        if (!result.success) {
          issues.push(
            ...result.error.issues.map((issue) => ({
              path: [
                ...fieldPath,
                ...issue.path.map((segment) =>
                  typeof segment === "symbol" ? String(segment) : segment,
                ),
              ],
              message: issue.message,
            })),
          );
          continue;
        }
        parsed = result.data;
      }
      const validation = callbacks.validateAsync
        ? await callbacks.validateAsync(parsed, context)
        : undefined;
      if (typeof validation === "string") {
        issues.push({ path: fieldPath, message: validation });
        continue;
      }
      if (Array.isArray(validation) && validation.length) {
        issues.push(
          ...validation.map((message) => ({ path: fieldPath, message })),
        );
        continue;
      }
      await callbacks.hooks?.afterValidate?.(parsed, context);
      output[field.name] = parsed;
    } catch (error) {
      appendNestedIssues(issues, [], error);
    }
  }

  if (issues.length) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `${subject} failed validation.`,
      retryable: false,
      details: { issues },
    });
  }
  return output;
}

/** Server mutation parser with field access, hooks, and async validation. */
export async function parseCmsCollectionDataAsync<
  TCollection extends CmsCollectionDefinition<
    string,
    readonly CmsBuiltInField[]
  >,
>(
  collection: TCollection,
  input: unknown,
  context: CmsCollectionFieldRuntimeContext,
): Promise<CmsCollectionData<TCollection>> {
  return parseFieldRecordAsync(
    collection.fields,
    input,
    {
      operation: context.operation,
      collection: collection.slug,
      actorId: context.actorId,
      documentId: context.documentId,
      locale: context.locale,
    },
    context.previousData ?? null,
    `Collection "${collection.slug}" data`,
  ) as Promise<CmsCollectionData<TCollection>>;
}

async function serializeFieldRecordForRead(
  fields: readonly CmsBuiltInField[],
  data: Readonly<Record<string, unknown>>,
  runtime: Omit<CmsFieldLifecycleContext, "path" | "data" | "previousData">,
  path: readonly (string | number)[] = [],
): Promise<Record<string, unknown>> {
  const output: Record<string, unknown> = {};
  for (const field of fields) {
    const fieldPath = [...path, field.name];
    const context = cmsFieldContext({
      ...runtime,
      path: fieldPath,
      data,
      previousData: null,
    });
    const access = (field as CmsFieldDefinition).access?.read;
    if (access && !(await access(context))) continue;
    let value = data[field.name];
    if (field.kind === "virtual" || field.kind === "join") {
      value = await field.resolve(context);
      const parsed = schemaForField(field).safeParse(value);
      if (!parsed.success) {
        throw new CmsError({
          code: "VALIDATION_FAILED",
          message: `Derived field "${fieldPath.join(".")}" failed validation.`,
          retryable: false,
          details: {
            issues: parsed.error.issues.map((issue) => ({
              path: [...fieldPath, ...issue.path],
              message: issue.message,
            })),
          },
        });
      }
      output[field.name] = parsed.data;
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(data, field.name)) continue;
    if (
      field.kind === "group" &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      output[field.name] = await serializeFieldRecordForRead(
        field.fields as readonly CmsBuiltInField[],
        value as Record<string, unknown>,
        runtime,
        fieldPath,
      );
    } else if (field.kind === "array" && Array.isArray(value)) {
      output[field.name] = await Promise.all(
        value.map((item, index) =>
          item && typeof item === "object" && !Array.isArray(item)
            ? serializeFieldRecordForRead(
                field.fields as readonly CmsBuiltInField[],
                item as Record<string, unknown>,
                runtime,
                [...fieldPath, index],
              )
            : item,
        ),
      );
    } else {
      output[field.name] = value;
    }
  }
  return output;
}

/** Validates storage data, then omits fields denied by runtime read access. */
export async function serializeCmsCollectionDataForRead<
  TCollection extends CmsCollectionDefinition<
    string,
    readonly CmsBuiltInField[]
  >,
>(
  collection: TCollection,
  input: unknown,
  context: CmsCollectionFieldReadContext = {},
): Promise<Partial<CmsCollectionData<TCollection>>> {
  const data = parseCmsCollectionData(collection, input) as Record<
    string,
    unknown
  >;
  return serializeFieldRecordForRead(collection.fields, data, {
    operation: "read",
    collection: collection.slug,
    actorId: context.actorId,
    documentId: context.documentId,
    locale: context.locale,
  }) as Promise<Partial<CmsCollectionData<TCollection>>>;
}

function canonicalFieldRecord(
  fields: readonly CmsBuiltInField[],
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const field of fields) {
    if (
      field.kind === "virtual" ||
      field.kind === "join" ||
      !Object.prototype.hasOwnProperty.call(input, field.name)
    ) {
      continue;
    }
    const value = input[field.name];
    if (
      field.kind === "group" &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      output[field.name] = canonicalFieldRecord(
        field.fields as readonly CmsBuiltInField[],
        value as Record<string, unknown>,
      );
    } else if (field.kind === "array" && Array.isArray(value)) {
      output[field.name] = value.map((item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? canonicalFieldRecord(
              field.fields as readonly CmsBuiltInField[],
              item as Record<string, unknown>,
            )
          : item,
      );
    } else {
      output[field.name] = value;
    }
  }
  return output;
}

/** Removes read-time virtual/join projections before backup, diff, or import. */
export function toCmsCanonicalCollectionData(
  collection: CmsCollectionDefinition<string, readonly CmsBuiltInField[]>,
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return canonicalFieldRecord(collection.fields, input);
}
