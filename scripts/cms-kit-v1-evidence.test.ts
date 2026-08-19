import { describe, expect, test } from "bun:test";

import { cmsKitPackageNames } from "./cms-kit-release-lib";
import {
  parseCmsKitAdoptionReceipt,
  parseCmsKitPublicationReceipt,
  parseCmsKitV1Evidence,
  verifyCmsKitV1EvidenceGraph,
} from "./cms-kit-v1-evidence";

const digest = (character: string) => character.repeat(64);
const commit = (character: string) => character.repeat(40);
const initialPublication = publication("0.9.0", commit("a"), "2026-08-01");
const targetPublication = publication("1.0.0", commit("b"), "2026-08-10");

describe("CMS Kit v1 evidence", () => {
  test("accepts exact coordinated publications, paid adoption upgrades, and approval", () => {
    expect(
      parseCmsKitPublicationReceipt(initialPublication).packages,
    ).toHaveLength(cmsKitPackageNames.length);
    expect(
      parseCmsKitAdoptionReceipt(adoption("site-one", "d", "e")),
    ).toMatchObject({
      fromVersion: "0.9.0",
      toVersion: "1.0.0",
      coreFixId: "CMSKIT-101",
    });
    const final = parseCmsKitV1Evidence(finalEvidence());
    expect(final.releaseTag).toBe("cms-kit-v1.0.0");
    expect(final.releaseSourceCommit).toBe(commit("b"));
    expect(final.adoptions[0]?.path).toContain("site-one");
  });

  test("rejects partial package publication and non-upgrade adoption claims", () => {
    expect(() =>
      parseCmsKitPublicationReceipt({
        ...targetPublication,
        packages: targetPublication.packages.slice(1),
      }),
    ).toThrow(/each coordinated package exactly once/i);
    expect(() =>
      parseCmsKitAdoptionReceipt({
        ...adoption("site-one", "d", "e"),
        fromVersion: "1.0.0",
      }),
    ).toThrow(/actual coordinated upgrade/i);
  });

  test("rejects one-site, duplicated, premature, or source-drifted final evidence", () => {
    const valid = finalEvidence();
    expect(() =>
      parseCmsKitV1Evidence({
        ...valid,
        adoptions: valid.adoptions.slice(0, 1),
      }),
    ).toThrow();
    expect(() =>
      parseCmsKitV1Evidence({
        ...valid,
        adoptions: [valid.adoptions[0], valid.adoptions[0]],
      }),
    ).toThrow(/reference must be unique/i);
    expect(() =>
      parseCmsKitV1Evidence({
        ...valid,
        releaseSourceCommit: commit("c"),
      }),
    ).toThrow(/source commits must match/i);
    expect(() =>
      parseCmsKitV1Evidence({
        ...valid,
        agencyApproval: {
          ...valid.agencyApproval,
          approvedAt: "2026-08-11T00:00:00.000Z",
        },
      }),
    ).toThrow(/approval must follow evidence assembly/i);
  });

  test("binds the release graph to both publications and two independent paid sites", () => {
    const graph = evidenceGraph();
    expect(verifyCmsKitV1EvidenceGraph(graph)).toEqual({
      registry: "https://registry.example.com/agency",
      version: "1.0.0",
      coreFix: "CMSKIT-101",
      paidSites: ["site-one", "site-two"],
    });

    expect(() =>
      verifyCmsKitV1EvidenceGraph({
        ...graph,
        targetPublication: {
          ...graph.targetPublication,
          sha256: digest("8"),
        },
      }),
    ).toThrow(/publication receipts do not match/i);

    expect(() =>
      verifyCmsKitV1EvidenceGraph({
        ...graph,
        adoptions: [
          graph.adoptions[0]!,
          {
            ...graph.adoptions[1]!,
            receipt: {
              ...graph.adoptions[1]!.receipt,
              repositoryFingerprint:
                graph.adoptions[0]!.receipt.repositoryFingerprint,
            },
          },
        ],
      }),
    ).toThrow(/repository fingerprints must be unique/i);
  });
});

function evidenceGraph() {
  return {
    record: parseCmsKitV1Evidence(finalEvidence()),
    initialPublication: {
      receipt: parseCmsKitPublicationReceipt(initialPublication),
      sha256: digest("1"),
    },
    targetPublication: {
      receipt: parseCmsKitPublicationReceipt(targetPublication),
      sha256: digest("2"),
    },
    adoptions: [
      {
        receipt: parseCmsKitAdoptionReceipt(adoption("site-one", "d", "e")),
        sha256: digest("4"),
      },
      {
        receipt: parseCmsKitAdoptionReceipt(adoption("site-two", "8", "7")),
        sha256: digest("5"),
      },
    ],
    changelog: {
      sha256: digest("3"),
      text: "# 1.0.0\n\n- CMSKIT-101 ships the shared core fix.",
    },
  };
}

function publication(version: string, sourceCommit: string, day: string) {
  return {
    schemaVersion: 1,
    subject: "agency-cms-platform-kit",
    version,
    commit: sourceCommit,
    registry: "https://registry.example.com/agency",
    access: "restricted",
    status: "published-and-verified",
    packages: cmsKitPackageNames.map((name, index) => ({
      name,
      version,
      sha256: digest(String((index % 9) + 1)),
      publishedAt: `${day}T00:00:00.000Z`,
      verifiedAt: `${day}T00:01:00.000Z`,
    })),
    completedAt: `${day}T00:02:00.000Z`,
  };
}

function adoption(siteId: string, repository: string, engagement: string) {
  return {
    schemaVersion: 1,
    status: "complete",
    siteId,
    repositoryFingerprint: digest(repository),
    paidEngagementProofSha256: digest(engagement),
    supportAgreementSha256: digest(siteId === "site-one" ? "f" : "6"),
    origin: `https://${siteId}.example.com`,
    provider: "cloudflare",
    fromVersion: "0.9.0",
    toVersion: "1.0.0",
    initialPublicationReceiptSha256: digest("1"),
    targetPublicationReceiptSha256: digest("2"),
    coreFixId: "CMSKIT-101",
    deployedAt: "2026-08-02T00:00:00.000Z",
    upgradedAt: "2026-08-11T00:00:00.000Z",
    verifiedAt: "2026-08-11T00:10:00.000Z",
    checks: {
      paidEngagement: true,
      cleanCheckout: true,
      independentRepository: true,
      publicPackageExportsOnly: true,
      noCopiedPackageSource: true,
      providerConformance: true,
      productionLikeRestore: true,
      adminWorkflow: true,
      coreFixAbsentBefore: true,
      coreFixPresentAfter: true,
      upgradedWithoutCopiedPatch: true,
      clientHandover: true,
    },
    clientApproval: {
      role: "client-owner",
      approvedAt: "2026-08-11T00:20:00.000Z",
    },
  };
}

function finalEvidence() {
  return {
    schemaVersion: 1,
    releaseTag: "cms-kit-v1.0.0",
    assembledAt: "2026-08-12T00:00:00.000Z",
    releaseSourceCommit: commit("b"),
    sourceState: "clean",
    coreFix: {
      id: "CMSKIT-101",
      fromVersion: "0.9.0",
      toVersion: "1.0.0",
      sourceCommit: commit("b"),
      changelogSha256: digest("3"),
    },
    publications: {
      initial: {
        path: "docs/releases/evidence/cms-kit-0.9.0-publication.json",
        sha256: digest("1"),
      },
      target: {
        path: "docs/releases/evidence/cms-kit-1.0.0-publication.json",
        sha256: digest("2"),
      },
    },
    adoptions: [
      {
        path: "docs/releases/evidence/cms-kit-site-one-adoption.json",
        sha256: digest("4"),
      },
      {
        path: "docs/releases/evidence/cms-kit-site-two-adoption.json",
        sha256: digest("5"),
      },
    ],
    localChecks: {
      cleanCheckout: true,
      tests: true,
      typecheck: true,
      productionBuilds: true,
      migrations: true,
      packageBoundaries: true,
      packedConsumer: true,
      upgradeRollback: true,
      compatibilityMatrix: true,
      changelogAndMigrationNotes: true,
      installationDocumentation: true,
      templateDocumentation: true,
      upgradeDocumentation: true,
      incidentDocumentation: true,
      handoverDocumentation: true,
    },
    commercialBoundary: {
      installationTierDefined: true,
      recurringSupportScopeDefined: true,
      upgradeSlaDefined: true,
      deprecationPolicyDefined: true,
    },
    agencyApproval: {
      role: "agency-owner",
      approvedAt: "2026-08-12T00:10:00.000Z",
      statement:
        "I approve Agency CMS Platform Kit v1.0.0 for restricted commercial use.",
    },
  };
}
