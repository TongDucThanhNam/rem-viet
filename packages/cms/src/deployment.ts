import { z } from "zod";

const gitShaSchema = z
  .string()
  .regex(/^[0-9a-f]{40}$/i, "Must be a full Git SHA");
const sha256Schema = z
  .string()
  .regex(/^[0-9a-f]{64}$/i, "Must be a SHA-256 digest");

export const deploymentSourceStateSchema = z.enum([
  "clean",
  "dirty",
  "unknown",
]);

export const deploymentProvenanceSchema = z
  .object({
    siteId: z.string().regex(/^[a-z][a-z0-9-]{1,62}$/),
    stage: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/),
    commit: z.union([gitShaSchema, z.literal("unknown")]),
    inputSha256: z.union([sha256Schema, z.literal("unknown")]),
    sourceState: deploymentSourceStateSchema,
  })
  .strict();

export type DeploymentProvenance = z.infer<typeof deploymentProvenanceSchema>;

export function deploymentProvenanceFromEnv(
  runtimeEnv: Record<string, unknown>,
) {
  return deploymentProvenanceSchema.parse({
    siteId: runtimeEnv.RELEASE_SITE_ID,
    stage: runtimeEnv.RELEASE_STAGE,
    commit: runtimeEnv.RELEASE_GIT_SHA,
    inputSha256: runtimeEnv.RELEASE_INPUT_SHA256,
    sourceState: runtimeEnv.RELEASE_SOURCE_STATE,
  });
}

export function isCleanDeploymentProvenance(provenance: DeploymentProvenance) {
  return (
    provenance.sourceState === "clean" &&
    gitShaSchema.safeParse(provenance.commit).success &&
    sha256Schema.safeParse(provenance.inputSha256).success
  );
}
