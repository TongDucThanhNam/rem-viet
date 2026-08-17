import { z } from "zod";

const isoTimestamp = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)));

export const githubReleaseWorkflowSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    path: z.string().min(1),
    state: z.string().min(1),
    created_at: isoTimestamp,
    updated_at: isoTimestamp,
  })
  .passthrough();

export type GithubReleaseGateAuditReport = Readonly<{
  schemaVersion: 1;
  checkedAt: string;
  ready: boolean;
  repository: Readonly<{
    nameWithOwner: string;
    defaultBranch: string;
  }>;
  workflow: Readonly<{
    path: string;
    availableOnDefaultBranch: boolean;
    matchesLocalContract: boolean;
    registered: boolean;
    active: boolean;
  }>;
  gaps: readonly Readonly<{ gate: string; action: string }>[];
}>;

export function buildGithubReleaseGateAuditReport(input: {
  checkedAt: string;
  repository: { nameWithOwner: string; defaultBranch: string };
  workflow: {
    path: string;
    availableOnDefaultBranch: boolean;
    matchesLocalContract: boolean;
    registered: boolean;
    active: boolean;
  };
}): GithubReleaseGateAuditReport {
  const gaps: Array<{ gate: string; action: string }> = [];
  if (!input.workflow.availableOnDefaultBranch)
    gaps.push({
      gate: "workflow-default-branch",
      action:
        "Publish the client-ready release workflow to the repository default branch before creating a release tag.",
    });
  else if (!input.workflow.matchesLocalContract)
    gaps.push({
      gate: "workflow-contract",
      action:
        "Make the default-branch client-ready workflow byte-identical to the audited local contract.",
    });
  if (!input.workflow.registered)
    gaps.push({
      gate: "workflow-registration",
      action:
        "Wait for GitHub Actions to register the default-branch client-ready workflow, then rerun the audit.",
    });
  else if (!input.workflow.active)
    gaps.push({
      gate: "workflow-active",
      action:
        "Enable the registered client-ready workflow in GitHub Actions before creating a release tag.",
    });

  return {
    schemaVersion: 1,
    checkedAt: isoTimestamp.parse(input.checkedAt),
    ready:
      input.workflow.availableOnDefaultBranch &&
      input.workflow.matchesLocalContract &&
      input.workflow.registered &&
      input.workflow.active,
    repository: input.repository,
    workflow: input.workflow,
    gaps,
  };
}
