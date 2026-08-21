import { describe, expect, test } from "bun:test";
import {
  CmsFormSubmissionError,
  cmsFormsExtensionManifest,
  cmsFormsModule,
  createCmsFormSubmissionService,
  exportCmsLeadsCsv,
  exportCmsLeadsJson,
  normalizeCmsFormDefinition,
  validateCmsFormSubmission,
} from "../src";

const definition = {
  key: "contact-form",
  fields: [
    { name: "email", label: "Email", type: "email", required: true },
    {
      name: "topic",
      label: "Topic",
      type: "select",
      required: true,
      options: [{ label: "Project", value: "project" }],
    },
    { name: "consent", label: "Consent", type: "checkbox", required: true },
  ],
  consent: {
    field: "consent",
    policyVersion: "privacy-2026-08",
    required: true,
  },
} as const;

describe("official forms module", () => {
  test("owns lifecycle metadata and validates schema-driven consent", () => {
    expect(cmsFormsModule.manifest).toMatchObject({
      packageName: "@agency/cms-module-forms",
      uninstall: { dataPolicy: "export-then-delete" },
    });
    expect(cmsFormsExtensionManifest).toMatchObject({
      id: "official/forms",
      data: { uninstall: { policy: "export-then-delete" } },
    });
    expect(normalizeCmsFormDefinition(definition).fields).toHaveLength(3);
    expect(
      validateCmsFormSubmission(definition, {
        email: "bad",
        topic: "unknown",
        consent: false,
      }),
    ).toMatchObject({
      valid: false,
      errors: {
        email: expect.any(String),
        topic: expect.any(String),
        consent: expect.any(String),
      },
    });
  });

  test("rate-limits, checks spam, stores consent, and dispatches one durable event", async () => {
    const stored: unknown[] = [];
    const events: unknown[] = [];
    const service = createCmsFormSubmissionService({
      store: {
        async create(record) {
          stored.push(record);
          return record;
        },
      },
      rateLimiter: {
        async consume() {
          return true;
        },
      },
      spamGuard: {
        async check() {
          return { allowed: true };
        },
      },
      events: {
        async dispatch(event) {
          events.push(event);
        },
      },
      createSubmissionId: () => "lead-1",
      now: () => new Date("2026-08-21T01:02:03.000Z"),
    });
    const lead = await service.submit({
      definition,
      values: { email: "hello@example.com", topic: "project", consent: true },
      actorKey: "a".repeat(64),
      idempotencyKey: "submit-1",
    });
    expect(stored).toHaveLength(1);
    expect(events).toHaveLength(1);
    expect(lead.consent).toEqual({
      policyVersion: "privacy-2026-08",
      accepted: true,
      recordedAt: "2026-08-21T01:02:03.000Z",
    });
    expect(exportCmsLeadsJson([lead])).toContain("lead-1");
    expect(
      exportCmsLeadsCsv([
        { ...lead, data: { ...lead.data, topic: "=IMPORTXML()" } },
      ]),
    ).toContain("'=IMPORTXML()");

    const blocked = createCmsFormSubmissionService({
      store: {
        async create(record) {
          return record;
        },
      },
      rateLimiter: {
        async consume() {
          return false;
        },
      },
      spamGuard: {
        async check() {
          return { allowed: true };
        },
      },
      events: { async dispatch() {} },
      createSubmissionId: () => "never",
    });
    await expect(
      blocked.submit({
        definition,
        values: {},
        actorKey: "b".repeat(64),
        idempotencyKey: "blocked",
      }),
    ).rejects.toMatchObject<CmsFormSubmissionError>({ code: "RATE_LIMITED" });
  });
});
