import {
  booleanField,
  dateField,
  defineCmsExtensionPackageManifest,
  defineCmsFeatureModuleManifest,
  defineCollection,
  defineFeatureModule,
  jsonField,
  selectField,
  textField,
} from "@agency/cms-core";

export const cmsPrivacyExtensionManifest = defineCmsExtensionPackageManifest({
  schemaVersion: 1,
  id: "official/privacy",
  packageName: "@agency/cms-module-privacy",
  version: "0.1.0",
  classification: "official",
  cmsCompatibility: { minimum: "0.1.0", maximumExclusive: "1.0.0" },
  permissions: [
    {
      id: "official/privacy/policy",
      capability: "settings.manage",
      description:
        "Configure privacy classifications, retention, and legal holds.",
    },
    {
      id: "official/privacy/export",
      capability: "audit.read",
      description: "Export subject data and redacted audit evidence.",
    },
    {
      id: "official/privacy/erase",
      capability: "content.delete",
      description:
        "Execute reviewed subject-erasure plans not blocked by policy.",
    },
  ],
  secrets: [],
  routes: [
    {
      id: "official/privacy/export",
      path: "/api/cms/privacy/export",
      methods: ["POST"],
      authorization: "session",
      mutationProtection: "same-origin",
    },
    {
      id: "official/privacy/erase",
      path: "/api/cms/privacy/erase",
      methods: ["POST"],
      authorization: "session",
      mutationProtection: "same-origin",
    },
  ],
  admin: [
    {
      id: "official/privacy/navigation",
      slot: "navigation",
      label: "Privacy and compliance",
      requiredCapability: "settings.manage",
    },
    {
      id: "official/privacy/dashboard",
      slot: "dashboard",
      label: "Compliance status",
      requiredCapability: "audit.read",
    },
  ],
  entrypoints: [
    {
      id: "official/privacy/server",
      export: ".",
      runtime: "server",
      capabilities: ["settings.manage", "audit.read", "content.delete"],
    },
  ],
  data: {
    schemaVersion: 1,
    migrations: [
      { id: "official/privacy/v1", from: 0, to: 1, reversible: false },
    ],
    uninstall: {
      policy: "export-then-delete",
      description:
        "Export consent, request, legal-hold, and policy evidence before deleting privacy-owned data.",
    },
  },
});

const policyAccess = {
  read: ["settings.manage"] as const,
  create: ["settings.manage"] as const,
  update: ["settings.manage"] as const,
  delete: ["settings.manage"] as const,
  publish: ["settings.manage"] as const,
};

const evidenceAccess = {
  read: ["audit.read"] as const,
  create: [] as const,
  update: ["settings.manage"] as const,
  delete: ["content.delete"] as const,
  publish: ["settings.manage"] as const,
};

export const cmsPrivacyPoliciesCollection = defineCollection({
  slug: "cms-privacy-policies",
  labels: { singular: "Privacy policy", plural: "Privacy policies" },
  schemaVersion: 1,
  lifecycle: { drafts: true, revisions: true, scheduling: false },
  access: policyAccess,
  fields: [
    textField({
      name: "policyId",
      label: "Policy ID",
      required: true,
      unique: true,
      indexed: true,
    }),
    textField({ name: "version", label: "Version", required: true }),
    textField({ name: "region", label: "Region", required: true }),
    jsonField({
      name: "rules",
      label: "Classification and retention rules",
      required: true,
    }),
    booleanField({ name: "active", label: "Active", defaultValue: false }),
  ],
  admin: {
    useAsTitle: "policyId",
    defaultColumns: ["policyId", "version", "region", "active"],
  },
});

export const cmsPrivacyConsentsCollection = defineCollection({
  slug: "cms-privacy-consents",
  labels: { singular: "Consent record", plural: "Consent records" },
  schemaVersion: 1,
  lifecycle: { drafts: false, revisions: false, scheduling: false },
  access: evidenceAccess,
  fields: [
    textField({
      name: "recordId",
      label: "Record ID",
      required: true,
      unique: true,
      indexed: true,
    }),
    textField({
      name: "subjectId",
      label: "Subject ID",
      required: true,
      indexed: true,
    }),
    textField({
      name: "purpose",
      label: "Purpose",
      required: true,
      indexed: true,
    }),
    textField({
      name: "policyVersion",
      label: "Policy version",
      required: true,
    }),
    selectField({
      name: "status",
      label: "Status",
      required: true,
      multiple: false,
      options: [
        { label: "Granted", value: "granted" },
        { label: "Withdrawn", value: "withdrawn" },
      ] as const,
    }),
    jsonField({ name: "proof", label: "Proof", required: true }),
    dateField({
      name: "recordedAt",
      label: "Recorded at",
      required: true,
      mode: "datetime",
    }),
  ],
  admin: {
    useAsTitle: "recordId",
    defaultColumns: ["subjectId", "purpose", "status", "recordedAt"],
  },
});

export const cmsPrivacyRequestsCollection = defineCollection({
  slug: "cms-privacy-requests",
  labels: { singular: "Privacy request", plural: "Privacy requests" },
  schemaVersion: 1,
  lifecycle: { drafts: true, revisions: true, scheduling: false },
  access: evidenceAccess,
  fields: [
    textField({
      name: "requestId",
      label: "Request ID",
      required: true,
      unique: true,
      indexed: true,
    }),
    textField({
      name: "subjectId",
      label: "Subject ID",
      required: true,
      indexed: true,
    }),
    selectField({
      name: "kind",
      label: "Request kind",
      required: true,
      multiple: false,
      options: [
        { label: "Export", value: "export" },
        { label: "Erase", value: "erase" },
      ] as const,
    }),
    selectField({
      name: "status",
      label: "Status",
      required: true,
      multiple: false,
      options: [
        { label: "Pending", value: "pending" },
        { label: "Completed", value: "completed" },
        { label: "Blocked", value: "blocked" },
      ] as const,
    }),
    dateField({
      name: "requestedAt",
      label: "Requested at",
      required: true,
      mode: "datetime",
    }),
    jsonField({ name: "receipt", label: "Receipt" }),
  ],
  admin: {
    useAsTitle: "requestId",
    defaultColumns: ["subjectId", "kind", "status", "requestedAt"],
  },
});

export const cmsPrivacyLegalHoldsCollection = defineCollection({
  slug: "cms-privacy-legal-holds",
  labels: { singular: "Legal hold", plural: "Legal holds" },
  schemaVersion: 1,
  lifecycle: { drafts: true, revisions: true, scheduling: false },
  access: policyAccess,
  fields: [
    textField({
      name: "holdId",
      label: "Hold ID",
      required: true,
      unique: true,
      indexed: true,
    }),
    textField({ name: "reason", label: "Reason", required: true }),
    jsonField({ name: "scope", label: "Scope", required: true }),
    booleanField({ name: "active", label: "Active", defaultValue: true }),
    dateField({
      name: "startsAt",
      label: "Starts at",
      required: true,
      mode: "datetime",
    }),
    dateField({ name: "expiresAt", label: "Expires at", mode: "datetime" }),
  ],
  admin: {
    useAsTitle: "holdId",
    defaultColumns: ["reason", "active", "startsAt", "expiresAt"],
  },
});

export const cmsPrivacyModule = defineFeatureModule({
  id: "official-privacy",
  manifest: defineCmsFeatureModuleManifest({
    schemaVersion: 1,
    packageName: "@agency/cms-module-privacy",
    version: "0.1.0",
    cmsCompatibility: { minimum: "0.1.0", maximumExclusive: "1.0.0" },
    uninstall: {
      dataPolicy: "export-then-delete",
      description:
        "Export compliance evidence before deleting privacy-owned data.",
    },
  }),
  collections: [
    cmsPrivacyPoliciesCollection,
    cmsPrivacyConsentsCollection,
    cmsPrivacyRequestsCollection,
    cmsPrivacyLegalHoldsCollection,
  ],
  permissions: [
    {
      id: "official-privacy/manage",
      capability: "settings.manage",
      operations: ["create", "update", "publish"],
      description: "Manage privacy policies, retention, and legal holds.",
    },
    {
      id: "official-privacy/erase",
      capability: "content.delete",
      operations: ["delete"],
      description: "Execute reviewed and unblocked data erasure.",
    },
  ],
  migrations: [
    {
      id: "official-privacy/v1",
      from: 0,
      to: 1,
      migrate: (state) =>
        state ?? { policies: [], consents: [], requests: [], legalHolds: [] },
    },
  ],
  admin: [
    {
      id: "official-privacy/navigation",
      collection: cmsPrivacyPoliciesCollection.slug,
      placement: "navigation",
      label: "Privacy",
    },
    {
      id: "official-privacy/dashboard",
      collection: cmsPrivacyRequestsCollection.slug,
      placement: "dashboard",
      label: "Compliance status",
    },
  ],
});

export const cmsPiiClassifications = Object.freeze([
  "identifier",
  "contact",
  "demographic",
  "financial",
  "health",
  "location",
  "online",
  "sensitive",
] as const);
export type CmsPiiClassification = (typeof cmsPiiClassifications)[number];
export type CmsPrivacyEraseStrategy =
  "delete-document" | "remove-field" | "anonymize" | "retain";

export type CmsPiiFieldRule = Readonly<{
  collection: string;
  fieldPath: string;
  classification: CmsPiiClassification;
  purpose: string;
  lawfulBasis:
    "consent" | "contract" | "legal-obligation" | "legitimate-interest";
  subjectKey?: boolean;
  retentionDays: number;
  erase: CmsPrivacyEraseStrategy;
}>;

export type CmsPrivacyPolicy = Readonly<{
  id: string;
  version: string;
  region: string;
  rules: readonly CmsPiiFieldRule[];
}>;

const lawfulBases = Object.freeze([
  "consent",
  "contract",
  "legal-obligation",
  "legitimate-interest",
] as const);
const eraseStrategies = Object.freeze([
  "delete-document",
  "remove-field",
  "anonymize",
  "retain",
] as const);

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const collectionPattern = /^[a-z][a-z0-9-]{1,63}$/;
const fieldPathPattern =
  /^[A-Za-z_][A-Za-z0-9_-]*(?:\.[A-Za-z_][A-Za-z0-9_-]*)*$/;
const versionPattern =
  /^(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)){0,2}(?:-[0-9A-Za-z.-]+)?$/;

function text(value: string, label: string, maximum = 256) {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    throw new Error(`${label} must contain 1-${maximum} characters.`);
  }
  return normalized;
}

function identifier(value: string, label: string) {
  const normalized = text(value, label, 128);
  if (!idPattern.test(normalized))
    throw new Error(`${label} has an invalid format.`);
  return normalized;
}

function date(value: string | Date, label: string) {
  const normalized =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(normalized.getTime()))
    throw new Error(`${label} must be valid.`);
  return normalized;
}

function normalizeFieldPath(value: string) {
  const normalized = text(value, "Field path", 256);
  if (!fieldPathPattern.test(normalized))
    throw new Error(`Invalid field path "${normalized}".`);
  return normalized;
}

function normalizeCollection(value: string) {
  const normalized = text(value, "Collection", 64);
  if (!collectionPattern.test(normalized))
    throw new Error(`Invalid collection "${normalized}".`);
  return normalized;
}

export function defineCmsPrivacyPolicy(
  input: CmsPrivacyPolicy,
): CmsPrivacyPolicy {
  const id = identifier(input.id, "Policy ID");
  const version = text(input.version, "Policy version", 64);
  if (!versionPattern.test(version))
    throw new Error("Policy version is invalid.");
  const region = text(input.region, "Policy region", 64);
  if (!input.rules.length || input.rules.length > 500) {
    throw new Error("A privacy policy requires 1-500 rules.");
  }
  const seen = new Set<string>();
  const subjectKeys = new Set<string>();
  const rules = input.rules.map((rule) => {
    const collection = normalizeCollection(rule.collection);
    const fieldPath = normalizeFieldPath(rule.fieldPath);
    const key = `${collection}:${fieldPath}`;
    if (seen.has(key)) throw new Error(`Duplicate privacy rule "${key}".`);
    seen.add(key);
    if (!cmsPiiClassifications.includes(rule.classification)) {
      throw new Error(`Invalid PII classification for "${key}".`);
    }
    if (!lawfulBases.includes(rule.lawfulBasis)) {
      throw new Error(`Invalid lawful basis for "${key}".`);
    }
    if (!eraseStrategies.includes(rule.erase)) {
      throw new Error(`Invalid erasure strategy for "${key}".`);
    }
    if (
      !Number.isInteger(rule.retentionDays) ||
      rule.retentionDays < 0 ||
      rule.retentionDays > 36_500
    ) {
      throw new Error(`Retention for "${key}" must be 0-36,500 days.`);
    }
    if (rule.subjectKey) {
      if (subjectKeys.has(collection))
        throw new Error(
          `Collection "${collection}" has multiple subject keys.`,
        );
      subjectKeys.add(collection);
    }
    return Object.freeze({
      ...rule,
      collection,
      fieldPath,
      purpose: text(rule.purpose, "Processing purpose", 300),
      subjectKey: Boolean(rule.subjectKey),
    });
  });
  for (const collection of new Set(rules.map((rule) => rule.collection))) {
    if (!subjectKeys.has(collection))
      throw new Error(`Collection "${collection}" needs one subject-key rule.`);
  }
  return Object.freeze({ id, version, region, rules: Object.freeze(rules) });
}

function getPath(value: Readonly<Record<string, unknown>>, path: string) {
  let current: unknown = value;
  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object" || Array.isArray(current))
      return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function normalizeJson(
  value: unknown,
  state = { nodes: 0 },
  depth = 0,
): unknown {
  state.nodes += 1;
  if (state.nodes > 10_000 || depth > 16)
    throw new Error("Privacy record is too complex.");
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error("Privacy records require finite numbers.");
    return value;
  }
  if (Array.isArray(value))
    return value.map((entry) => normalizeJson(entry, state, depth + 1));
  if (
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new Error("Privacy records must contain plain JSON data.");
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, normalizeJson(entry, state, depth + 1)]),
  );
}

export type CmsPrivacySourceRecord = Readonly<{
  collection: string;
  documentId: string;
  recordedAt: string;
  data: Readonly<Record<string, unknown>>;
}>;

function normalizeSourceRecord(
  record: CmsPrivacySourceRecord,
): CmsPrivacySourceRecord {
  return Object.freeze({
    collection: normalizeCollection(record.collection),
    documentId: identifier(record.documentId, "Document ID"),
    recordedAt: date(record.recordedAt, "Record time").toISOString(),
    data: normalizeJson(record.data) as Readonly<Record<string, unknown>>,
  });
}

function subjectRecords(input: {
  policy: CmsPrivacyPolicy;
  subjectId: string;
  records: readonly CmsPrivacySourceRecord[];
}) {
  const policy = defineCmsPrivacyPolicy(input.policy);
  const subjectId = identifier(input.subjectId, "Subject ID");
  if (input.records.length > 10_000)
    throw new Error("Subject record limit exceeded.");
  return input.records
    .map(normalizeSourceRecord)
    .filter((record) => {
      const subjectRule = policy.rules.find(
        (rule) => rule.collection === record.collection && rule.subjectKey,
      );
      return (
        subjectRule && getPath(record.data, subjectRule.fieldPath) === subjectId
      );
    })
    .sort(
      (left, right) =>
        left.collection.localeCompare(right.collection) ||
        left.documentId.localeCompare(right.documentId),
    );
}

export function classifyCmsPrivacyDocument(input: {
  policy: CmsPrivacyPolicy;
  collection: string;
  data: Readonly<Record<string, unknown>>;
}) {
  const policy = defineCmsPrivacyPolicy(input.policy);
  const collection = normalizeCollection(input.collection);
  normalizeJson(input.data);
  return Object.freeze(
    policy.rules
      .filter((rule) => rule.collection === collection)
      .map((rule) =>
        Object.freeze({
          fieldPath: rule.fieldPath,
          classification: rule.classification,
          purpose: rule.purpose,
          lawfulBasis: rule.lawfulBasis,
          present: getPath(input.data, rule.fieldPath) !== undefined,
        }),
      ),
  );
}

export type CmsConsentRecord = Readonly<{
  id: string;
  subjectId: string;
  purpose: string;
  policyVersion: string;
  status: "granted" | "withdrawn";
  source: string;
  proof: Readonly<Record<string, unknown>>;
  recordedAt: string;
}>;

export function createMemoryCmsConsentLedger() {
  const records: CmsConsentRecord[] = [];
  return Object.freeze({
    append(input: CmsConsentRecord) {
      if (records.length >= 100_000)
        throw new Error("Consent record limit exceeded.");
      if (input.status !== "granted" && input.status !== "withdrawn") {
        throw new Error("Consent status must be granted or withdrawn.");
      }
      if (
        !input.proof ||
        Array.isArray(input.proof) ||
        typeof input.proof !== "object" ||
        Object.getPrototypeOf(input.proof) !== Object.prototype
      ) {
        throw new Error("Consent proof must be a plain object.");
      }
      const record: CmsConsentRecord = Object.freeze({
        id: identifier(input.id, "Consent record ID"),
        subjectId: identifier(input.subjectId, "Subject ID"),
        purpose: text(input.purpose, "Consent purpose", 300),
        policyVersion: text(input.policyVersion, "Policy version", 64),
        status: input.status,
        source: text(input.source, "Consent source", 160),
        proof: normalizeJson(input.proof) as Readonly<Record<string, unknown>>,
        recordedAt: date(input.recordedAt, "Consent time").toISOString(),
      });
      if (records.some((entry) => entry.id === record.id))
        throw new Error(`Duplicate consent ID "${record.id}".`);
      const latest = records
        .filter(
          (entry) =>
            entry.subjectId === record.subjectId &&
            entry.purpose === record.purpose,
        )
        .sort((left, right) =>
          right.recordedAt.localeCompare(left.recordedAt),
        )[0];
      if (latest && record.recordedAt < latest.recordedAt) {
        throw new Error(
          "Consent records must be appended in chronological order per subject and purpose.",
        );
      }
      records.push(record);
      return record;
    },
    current(subjectId: string, purpose: string) {
      const normalizedSubject = identifier(subjectId, "Subject ID");
      const normalizedPurpose = text(purpose, "Consent purpose", 300);
      return (
        records
          .filter(
            (entry) =>
              entry.subjectId === normalizedSubject &&
              entry.purpose === normalizedPurpose,
          )
          .sort(
            (left, right) =>
              right.recordedAt.localeCompare(left.recordedAt) ||
              right.id.localeCompare(left.id),
          )[0] ?? null
      );
    },
    history(subjectId: string) {
      const normalized = identifier(subjectId, "Subject ID");
      return Object.freeze(
        records
          .filter((entry) => entry.subjectId === normalized)
          .sort(
            (left, right) =>
              left.recordedAt.localeCompare(right.recordedAt) ||
              left.id.localeCompare(right.id),
          ),
      );
    },
  });
}

export type CmsSubjectDataExport = Readonly<{
  schemaVersion: 1;
  requestId: string;
  subjectId: string;
  policy: Readonly<{ id: string; version: string; region: string }>;
  generatedAt: string;
  records: readonly Readonly<{
    collection: string;
    documentId: string;
    fields: readonly Readonly<{
      path: string;
      classification: CmsPiiClassification;
      purpose: string;
      value: unknown;
    }>[];
  }>[];
}>;

export function exportCmsSubjectData(input: {
  requestId: string;
  subjectId: string;
  policy: CmsPrivacyPolicy;
  records: readonly CmsPrivacySourceRecord[];
  generatedAt: string | Date;
}): CmsSubjectDataExport {
  const policy = defineCmsPrivacyPolicy(input.policy);
  const subjectId = identifier(input.subjectId, "Subject ID");
  const records = subjectRecords({
    policy,
    subjectId,
    records: input.records,
  }).map((record) =>
    Object.freeze({
      collection: record.collection,
      documentId: record.documentId,
      fields: Object.freeze(
        policy.rules
          .filter((rule) => rule.collection === record.collection)
          .map((rule) => {
            const value = getPath(record.data, rule.fieldPath);
            return value === undefined
              ? null
              : Object.freeze({
                  path: rule.fieldPath,
                  classification: rule.classification,
                  purpose: rule.purpose,
                  value: normalizeJson(value),
                });
          })
          .filter((field) => field !== null),
      ),
    }),
  );
  return Object.freeze({
    schemaVersion: 1,
    requestId: identifier(input.requestId, "Request ID"),
    subjectId,
    policy: Object.freeze({
      id: policy.id,
      version: policy.version,
      region: policy.region,
    }),
    generatedAt: date(input.generatedAt, "Export time").toISOString(),
    records: Object.freeze(records),
  });
}

export function serializeCmsSubjectDataExport(value: CmsSubjectDataExport) {
  return `${JSON.stringify(normalizeJson(value), null, 2)}\n`;
}

export type CmsPrivacyLegalHold = Readonly<{
  id: string;
  reason: string;
  active: boolean;
  startsAt: string;
  expiresAt?: string | null;
  subjectIds?: readonly string[];
  documents?: readonly Readonly<{ collection: string; documentId: string }>[];
}>;

function normalizeLegalHold(input: CmsPrivacyLegalHold): CmsPrivacyLegalHold {
  const startsAt = date(input.startsAt, "Legal-hold start").toISOString();
  const expiresAt = input.expiresAt
    ? date(input.expiresAt, "Legal-hold expiry").toISOString()
    : null;
  if (expiresAt && expiresAt <= startsAt)
    throw new Error("Legal-hold expiry must follow its start.");
  const subjectIds = Object.freeze(
    [
      ...new Set(
        (input.subjectIds ?? []).map((entry) =>
          identifier(entry, "Subject ID"),
        ),
      ),
    ].sort(),
  );
  const documents = Object.freeze(
    (input.documents ?? [])
      .map((entry) =>
        Object.freeze({
          collection: normalizeCollection(entry.collection),
          documentId: identifier(entry.documentId, "Document ID"),
        }),
      )
      .sort(
        (left, right) =>
          left.collection.localeCompare(right.collection) ||
          left.documentId.localeCompare(right.documentId),
      ),
  );
  if (!subjectIds.length && !documents.length)
    throw new Error("A legal hold needs a subject or document scope.");
  return Object.freeze({
    id: identifier(input.id, "Legal-hold ID"),
    reason: text(input.reason, "Legal-hold reason", 500),
    active: input.active,
    startsAt,
    expiresAt,
    subjectIds,
    documents,
  });
}

function activeHold(input: {
  holds: readonly CmsPrivacyLegalHold[];
  now: Date;
  subjectId: string;
  record: CmsPrivacySourceRecord;
}) {
  if (input.holds.length > 5_000) throw new Error("Legal-hold limit exceeded.");
  return input.holds
    .map(normalizeLegalHold)
    .filter(
      (hold) =>
        hold.active &&
        hold.startsAt <= input.now.toISOString() &&
        (!hold.expiresAt || hold.expiresAt > input.now.toISOString()) &&
        (hold.subjectIds?.includes(input.subjectId) ||
          hold.documents?.some(
            (document) =>
              document.collection === input.record.collection &&
              document.documentId === input.record.documentId,
          )),
    )
    .sort((left, right) => left.id.localeCompare(right.id))[0];
}

export type CmsSubjectErasurePlanItem = Readonly<{
  collection: string;
  documentId: string;
  status: "ready" | "blocked" | "retained";
  action: "delete-document" | "redact-fields" | "retain";
  fieldPaths: readonly string[];
  retainedUntil: string;
  blocker: Readonly<{
    type: "legal-hold" | "retention";
    id?: string;
    reason: string;
  }> | null;
}>;

export type CmsSubjectErasurePlan = Readonly<{
  schemaVersion: 1;
  requestId: string;
  subjectId: string;
  policyId: string;
  policyVersion: string;
  generatedAt: string;
  executable: boolean;
  items: readonly CmsSubjectErasurePlanItem[];
}>;

export function planCmsSubjectErasure(input: {
  requestId: string;
  subjectId: string;
  policy: CmsPrivacyPolicy;
  records: readonly CmsPrivacySourceRecord[];
  legalHolds?: readonly CmsPrivacyLegalHold[];
  now: string | Date;
}): CmsSubjectErasurePlan {
  const policy = defineCmsPrivacyPolicy(input.policy);
  const subjectId = identifier(input.subjectId, "Subject ID");
  const now = date(input.now, "Plan time");
  const items = subjectRecords({
    policy,
    subjectId,
    records: input.records,
  }).map((record) => {
    const rules = policy.rules.filter(
      (rule) => rule.collection === record.collection,
    );
    const retainedUntilMs = Math.max(
      ...rules.map(
        (rule) =>
          date(record.recordedAt, "Record time").getTime() +
          rule.retentionDays * 86_400_000,
      ),
    );
    const retainedUntil = new Date(retainedUntilMs).toISOString();
    const hold = activeHold({
      holds: input.legalHolds ?? [],
      now,
      subjectId,
      record,
    });
    const deletableRules = rules.filter((rule) => rule.erase !== "retain");
    const retainsFields = rules.some((rule) => rule.erase === "retain");
    const action =
      !retainsFields && rules.some((rule) => rule.erase === "delete-document")
        ? ("delete-document" as const)
        : deletableRules.length
          ? ("redact-fields" as const)
          : ("retain" as const);
    const blocker = hold
      ? Object.freeze({
          type: "legal-hold" as const,
          id: hold.id,
          reason: hold.reason,
        })
      : retainedUntil > now.toISOString()
        ? Object.freeze({
            type: "retention" as const,
            reason: `Retained through ${retainedUntil}.`,
          })
        : null;
    return Object.freeze({
      collection: record.collection,
      documentId: record.documentId,
      status: blocker
        ? ("blocked" as const)
        : action === "retain"
          ? ("retained" as const)
          : ("ready" as const),
      action,
      fieldPaths: Object.freeze(
        deletableRules.map((rule) => rule.fieldPath).sort(),
      ),
      retainedUntil,
      blocker,
    });
  });
  return Object.freeze({
    schemaVersion: 1,
    requestId: identifier(input.requestId, "Request ID"),
    subjectId,
    policyId: policy.id,
    policyVersion: policy.version,
    generatedAt: now.toISOString(),
    executable: items.some((item) => item.status === "ready"),
    items: Object.freeze(items),
  });
}

export interface CmsSubjectErasureAdapter {
  deleteDocument(input: {
    collection: string;
    documentId: string;
    idempotencyKey: string;
  }): Promise<void>;
  redactFields(input: {
    collection: string;
    documentId: string;
    fieldPaths: readonly string[];
    idempotencyKey: string;
  }): Promise<void>;
}

const sha256Pattern = /^[a-f0-9]{64}$/;

export async function fingerprintCmsSubjectErasurePlan(
  plan: CmsSubjectErasurePlan,
) {
  const payload = new TextEncoder().encode(JSON.stringify(normalizeJson(plan)));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", payload));
  return [...digest]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function executeCmsSubjectErasurePlan(input: {
  plan: CmsSubjectErasurePlan;
  reviewedPlanSha256: string;
  expectedSubjectId: string;
  expectedPolicyVersion: string;
  adapter: CmsSubjectErasureAdapter;
}) {
  const subjectId = identifier(input.expectedSubjectId, "Expected subject ID");
  if (!sha256Pattern.test(input.reviewedPlanSha256)) {
    throw new Error("Reviewed erasure-plan SHA-256 is invalid.");
  }
  if (
    input.plan.subjectId !== subjectId ||
    input.plan.policyVersion !== input.expectedPolicyVersion
  ) {
    throw new Error(
      "Erasure plan no longer matches the reviewed subject or policy version.",
    );
  }
  const actualPlanSha256 = await fingerprintCmsSubjectErasurePlan(input.plan);
  if (actualPlanSha256 !== input.reviewedPlanSha256) {
    throw new Error(
      "Erasure plan no longer matches the reviewed plan fingerprint.",
    );
  }
  const completed: string[] = [];
  for (const item of input.plan.items) {
    if (item.status !== "ready") continue;
    const idempotencyKey = `${input.plan.requestId}:${item.collection}:${item.documentId}`;
    if (item.action === "delete-document") {
      await input.adapter.deleteDocument({
        collection: item.collection,
        documentId: item.documentId,
        idempotencyKey,
      });
    } else if (item.action === "redact-fields") {
      await input.adapter.redactFields({
        collection: item.collection,
        documentId: item.documentId,
        fieldPaths: item.fieldPaths,
        idempotencyKey,
      });
    }
    completed.push(idempotencyKey);
  }
  return Object.freeze({
    requestId: input.plan.requestId,
    planSha256: actualPlanSha256,
    completed: Object.freeze(completed),
    blocked: input.plan.items.filter((item) => item.status === "blocked")
      .length,
    retained: input.plan.items.filter((item) => item.status === "retained")
      .length,
  });
}

const redactedKeyPattern =
  /(?:email|phone|address|password|secret|token|cookie|authorization|session|ip|subject|actor|name)/i;
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;

function redactAuditValue(
  value: unknown,
  sensitiveKeys: Set<string>,
  depth = 0,
): unknown {
  if (depth > 12) return "[REDACTED]";
  if (typeof value === "string")
    return value
      .replace(emailPattern, "[REDACTED]")
      .replace(bearerPattern, "[REDACTED]");
  if (value === null || typeof value === "boolean" || typeof value === "number")
    return value;
  if (Array.isArray(value))
    return value
      .slice(0, 1_000)
      .map((entry) => redactAuditValue(entry, sensitiveKeys, depth + 1));
  if (!value || typeof value !== "object") return "[REDACTED]";
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 1_000)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [
        key,
        redactedKeyPattern.test(key) || sensitiveKeys.has(key)
          ? "[REDACTED]"
          : redactAuditValue(entry, sensitiveKeys, depth + 1),
      ]),
  );
}

export type CmsPrivacyAuditEntry = Readonly<{
  id: string;
  action: string;
  actorId: string;
  collection?: string | null;
  documentId?: string | null;
  occurredAt: string;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export function exportRedactedCmsPrivacyAudit(input: {
  policy: CmsPrivacyPolicy;
  entries: readonly CmsPrivacyAuditEntry[];
  format?: "json" | "ndjson";
}) {
  const policy = defineCmsPrivacyPolicy(input.policy);
  if (input.entries.length > 100_000)
    throw new Error("Audit export entry limit exceeded.");
  const sensitiveKeys = new Set(
    policy.rules.flatMap((rule) => [
      rule.fieldPath,
      rule.fieldPath.split(".").at(-1)!,
    ]),
  );
  const entries = input.entries
    .map((entry) => ({
      id: identifier(entry.id, "Audit ID"),
      action: text(entry.action, "Audit action", 160)
        .replace(emailPattern, "[REDACTED]")
        .replace(bearerPattern, "[REDACTED]"),
      actorId: "[REDACTED]",
      collection: entry.collection
        ? normalizeCollection(entry.collection)
        : null,
      documentId: entry.documentId ? "[REDACTED]" : null,
      occurredAt: date(entry.occurredAt, "Audit time").toISOString(),
      metadata: redactAuditValue(entry.metadata ?? {}, sensitiveKeys),
    }))
    .sort(
      (left, right) =>
        left.occurredAt.localeCompare(right.occurredAt) ||
        left.id.localeCompare(right.id),
    );
  return input.format === "ndjson"
    ? `${entries.map((entry) => JSON.stringify(entry)).join("\n")}${entries.length ? "\n" : ""}`
    : `${JSON.stringify(entries, null, 2)}\n`;
}

export type CmsAssetLicenseRecord = Readonly<{
  assetId: string;
  license: string | null;
  copyrightHolder: string | null;
  licenseExpiresAt?: string | null;
  usageExpiresAt?: string | null;
}>;

export function inspectCmsAssetLicenseExpiry(input: {
  assets: readonly CmsAssetLicenseRecord[];
  now: string | Date;
  warningDays?: number;
}) {
  if (input.assets.length > 100_000)
    throw new Error("Asset-license record limit exceeded.");
  const now = date(input.now, "License report time");
  const warningDays = input.warningDays ?? 30;
  if (!Number.isInteger(warningDays) || warningDays < 1 || warningDays > 365) {
    throw new Error("License warning window must be 1-365 days.");
  }
  const warningAt = new Date(now.getTime() + warningDays * 86_400_000);
  const assets = input.assets
    .map((asset) => {
      const deadlines = [asset.licenseExpiresAt, asset.usageExpiresAt]
        .filter((value): value is string => Boolean(value))
        .map((value) => date(value, "Asset-license expiry"));
      const deadline =
        deadlines.sort((left, right) => left.getTime() - right.getTime())[0] ??
        null;
      const missing = !asset.license?.trim() || !asset.copyrightHolder?.trim();
      const status = missing
        ? ("missing" as const)
        : deadline && deadline <= now
          ? ("expired" as const)
          : deadline && deadline <= warningAt
            ? ("expiring" as const)
            : ("valid" as const);
      return Object.freeze({
        assetId: identifier(asset.assetId, "Asset ID"),
        status,
        deadline: deadline?.toISOString() ?? null,
        publicationBlocked: status === "missing" || status === "expired",
      });
    })
    .sort((left, right) => left.assetId.localeCompare(right.assetId));
  return Object.freeze({
    generatedAt: now.toISOString(),
    assets: Object.freeze(assets),
    counts: Object.freeze({
      valid: assets.filter((asset) => asset.status === "valid").length,
      expiring: assets.filter((asset) => asset.status === "expiring").length,
      expired: assets.filter((asset) => asset.status === "expired").length,
      missing: assets.filter((asset) => asset.status === "missing").length,
    }),
    publicationBlocked: assets.some((asset) => asset.publicationBlocked),
  });
}

export const cmsPrivacyHandoverPolicyTemplates = Object.freeze([
  Object.freeze({
    id: "client-basic",
    label: "Basic client site",
    retentionReviewDays: 365,
    requiredArtifacts: Object.freeze([
      "policy-register",
      "consent-export",
      "asset-license-report",
    ]),
  }),
  Object.freeze({
    id: "client-standard",
    label: "Standard client operations",
    retentionReviewDays: 180,
    requiredArtifacts: Object.freeze([
      "policy-register",
      "consent-export",
      "subject-request-ledger",
      "legal-hold-register",
      "redacted-audit-export",
      "asset-license-report",
    ]),
  }),
  Object.freeze({
    id: "client-regulated",
    label: "Regulated or sensitive data",
    retentionReviewDays: 90,
    requiredArtifacts: Object.freeze([
      "policy-register",
      "consent-export",
      "subject-request-ledger",
      "legal-hold-register",
      "redacted-audit-export",
      "asset-license-report",
      "incident-contact-matrix",
      "processor-register",
    ]),
  }),
] as const);

export function createCmsPrivacyHandoverChecklist(input: {
  templateId: (typeof cmsPrivacyHandoverPolicyTemplates)[number]["id"];
  clientName: string;
  policyOwner: string;
  generatedAt: string | Date;
}) {
  const template = cmsPrivacyHandoverPolicyTemplates.find(
    (entry) => entry.id === input.templateId,
  );
  if (!template)
    throw new Error(`Unknown privacy handover template "${input.templateId}".`);
  const generatedAt = date(input.generatedAt, "Handover time").toISOString();
  return Object.freeze({
    schemaVersion: 1,
    templateId: template.id,
    clientName: text(input.clientName, "Client name", 200),
    policyOwner: text(input.policyOwner, "Policy owner", 200),
    generatedAt,
    nextRetentionReviewAt: new Date(
      date(generatedAt, "Handover time").getTime() +
        template.retentionReviewDays * 86_400_000,
    ).toISOString(),
    items: Object.freeze(
      template.requiredArtifacts.map((artifact) =>
        Object.freeze({ artifact, required: true, status: "pending" as const }),
      ),
    ),
  });
}
