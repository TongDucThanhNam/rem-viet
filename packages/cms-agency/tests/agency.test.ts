import { describe, expect, test } from "bun:test";
import { createCmsExtensionEd25519Verifier } from "@agency/cms-core";

import {
  cmsAgencyHandoverItemIds,
  createCmsAgencyFleet,
  createCmsAgencyOperationPlan,
  createCmsAgencySiteReceiptEnvelope,
  defineCmsAgencySiteReceipt,
  dispatchCmsAgencyOperation,
  inspectCmsAgencyFleet,
  verifyCmsAgencyHandoverChecklist,
  verifyCmsAgencySiteReceipt,
  type CmsAgencySiteReceipt,
} from "../src";

const baseTime = "2026-08-21T10:00:00.000Z";

function receipt(
  overrides: {
    siteId?: string;
    stage?: CmsAgencySiteReceipt["site"]["stage"];
    generatedAt?: string;
    health?: CmsAgencySiteReceipt["health"]["status"];
    kitVersion?: string;
    providerVersion?: string;
    currentSchema?: number;
    targetSchema?: number;
    pendingIds?: string[];
    backupVerifiedAt?: string | null;
    handover?: CmsAgencySiteReceipt["handover"]["status"];
    criticalAlerts?: number;
    jobDeadLetter?: number;
  } = {},
): CmsAgencySiteReceipt {
  const stage = overrides.stage ?? "production";
  const currentSchema = overrides.currentSchema ?? 3;
  const targetSchema = overrides.targetSchema ?? currentSchema;
  const pendingIds = overrides.pendingIds ?? [];
  const backupVerifiedAt =
    overrides.backupVerifiedAt === undefined
      ? "2026-08-21T09:30:00.000Z"
      : overrides.backupVerifiedAt;
  const handover = overrides.handover ?? "signed";
  return {
    schemaVersion: 1,
    site: {
      id: overrides.siteId ?? "rem-viet",
      stage,
      origin: `https://${overrides.siteId ?? "rem-viet"}.example`,
      repositorySha256: "1".repeat(64),
    },
    deployment: {
      commit: "a".repeat(40),
      deployedAt: "2026-08-21T09:00:00.000Z",
      kitVersion: overrides.kitVersion ?? "0.1.0",
      template: {
        packageName: "@agency/cms-template-rem-viet",
        version: "0.1.0",
      },
      provider: {
        id: "cloudflare",
        version: overrides.providerVersion ?? "0.1.0",
      },
      contentSchemaVersion: 3,
    },
    health: {
      status: overrides.health ?? "healthy",
      observedAt: "2026-08-21T09:59:00.000Z",
      checks: [
        {
          id: "database",
          status:
            overrides.health === "unreachable"
              ? "fail"
              : overrides.health === "degraded"
                ? "warning"
                : "pass",
          observedAt: "2026-08-21T09:59:00.000Z",
        },
      ],
    },
    operations: {
      migrations: {
        currentSchemaVersion: currentSchema,
        targetSchemaVersion: targetSchema,
        pendingIds,
      },
      backup: {
        latestReceiptId: backupVerifiedAt ? "backup-20260821" : null,
        verifiedAt: backupVerifiedAt,
      },
      audit: { eventCount24h: 12, latestEventAt: "2026-08-21T09:58:00.000Z" },
      alerts: {
        criticalOpen: overrides.criticalAlerts ?? 0,
        warningOpen: 0,
        evaluatedAt: "2026-08-21T09:59:00.000Z",
      },
      jobs: { running: 0, failed: 0, deadLetter: overrides.jobDeadLetter ?? 0 },
      webhooks: { pending: 0, failed: 0, deadLetter: 0 },
    },
    handover: {
      status: handover,
      receiptId: handover === "signed" ? "handover-20260821" : null,
      ownerKeySha256: handover === "signed" ? "2".repeat(64) : null,
    },
    generatedAt: overrides.generatedAt ?? baseTime,
  };
}

async function signingFixture() {
  const keys = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const sign = async (payload: Uint8Array) =>
    Buffer.from(
      await crypto.subtle.sign({ name: "Ed25519" }, keys.privateKey, payload),
    ).toString("base64");
  const verifySignature = createCmsExtensionEd25519Verifier({
    trustedKeys: { "agency-fleet-2026": keys.publicKey },
  });
  return { sign, verifySignature };
}

async function verified(
  value: CmsAgencySiteReceipt,
  signing: Awaited<ReturnType<typeof signingFixture>>,
) {
  const envelope = await createCmsAgencySiteReceiptEnvelope({
    receipt: value,
    keyId: "agency-fleet-2026",
    sign: signing.sign,
  });
  return verifyCmsAgencySiteReceipt({
    receipt: value,
    envelope,
    verifySignature: signing.verifySignature,
  });
}

describe("agency signed site receipts", () => {
  test("verifies a strict content-free receipt and rejects tampering", async () => {
    const signing = await signingFixture();
    const value = defineCmsAgencySiteReceipt(receipt());
    const result = await verified(value, signing);
    expect(result.receipt.site).toMatchObject({
      id: "rem-viet",
      stage: "production",
    });
    await expect(
      verifyCmsAgencySiteReceipt({
        receipt: {
          ...value,
          deployment: { ...value.deployment, kitVersion: "0.2.0" },
        },
        envelope: result.envelope,
        verifySignature: signing.verifySignature,
      }),
    ).rejects.toThrow("does not match");
    expect(() =>
      defineCmsAgencySiteReceipt({
        ...receipt(),
        content: { title: "must not centralize" },
      } as CmsAgencySiteReceipt),
    ).toThrow();
  });

  test("rejects inconsistent health, migration, backup, and handover claims", () => {
    expect(() =>
      defineCmsAgencySiteReceipt({
        ...receipt({ health: "degraded" }),
        health: {
          ...receipt({ health: "degraded" }).health,
          status: "healthy",
        },
      }),
    ).toThrow("healthy receipt");
    expect(() =>
      defineCmsAgencySiteReceipt(
        receipt({ currentSchema: 2, targetSchema: 3, pendingIds: [] }),
      ),
    ).toThrow("Pending migration");
    expect(() =>
      defineCmsAgencySiteReceipt({
        ...receipt(),
        operations: {
          ...receipt().operations,
          backup: { latestReceiptId: "backup-only", verifiedAt: null },
        },
      }),
    ).toThrow("appear together");
    expect(() =>
      defineCmsAgencySiteReceipt({
        ...receipt(),
        site: { ...receipt().site, origin: "https://rem-viet.example/admin" },
      }),
    ).toThrow("exact HTTPS origin");
    expect(() =>
      defineCmsAgencySiteReceipt({
        ...receipt(),
        operations: {
          ...receipt().operations,
          audit: {
            eventCount24h: 12,
            latestEventAt: "2026-08-21T10:01:00.000Z",
          },
        },
      }),
    ).toThrow("after generation");
  });
});

describe("agency fleet", () => {
  test("reports drift and operational risk without reading client content", async () => {
    const signing = await signingFixture();
    const healthy = await verified(receipt(), signing);
    const risky = await verified(
      receipt({
        siteId: "acme-demo",
        stage: "production",
        generatedAt: "2026-08-21T09:59:00.000Z",
        health: "degraded",
        kitVersion: "0.0.9",
        providerVersion: "0.0.8",
        currentSchema: 2,
        targetSchema: 3,
        pendingIds: ["0003-content"],
        backupVerifiedAt: null,
        handover: "in-progress",
        criticalAlerts: 1,
        jobDeadLetter: 2,
      }),
      signing,
    );
    const report = inspectCmsAgencyFleet({
      fleet: createCmsAgencyFleet([risky, healthy]),
      expectedKitVersion: "0.1.0",
      expectedProviderVersions: { cloudflare: "0.1.0" },
      now: new Date(baseTime),
      maximumReceiptAgeMs: 30_000,
    });
    expect(report.summary).toEqual({
      total: 2,
      ready: 1,
      critical: 1,
      warningOnly: 0,
    });
    expect(
      report.sites
        .find(({ site }) => site.id === "acme-demo")!
        .issues.map(({ code }) => code),
    ).toEqual([
      "receipt-stale",
      "health",
      "kit-drift",
      "provider-drift",
      "migration-pending",
      "critical-alert",
      "dead-letter",
      "backup-missing",
      "handover-open",
    ]);
    expect(() => createCmsAgencyFleet([healthy, healthy])).toThrow("Duplicate");
  });
});

describe("agency operation and handover safety", () => {
  test("requires exact confirmation and a fresh backup before production upgrade", async () => {
    const signing = await signingFixture();
    const site = await verified(
      receipt({
        currentSchema: 2,
        targetSchema: 3,
        pendingIds: ["0003-content"],
      }),
      signing,
    );
    const plan = createCmsAgencyOperationPlan({
      site,
      operation: "upgrade",
      targetKitVersion: "0.2.0",
      planId: "plan-upgrade-1",
      createdAt: new Date(baseTime),
    });
    expect(plan).toMatchObject({
      requiresFreshBackup: true,
      migrationIds: ["0003-content"],
    });
    expect(() =>
      createCmsAgencyOperationPlan({
        site,
        operation: "upgrade",
        targetKitVersion: "0.1.0",
        planId: "plan-noop-1",
        createdAt: new Date(baseTime),
      }),
    ).toThrow("must be newer");
    let dispatches = 0;
    await expect(
      dispatchCmsAgencyOperation({
        plan,
        confirmation: plan.confirmation,
        actorId: "agency-owner-1",
        dispatch: () => {
          dispatches += 1;
        },
        now: new Date("2026-08-21T10:02:00.000Z"),
      }),
    ).rejects.toThrow("fresh, verified");
    expect(dispatches).toBe(0);
    await expect(
      dispatchCmsAgencyOperation({
        plan,
        confirmation: plan.confirmation,
        actorId: "agency-owner-1",
        backup: {
          receiptId: "backup-from-future",
          siteId: "rem-viet",
          stage: "production",
          verifiedAt: "2026-08-21T10:03:00.000Z",
        },
        dispatch: () => {
          dispatches += 1;
        },
        now: new Date("2026-08-21T10:02:00.000Z"),
      }),
    ).rejects.toThrow("fresh, verified");
    expect(dispatches).toBe(0);
    const execution = await dispatchCmsAgencyOperation({
      plan,
      confirmation: plan.confirmation,
      actorId: "agency-owner-1",
      backup: {
        receiptId: "backup-after-plan",
        siteId: "rem-viet",
        stage: "production",
        verifiedAt: "2026-08-21T10:01:00.000Z",
      },
      dispatch: (acceptedPlan) => {
        dispatches += 1;
        return { acceptedPlanId: acceptedPlan.planId };
      },
      now: new Date("2026-08-21T10:02:00.000Z"),
    });
    expect(dispatches).toBe(1);
    expect(execution).toMatchObject({
      result: { acceptedPlanId: "plan-upgrade-1" },
      receipt: {
        status: "accepted",
        backupReceiptId: "backup-after-plan",
      },
    });
  });

  test("requires every handover control and stores fingerprints only", () => {
    expect(() =>
      verifyCmsAgencyHandoverChecklist({
        siteId: "rem-viet",
        items: cmsAgencyHandoverItemIds.slice(1).map((id) => ({
          id,
          completed: true,
        })),
        clientOwnerKeySha256: "3".repeat(64),
        receiptId: "handover-final-1",
        signedAt: baseTime,
      }),
    ).toThrow("least-privilege-accounts");
    expect(
      verifyCmsAgencyHandoverChecklist({
        siteId: "rem-viet",
        items: cmsAgencyHandoverItemIds.map((id) => ({ id, completed: true })),
        clientOwnerKeySha256: "3".repeat(64),
        receiptId: "handover-final-1",
        signedAt: baseTime,
      }),
    ).toMatchObject({
      siteId: "rem-viet",
      receiptId: "handover-final-1",
      completedItemIds: cmsAgencyHandoverItemIds,
    });
  });
});
