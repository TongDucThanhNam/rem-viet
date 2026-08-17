import { describe, expect, test } from "bun:test";

import {
  deploymentProvenanceFromEnv,
  deploymentProvenanceSchema,
  isCleanDeploymentProvenance,
} from "../src/deployment";

const valid = {
  siteId: "rem-viet",
  stage: "staging",
  commit: "a".repeat(40),
  inputSha256: "b".repeat(64),
  sourceState: "clean" as const,
};

describe("deployment provenance", () => {
  test("accepts an exact clean Git and deploy-input identity", () => {
    const provenance = deploymentProvenanceSchema.parse(valid);
    expect(isCleanDeploymentProvenance(provenance)).toBe(true);
    expect(
      deploymentProvenanceFromEnv({
        RELEASE_SITE_ID: valid.siteId,
        RELEASE_STAGE: valid.stage,
        RELEASE_GIT_SHA: valid.commit,
        RELEASE_INPUT_SHA256: valid.inputSha256,
        RELEASE_SOURCE_STATE: valid.sourceState,
      }),
    ).toEqual(valid);
  });

  test("keeps dirty or unavailable provenance explicit and non-releasable", () => {
    for (const provenance of [
      { ...valid, sourceState: "dirty" as const },
      {
        ...valid,
        commit: "unknown" as const,
        inputSha256: "unknown" as const,
        sourceState: "unknown" as const,
      },
    ]) {
      expect(
        isCleanDeploymentProvenance(
          deploymentProvenanceSchema.parse(provenance),
        ),
      ).toBe(false);
    }
  });

  test("rejects malformed identifiers and unexpected public metadata", () => {
    expect(
      deploymentProvenanceSchema.safeParse({
        ...valid,
        commit: "short",
        secret: "must-not-be-exposed",
      }).success,
    ).toBe(false);
  });
});
