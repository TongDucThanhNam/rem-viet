import { z } from "zod";

const isoTimestampSchema = z.string().refine((value) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && value.includes("T");
}, "Must be an ISO-8601 timestamp");

const gitShaSchema = z
  .string()
  .regex(/^[0-9a-f]{40}$/i, "Must be a full Git SHA");

const repositorySchema = z
  .string()
  .regex(
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/,
    "Must be an owner/repository identifier",
  );

export const passedDocumentationWalkthroughTasksSchema = z
  .object({
    installationAndDiagnostics: z.literal(true),
    schemaAndTemplateAuthoring: z.literal(true),
    editorAndClientManual: z.literal(true),
    providerConfiguration: z.literal(true),
    extensionLifecycle: z.literal(true),
    migrationUpgradeAndRollback: z.literal(true),
    backupAndRestore: z.literal(true),
    incidentResponse: z.literal(true),
    clientHandover: z.literal(true),
  })
  .strict();

const resolvedFindingSchema = z
  .object({
    issueId: z.string().min(1).max(80),
    severity: z.enum(["P2", "P3"]),
    summary: z.string().min(5).max(300),
    resolved: z.literal(true),
    remediationCommit: gitShaSchema.optional(),
  })
  .strict();

export const documentationWalkthroughEvidenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    repository: repositorySchema,
    documentationCommit: gitShaSchema,
    recordedAt: isoTimestampSchema,
    projectOwnerName: z.string().min(2).max(120),
    operator: z
      .object({
        name: z.string().min(2).max(120),
        relationship: z.literal("independent-operator"),
        operatingSystem: z.string().min(2).max(120),
        checkout: z.literal("independent-clean-checkout"),
        startedAt: isoTimestampSchema,
        completedAt: isoTimestampSchema,
        usedOnlyCheckedInDocumentation: z.literal(true),
        undocumentedDeveloperInterventions: z.literal(0),
        openP0: z.literal(0),
        openP1: z.literal(0),
      })
      .strict(),
    tasks: passedDocumentationWalkthroughTasksSchema,
    findings: z.array(resolvedFindingSchema),
    operatorApproval: z
      .object({
        name: z.string().min(2).max(120),
        approvedAt: isoTimestampSchema,
      })
      .strict(),
  })
  .strict()
  .superRefine((record, context) => {
    const startedAt = Date.parse(record.operator.startedAt);
    const completedAt = Date.parse(record.operator.completedAt);
    const approvedAt = Date.parse(record.operatorApproval.approvedAt);
    const recordedAt = Date.parse(record.recordedAt);

    if (completedAt < startedAt)
      context.addIssue({
        code: "custom",
        path: ["operator", "completedAt"],
        message: "Walkthrough completion precedes start",
      });
    if (approvedAt < completedAt)
      context.addIssue({
        code: "custom",
        path: ["operatorApproval", "approvedAt"],
        message: "Operator approval must follow walkthrough completion",
      });
    if (recordedAt < approvedAt)
      context.addIssue({
        code: "custom",
        path: ["recordedAt"],
        message: "Record timestamp must follow operator approval",
      });
    if (record.operatorApproval.name !== record.operator.name)
      context.addIssue({
        code: "custom",
        path: ["operatorApproval", "name"],
        message: "Approval must be made by the recorded operator",
      });
    if (
      record.projectOwnerName.trim().toLocaleLowerCase() ===
      record.operator.name.trim().toLocaleLowerCase()
    )
      context.addIssue({
        code: "custom",
        path: ["operator", "name"],
        message: "The independent operator must differ from the project owner",
      });

    const findingIds = new Set<string>();
    record.findings.forEach((finding, index) => {
      const normalized = finding.issueId.trim().toLocaleLowerCase();
      if (findingIds.has(normalized))
        context.addIssue({
          code: "custom",
          path: ["findings", index, "issueId"],
          message: "Finding IDs must be unique",
        });
      findingIds.add(normalized);
    });
  });

export type DocumentationWalkthroughEvidence = z.infer<
  typeof documentationWalkthroughEvidenceSchema
>;
