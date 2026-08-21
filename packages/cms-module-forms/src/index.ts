import {
  booleanField,
  dateField,
  defineCmsExtensionPackageManifest,
  defineCmsFeatureModuleManifest,
  defineCollection,
  defineFeatureModule,
  emailField,
  jsonField,
  selectField,
  textField,
} from "@agency/cms-core";

export const cmsFormsExtensionManifest = defineCmsExtensionPackageManifest({
  schemaVersion: 1,
  id: "official/forms",
  packageName: "@agency/cms-module-forms",
  version: "0.1.0",
  classification: "official",
  cmsCompatibility: { minimum: "0.1.0", maximumExclusive: "1.0.0" },
  permissions: [
    {
      id: "official/forms/manage",
      capability: "leads.manage",
      description: "Review, export, and erase consent-bearing lead data.",
    },
  ],
  secrets: [],
  routes: [],
  admin: [
    {
      id: "official/forms/navigation",
      slot: "navigation",
      label: "Forms and leads",
      requiredCapability: "leads.manage",
    },
  ],
  entrypoints: [
    {
      id: "official/forms/shared",
      export: ".",
      runtime: "shared",
      capabilities: [],
    },
  ],
  data: {
    schemaVersion: 1,
    migrations: [
      { id: "official/forms/v1", from: 0, to: 1, reversible: false },
    ],
    uninstall: {
      policy: "export-then-delete",
      description:
        "Export consent-bearing leads before deleting form-owned personal data.",
    },
  },
});

const formAccess = {
  read: [] as const,
  create: ["content.write"] as const,
  update: ["content.write"] as const,
  delete: ["content.delete"] as const,
  publish: ["content.publish"] as const,
};

const leadAccess = {
  read: ["leads.manage"] as const,
  create: [] as const,
  update: ["leads.manage"] as const,
  delete: ["leads.manage"] as const,
  publish: ["leads.manage"] as const,
};

export const cmsFormsCollection = defineCollection({
  slug: "cms-forms",
  labels: { singular: "Form", plural: "Forms" },
  schemaVersion: 1,
  lifecycle: { drafts: true, revisions: true, scheduling: false },
  access: formAccess,
  fields: [
    textField({ name: "title", label: "Title", required: true }),
    textField({
      name: "formKey",
      label: "Form key",
      required: true,
      unique: true,
      indexed: true,
      validation: { pattern: "^[a-z][a-z0-9-]{1,63}$" },
    }),
    jsonField({
      name: "definition",
      label: "Field definition",
      required: true,
    }),
    booleanField({ name: "enabled", label: "Enabled", defaultValue: true }),
  ],
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "formKey", "enabled"],
  },
});

export const cmsLeadsCollection = defineCollection({
  slug: "cms-leads",
  labels: { singular: "Lead", plural: "Leads" },
  schemaVersion: 1,
  lifecycle: { drafts: false, revisions: false, scheduling: false },
  access: leadAccess,
  fields: [
    textField({
      name: "submissionId",
      label: "Submission ID",
      required: true,
      unique: true,
      indexed: true,
    }),
    textField({
      name: "formKey",
      label: "Form key",
      required: true,
      indexed: true,
    }),
    emailField({ name: "email", label: "Email" }),
    jsonField({ name: "data", label: "Submitted data", required: true }),
    jsonField({ name: "consent", label: "Consent receipt", required: true }),
    selectField({
      name: "status",
      label: "Status",
      required: true,
      multiple: false,
      defaultValue: "new",
      options: [
        { label: "New", value: "new" },
        { label: "Contacted", value: "contacted" },
        { label: "Qualified", value: "qualified" },
        { label: "Archived", value: "archived" },
      ] as const,
    }),
    dateField({
      name: "submittedAt",
      label: "Submitted at",
      required: true,
      mode: "datetime",
    }),
  ],
  admin: {
    useAsTitle: "submissionId",
    defaultColumns: ["formKey", "email", "status", "submittedAt"],
  },
});

export const cmsFormsModule = defineFeatureModule({
  id: "official-forms",
  manifest: defineCmsFeatureModuleManifest({
    schemaVersion: 1,
    packageName: "@agency/cms-module-forms",
    version: "0.1.0",
    cmsCompatibility: { minimum: "0.1.0", maximumExclusive: "1.0.0" },
    uninstall: {
      dataPolicy: "export-then-delete",
      description:
        "Export consent-bearing leads before deleting form-owned personal data.",
    },
  }),
  collections: [cmsFormsCollection, cmsLeadsCollection],
  permissions: [
    {
      id: "official-forms/manage",
      capability: "leads.manage",
      collection: cmsLeadsCollection.slug,
      operations: ["update", "delete"],
      description: "Review, export, and erase submitted lead data.",
    },
  ],
  migrations: [
    {
      id: "official-forms/v1",
      from: 0,
      to: 1,
      migrate: (state) => state ?? { forms: [], leads: [] },
    },
  ],
  admin: [
    {
      id: "official-forms/navigation",
      collection: cmsFormsCollection.slug,
      placement: "navigation",
      label: "Forms",
    },
    {
      id: "official-forms/leads",
      collection: cmsLeadsCollection.slug,
      placement: "navigation",
      label: "Leads",
    },
  ],
});

export type CmsFormFieldType =
  "text" | "email" | "textarea" | "select" | "checkbox";

export type CmsFormField = Readonly<{
  name: string;
  label: string;
  type: CmsFormFieldType;
  required?: boolean;
  maxLength?: number;
  options?: readonly Readonly<{ label: string; value: string }>[];
}>;

export type CmsFormDefinition = Readonly<{
  key: string;
  fields: readonly CmsFormField[];
  consent?: Readonly<{
    field: string;
    policyVersion: string;
    required: boolean;
  }>;
  honeypotField?: string;
  rateLimit?: Readonly<{ limit: number; windowMs: number }>;
}>;

export type CmsNormalizedFormDefinition = Readonly<{
  key: string;
  fields: readonly CmsFormField[];
  consent: Readonly<{
    field: string;
    policyVersion: string;
    required: boolean;
  }> | null;
  honeypotField: string;
  rateLimit: Readonly<{ limit: number; windowMs: number }>;
}>;

const formKeyPattern = /^[a-z][a-z0-9-]{1,63}$/;
const fieldNamePattern = /^[a-z][a-zA-Z0-9_]{0,63}$/;

function assertFieldName(value: string, label: string) {
  if (!fieldNamePattern.test(value))
    throw new Error(`Invalid ${label}: ${value}`);
  return value;
}

export function normalizeCmsFormDefinition(
  input: CmsFormDefinition | CmsNormalizedFormDefinition,
): CmsNormalizedFormDefinition {
  if (!formKeyPattern.test(input.key))
    throw new Error(`Invalid form key: ${input.key}`);
  if (!input.fields.length || input.fields.length > 100)
    throw new Error("A form must contain 1-100 fields.");
  const names = new Set<string>();
  const fields = input.fields.map((field) => {
    const name = assertFieldName(field.name, "form field name");
    if (names.has(name)) throw new Error(`Duplicate form field: ${name}`);
    names.add(name);
    const label = field.label.trim();
    if (!label || label.length > 200)
      throw new Error(`Invalid label for form field: ${name}`);
    const maxLength =
      field.maxLength ?? (field.type === "textarea" ? 10_000 : 500);
    if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > 100_000) {
      throw new Error(`Invalid maxLength for form field: ${name}`);
    }
    const options = field.options?.map((option) => ({
      label: option.label.trim(),
      value: option.value.trim(),
    }));
    if (field.type === "select") {
      if (
        !options?.length ||
        options.length > 100 ||
        options.some(({ label: optionLabel, value }) => !optionLabel || !value)
      ) {
        throw new Error(`Select form field ${name} requires 1-100 options.`);
      }
      if (new Set(options.map(({ value }) => value)).size !== options.length) {
        throw new Error(`Select form field ${name} contains duplicate values.`);
      }
    } else if (options?.length)
      throw new Error(`Only select form fields may declare options: ${name}`);
    return Object.freeze({
      name,
      label,
      type: field.type,
      required: field.required ?? false,
      maxLength,
      ...(options
        ? {
            options: Object.freeze(
              options.map((option) => Object.freeze(option)),
            ),
          }
        : {}),
    });
  });
  const honeypotField = assertFieldName(
    input.honeypotField ?? "website",
    "honeypot field",
  );
  if (names.has(honeypotField))
    throw new Error("Honeypot field must not overlap a public form field.");
  const consent = input.consent
    ? Object.freeze({
        field: assertFieldName(input.consent.field, "consent field"),
        policyVersion: input.consent.policyVersion.trim(),
        required: input.consent.required,
      })
    : null;
  if (
    consent &&
    (!names.has(consent.field) ||
      !consent.policyVersion ||
      consent.policyVersion.length > 100)
  ) {
    throw new Error(
      "Consent must reference a declared field and bounded policy version.",
    );
  }
  const rateLimit = input.rateLimit ?? { limit: 5, windowMs: 60_000 };
  if (
    !Number.isInteger(rateLimit.limit) ||
    rateLimit.limit < 1 ||
    rateLimit.limit > 1_000
  ) {
    throw new Error("Form rate limit must be between 1 and 1000.");
  }
  if (
    !Number.isInteger(rateLimit.windowMs) ||
    rateLimit.windowMs < 1_000 ||
    rateLimit.windowMs > 86_400_000
  ) {
    throw new Error(
      "Form rate-limit window must be between one second and one day.",
    );
  }
  return Object.freeze({
    key: input.key,
    fields: Object.freeze(fields),
    consent,
    honeypotField,
    rateLimit: Object.freeze(rateLimit),
  });
}

export type CmsFormValidationResult = Readonly<{
  valid: boolean;
  data: Readonly<Record<string, string | boolean>>;
  errors: Readonly<Record<string, string>>;
}>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCmsFormSubmission(
  definitionInput: CmsFormDefinition | CmsNormalizedFormDefinition,
  raw: Readonly<Record<string, unknown>>,
): CmsFormValidationResult {
  const definition = normalizeCmsFormDefinition(definitionInput);
  const allowed = new Set([
    ...definition.fields.map(({ name }) => name),
    definition.honeypotField,
  ]);
  const unexpected = Object.keys(raw).find((key) => !allowed.has(key));
  if (unexpected) throw new Error(`Unexpected form field: ${unexpected}`);
  const errors: Record<string, string> = {};
  const data: Record<string, string | boolean> = {};
  for (const field of definition.fields) {
    const value = raw[field.name];
    if (field.type === "checkbox") {
      if (value !== undefined && typeof value !== "boolean")
        errors[field.name] = "Must be a boolean.";
      const checked = value === true;
      if (field.required && !checked)
        errors[field.name] = "This field is required.";
      data[field.name] = checked;
      continue;
    }
    if (value !== undefined && typeof value !== "string") {
      errors[field.name] = "Must be text.";
      continue;
    }
    const normalized = typeof value === "string" ? value.trim() : "";
    if (field.required && !normalized)
      errors[field.name] = "This field is required.";
    else if (normalized.length > (field.maxLength ?? 500))
      errors[field.name] = "Exceeds the maximum length.";
    else if (
      field.type === "email" &&
      normalized &&
      !emailPattern.test(normalized)
    )
      errors[field.name] = "Must be a valid email address.";
    else if (
      field.type === "select" &&
      normalized &&
      !field.options?.some(({ value: option }) => option === normalized)
    )
      errors[field.name] = "Must select an allowed option.";
    data[field.name] = normalized;
  }
  if (definition.consent?.required && data[definition.consent.field] !== true) {
    errors[definition.consent.field] = "Consent is required.";
  }
  return Object.freeze({
    valid: !Object.keys(errors).length,
    data: Object.freeze(data),
    errors: Object.freeze(errors),
  });
}

export interface CmsFormRateLimiter {
  consume(input: {
    key: string;
    limit: number;
    windowMs: number;
    now: Date;
  }): Promise<boolean>;
}

export interface CmsFormSpamGuard {
  check(input: {
    formKey: string;
    data: Readonly<Record<string, string | boolean>>;
    token?: string;
  }): Promise<{ allowed: boolean; reason?: string }>;
}

export type CmsLeadRecord = Readonly<{
  submissionId: string;
  formKey: string;
  data: Readonly<Record<string, string | boolean>>;
  consent: Readonly<{
    policyVersion: string;
    accepted: boolean;
    recordedAt: string;
  }> | null;
  submittedAt: string;
}>;

export interface CmsLeadStore {
  create(record: CmsLeadRecord, idempotencyKey: string): Promise<CmsLeadRecord>;
}

export interface CmsFormEventDispatcher {
  dispatch(input: {
    topic: "forms.lead.created";
    lead: CmsLeadRecord;
    idempotencyKey: string;
    notify: boolean;
    webhook: boolean;
  }): Promise<void>;
}

export class CmsFormSubmissionError extends Error {
  constructor(
    readonly code: "INVALID" | "SPAM" | "RATE_LIMITED",
    message: string,
    readonly errors: Readonly<Record<string, string>> = {},
  ) {
    super(message);
    this.name = "CmsFormSubmissionError";
  }
}

export function createCmsFormSubmissionService(input: {
  store: CmsLeadStore;
  rateLimiter: CmsFormRateLimiter;
  spamGuard: CmsFormSpamGuard;
  events: CmsFormEventDispatcher;
  createSubmissionId: () => string;
  now?: () => Date;
}) {
  return Object.freeze({
    async submit(request: {
      definition: CmsFormDefinition;
      values: Readonly<Record<string, unknown>>;
      /** A privacy-preserving HMAC/hash of the requester identity, never a raw IP. */
      actorKey: string;
      idempotencyKey: string;
      spamToken?: string;
      notify?: boolean;
      webhook?: boolean;
    }) {
      const definition = normalizeCmsFormDefinition(request.definition);
      if (!request.idempotencyKey.trim() || request.idempotencyKey.length > 256)
        throw new Error("A bounded idempotency key is required.");
      if (!/^[a-f0-9]{32,128}$/i.test(request.actorKey))
        throw new Error(
          "actorKey must be a one-way privacy-preserving digest.",
        );
      if (request.values[definition.honeypotField])
        throw new CmsFormSubmissionError("SPAM", "Submission rejected.");
      const now = input.now?.() ?? new Date();
      const allowed = await input.rateLimiter.consume({
        key: `${definition.key}:${request.actorKey}`,
        ...definition.rateLimit,
        now,
      });
      if (!allowed)
        throw new CmsFormSubmissionError(
          "RATE_LIMITED",
          "Too many submissions.",
        );
      const validation = validateCmsFormSubmission(definition, request.values);
      if (!validation.valid)
        throw new CmsFormSubmissionError(
          "INVALID",
          "Submission validation failed.",
          validation.errors,
        );
      const spam = await input.spamGuard.check({
        formKey: definition.key,
        data: validation.data,
        ...(request.spamToken ? { token: request.spamToken } : {}),
      });
      if (!spam.allowed)
        throw new CmsFormSubmissionError(
          "SPAM",
          spam.reason ?? "Submission rejected.",
        );
      const recordedAt = now.toISOString();
      const lead = Object.freeze({
        submissionId: input.createSubmissionId(),
        formKey: definition.key,
        data: validation.data,
        consent: definition.consent
          ? Object.freeze({
              policyVersion: definition.consent.policyVersion,
              accepted: validation.data[definition.consent.field] === true,
              recordedAt,
            })
          : null,
        submittedAt: recordedAt,
      });
      const stored = await input.store.create(lead, request.idempotencyKey);
      await input.events.dispatch({
        topic: "forms.lead.created",
        lead: stored,
        idempotencyKey: `${request.idempotencyKey}/event`,
        notify: request.notify ?? true,
        webhook: request.webhook ?? true,
      });
      return stored;
    },
  });
}

function safeCsvCell(value: unknown) {
  let serialized = typeof value === "string" ? value : JSON.stringify(value);
  if (/^[=+\-@]/.test(serialized)) serialized = `'${serialized}`;
  return /[",\r\n]/.test(serialized)
    ? `"${serialized.replaceAll('"', '""')}"`
    : serialized;
}

export function exportCmsLeadsCsv(records: readonly CmsLeadRecord[]) {
  const fields = [
    ...new Set(records.flatMap(({ data }) => Object.keys(data))),
  ].sort();
  const header = [
    "submissionId",
    "formKey",
    "submittedAt",
    "consentPolicyVersion",
    ...fields,
  ];
  const rows = [...records]
    .sort(
      (left, right) =>
        left.submittedAt.localeCompare(right.submittedAt) ||
        left.submissionId.localeCompare(right.submissionId),
    )
    .map((record) =>
      [
        record.submissionId,
        record.formKey,
        record.submittedAt,
        record.consent?.policyVersion ?? "",
        ...fields.map((field) => record.data[field] ?? ""),
      ]
        .map(safeCsvCell)
        .join(","),
    );
  return [header.join(","), ...rows].join("\n");
}

export function exportCmsLeadsJson(records: readonly CmsLeadRecord[]) {
  return JSON.stringify(
    [...records].sort(
      (left, right) =>
        left.submittedAt.localeCompare(right.submittedAt) ||
        left.submissionId.localeCompare(right.submissionId),
    ),
  );
}
