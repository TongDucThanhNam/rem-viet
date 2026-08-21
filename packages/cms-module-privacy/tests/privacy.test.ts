import { describe, expect, test } from "bun:test";
import {
  classifyCmsPrivacyDocument,
  cmsPrivacyExtensionManifest,
  cmsPrivacyHandoverPolicyTemplates,
  cmsPrivacyModule,
  createCmsPrivacyHandoverChecklist,
  createMemoryCmsConsentLedger,
  defineCmsPrivacyPolicy,
  executeCmsSubjectErasurePlan,
  exportCmsSubjectData,
  exportRedactedCmsPrivacyAudit,
  fingerprintCmsSubjectErasurePlan,
  inspectCmsAssetLicenseExpiry,
  planCmsSubjectErasure,
  serializeCmsSubjectDataExport,
} from "../src";

const policy = defineCmsPrivacyPolicy({
  id: "client-policy",
  version: "1.0.0",
  region: "VN",
  rules: [
    {
      collection: "leads",
      fieldPath: "subjectId",
      classification: "identifier",
      purpose: "Resolve the data subject.",
      lawfulBasis: "legal-obligation",
      subjectKey: true,
      retentionDays: 0,
      erase: "delete-document",
    },
    {
      collection: "leads",
      fieldPath: "contact.email",
      classification: "contact",
      purpose: "Reply to an enquiry.",
      lawfulBasis: "consent",
      retentionDays: 0,
      erase: "remove-field",
    },
  ],
});

const records = [
  {
    collection: "leads",
    documentId: "lead-1",
    recordedAt: "2026-08-01T00:00:00.000Z",
    data: {
      subjectId: "subject-1",
      contact: { email: "person@example.com" },
      note: "Internal",
    },
  },
  {
    collection: "leads",
    documentId: "lead-2",
    recordedAt: "2026-08-01T00:00:00.000Z",
    data: { subjectId: "subject-2", contact: { email: "other@example.com" } },
  },
] as const;

describe("official privacy module", () => {
  test("owns install lifecycle and the compliance collections", () => {
    expect(cmsPrivacyExtensionManifest).toMatchObject({
      id: "official/privacy",
      entrypoints: [{ runtime: "server" }],
      data: { uninstall: { policy: "export-then-delete" } },
    });
    expect(cmsPrivacyExtensionManifest.routes).toContainEqual(
      expect.objectContaining({
        id: "official/privacy/erase",
        authorization: "session",
        mutationProtection: "same-origin",
      }),
    );
    expect(cmsPrivacyModule.manifest).toMatchObject({
      packageName: "@agency/cms-module-privacy",
    });
    expect(cmsPrivacyModule.collections).toHaveLength(4);
    expect(cmsPrivacyModule.permissions).toHaveLength(2);
    expect(cmsPrivacyModule.migrations).toHaveLength(1);
  });

  test("classifies fields and preserves append-only consent history", () => {
    expect(
      classifyCmsPrivacyDocument({
        policy,
        collection: "leads",
        data: records[0].data,
      }),
    ).toMatchObject([
      { fieldPath: "subjectId", classification: "identifier", present: true },
      { fieldPath: "contact.email", classification: "contact", present: true },
    ]);
    const ledger = createMemoryCmsConsentLedger();
    ledger.append({
      id: "consent-1",
      subjectId: "subject-1",
      purpose: "marketing",
      policyVersion: "1.0.0",
      status: "granted",
      source: "contact-form",
      proof: { form: "contact" },
      recordedAt: "2026-08-01T00:00:00.000Z",
    });
    ledger.append({
      id: "consent-2",
      subjectId: "subject-1",
      purpose: "marketing",
      policyVersion: "1.0.0",
      status: "withdrawn",
      source: "preference-center",
      proof: { request: "withdraw" },
      recordedAt: "2026-08-02T00:00:00.000Z",
    });
    expect(ledger.current("subject-1", "marketing")?.status).toBe("withdrawn");
    expect(ledger.history("subject-1")).toHaveLength(2);
  });

  test("exports only one subject and binds erasure to retention and legal holds", async () => {
    const exported = exportCmsSubjectData({
      requestId: "export-1",
      subjectId: "subject-1",
      policy,
      records,
      generatedAt: "2026-08-21T00:00:00.000Z",
    });
    expect(exported.records).toHaveLength(1);
    expect(serializeCmsSubjectDataExport(exported)).toContain(
      "person@example.com",
    );
    expect(serializeCmsSubjectDataExport(exported)).not.toContain(
      "other@example.com",
    );

    const blocked = planCmsSubjectErasure({
      requestId: "erase-1",
      subjectId: "subject-1",
      policy,
      records,
      legalHolds: [
        {
          id: "hold-1",
          reason: "Open dispute",
          active: true,
          startsAt: "2026-08-01T00:00:00.000Z",
          subjectIds: ["subject-1"],
        },
      ],
      now: "2026-08-21T00:00:00.000Z",
    });
    expect(blocked.items[0]).toMatchObject({
      status: "blocked",
      blocker: { type: "legal-hold", id: "hold-1" },
    });

    const retainedPolicy = defineCmsPrivacyPolicy({
      ...policy,
      version: "1.0.1",
      rules: policy.rules.map((rule) => ({ ...rule, retentionDays: 30 })),
    });
    expect(
      planCmsSubjectErasure({
        requestId: "erase-retained",
        subjectId: "subject-1",
        policy: retainedPolicy,
        records,
        now: "2026-08-21T00:00:00.000Z",
      }).items[0],
    ).toMatchObject({
      status: "blocked",
      blocker: { type: "retention" },
      retainedUntil: "2026-08-31T00:00:00.000Z",
    });

    const ready = planCmsSubjectErasure({
      requestId: "erase-2",
      subjectId: "subject-1",
      policy,
      records,
      now: "2026-08-21T00:00:00.000Z",
    });
    const reviewedPlanSha256 = await fingerprintCmsSubjectErasurePlan(ready);
    const calls: unknown[] = [];
    const receipt = await executeCmsSubjectErasurePlan({
      plan: ready,
      reviewedPlanSha256,
      expectedSubjectId: "subject-1",
      expectedPolicyVersion: "1.0.0",
      adapter: {
        async deleteDocument(value) {
          calls.push(value);
        },
        async redactFields(value) {
          calls.push(value);
        },
      },
    });
    expect(calls).toHaveLength(1);
    expect(receipt.completed).toEqual(["erase-2:leads:lead-1"]);
    await expect(
      executeCmsSubjectErasurePlan({
        plan: ready,
        reviewedPlanSha256,
        expectedSubjectId: "subject-2",
        expectedPolicyVersion: "1.0.0",
        adapter: { async deleteDocument() {}, async redactFields() {} },
      }),
    ).rejects.toThrow(/no longer matches/);
    await expect(
      executeCmsSubjectErasurePlan({
        plan: {
          ...ready,
          items: ready.items.map((item) => ({
            ...item,
            documentId: "attacker-selected-document",
          })),
        },
        reviewedPlanSha256,
        expectedSubjectId: "subject-1",
        expectedPolicyVersion: "1.0.0",
        adapter: { async deleteDocument() {}, async redactFields() {} },
      }),
    ).rejects.toThrow(/fingerprint/);
  });

  test("redacts audit exports and reports expired or missing asset licenses", () => {
    const audit = exportRedactedCmsPrivacyAudit({
      policy,
      format: "ndjson",
      entries: [
        {
          id: "audit-1",
          action: "lead.export",
          actorId: "admin@example.com",
          collection: "leads",
          documentId: "lead-1",
          occurredAt: "2026-08-21T00:00:00.000Z",
          metadata: {
            email: "person@example.com",
            authorization: "Bearer secret-token",
            count: 1,
          },
        },
      ],
    });
    expect(audit).not.toContain("person@example.com");
    expect(audit).not.toContain("secret-token");
    expect(audit).toContain("[REDACTED]");

    const report = inspectCmsAssetLicenseExpiry({
      now: "2026-08-21T00:00:00.000Z",
      assets: [
        {
          assetId: "asset-valid",
          license: "licensed",
          copyrightHolder: "Studio",
          licenseExpiresAt: "2027-01-01T00:00:00.000Z",
        },
        {
          assetId: "asset-expired",
          license: "licensed",
          copyrightHolder: "Studio",
          usageExpiresAt: "2026-08-01T00:00:00.000Z",
        },
        { assetId: "asset-missing", license: null, copyrightHolder: null },
      ],
    });
    expect(report.counts).toEqual({
      valid: 1,
      expiring: 0,
      expired: 1,
      missing: 1,
    });
    expect(report.publicationBlocked).toBe(true);
  });

  test("ships bounded handover policy templates", () => {
    expect(cmsPrivacyHandoverPolicyTemplates).toHaveLength(3);
    const checklist = createCmsPrivacyHandoverChecklist({
      templateId: "client-regulated",
      clientName: "Acme",
      policyOwner: "Acme DPO",
      generatedAt: "2026-08-21T00:00:00.000Z",
    });
    expect(checklist.items).toHaveLength(8);
    expect(checklist.nextRetentionReviewAt).toBe("2026-11-19T00:00:00.000Z");
  });
});
