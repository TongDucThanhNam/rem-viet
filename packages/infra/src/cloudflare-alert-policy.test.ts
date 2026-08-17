import { describe, expect, test } from "bun:test";

import {
  buildCloudflareOperationalAlertEvidence,
  buildCloudflareOperationalAlertPolicy,
  cloudflareOperationalAlertContractAvailable,
  planCloudflareOperationalAlert,
  resolveExactCloudflareOperationalAlertPolicy,
} from "./cloudflare-alert-policy";

const recipient = "ops@example.com";
const target = buildCloudflareOperationalAlertPolicy({
  site: "rem-viet",
  stage: "staging",
  recipient,
});
const exactPolicy = {
  id: "private-policy-id",
  created: "2026-08-14T12:00:00.000Z",
  ...target,
};

describe("Cloudflare operational alert policy", () => {
  test("builds the deterministic firing-failure policy", () => {
    expect(target).toEqual({
      name: "rem-viet-staging-operational-failures",
      description:
        "Agency CMS rem-viet staging: email on Workers Observability firing failures.",
      alert_type: "workers_observability_alert",
      enabled: true,
      mechanisms: { email: [{ id: recipient }] },
      filters: { status: ["FIRING_FAILED"] },
    });
  });

  test("requires the live provider failure-status contract", () => {
    expect(
      cloudflareOperationalAlertContractAvailable({
        "Workers Observability": [
          {
            type: "workers_observability_alert",
            filter_options: [
              {
                Key: "status",
                AvailableValues: [{ ID: "FIRING_FAILED" }, { ID: "NORMAL" }],
              },
            ],
          },
        ],
      }),
    ).toBe(true);
    expect(
      cloudflareOperationalAlertContractAvailable({
        "Workers Observability": [
          {
            type: "workers_observability_alert",
            filter_options: [],
          },
        ],
      }),
    ).toBe(false);
  });

  test("plans one create and never prints the recipient", () => {
    const plan = planCloudflareOperationalAlert({
      policies: [],
      site: "rem-viet",
      stage: "staging",
      recipient,
    });
    expect(plan.action).toBe("create");
    expect(plan.safeToCreate).toBe(true);
    expect(JSON.stringify(plan)).not.toContain(recipient);
  });

  test("is idempotent only for one exact policy", () => {
    const plan = planCloudflareOperationalAlert({
      policies: [exactPolicy],
      site: "rem-viet",
      stage: "staging",
      recipient,
    });
    expect(plan.action).toBe("noop");
    expect(plan.policyConfigured).toBe(true);
    expect(
      resolveExactCloudflareOperationalAlertPolicy({
        policies: [exactPolicy],
        target,
      }),
    ).toEqual({
      id: "private-policy-id",
      created: "2026-08-14T12:00:00.000Z",
    });
  });

  test("fails closed on missing recipient, drift or duplicates", () => {
    expect(
      planCloudflareOperationalAlert({
        policies: [],
        site: "rem-viet",
        stage: "staging",
      }).action,
    ).toBe("blocked");
    expect(
      planCloudflareOperationalAlert({
        policies: [{ ...exactPolicy, enabled: false }],
        site: "rem-viet",
        stage: "staging",
        recipient,
      }).action,
    ).toBe("manual-review");
    expect(
      planCloudflareOperationalAlert({
        policies: [exactPolicy, exactPolicy],
        site: "rem-viet",
        stage: "staging",
        recipient,
      }).action,
    ).toBe("manual-review");
  });

  test("withholds provider receipt until human confirmation", () => {
    const history = [
      {
        id: "private-dispatch-id",
        policy_id: "private-policy-id",
        alert_type: "workers_observability_alert",
        mechanism_type: "email",
        sent: "2026-08-14T12:05:00.000Z",
      },
    ];
    const pending = buildCloudflareOperationalAlertEvidence({
      policy: resolveExactCloudflareOperationalAlertPolicy({
        policies: [exactPolicy],
        target,
      }),
      history,
    });
    expect(pending.dispatchRecorded).toBe(true);
    expect(pending.releaseEvidence).toBeNull();
    expect(JSON.stringify(pending)).not.toContain("private-dispatch-id");

    const verified = buildCloudflareOperationalAlertEvidence({
      policy: resolveExactCloudflareOperationalAlertPolicy({
        policies: [exactPolicy],
        target,
      }),
      history,
      receiptConfirmedAt: "2026-08-14T12:06:00.000Z",
      now: new Date("2026-08-14T12:07:00.000Z"),
    });
    expect(verified.releaseEvidence).toEqual({
      provider: "cloudflare",
      stage: "staging",
      trigger: "notification-failure",
      alertType: "workers_observability_alert",
      deliveryMechanism: "email",
      policyEnabled: true,
      delivered: true,
      dispatchReceiptId: "private-dispatch-id",
      verifiedAt: "2026-08-14T12:06:00.000Z",
    });
  });

  test("rejects unrelated, pre-policy and impossible receipt evidence", () => {
    const unrelated = [
      {
        id: "wrong-dispatch",
        policy_id: "another-policy",
        alert_type: "workers_observability_alert",
        mechanism_type: "email",
        sent: "2026-08-14T12:05:00.000Z",
      },
    ];
    expect(() =>
      buildCloudflareOperationalAlertEvidence({
        policy: { id: "private-policy-id" },
        history: unrelated,
        receiptConfirmedAt: "2026-08-14T12:06:00.000Z",
        now: new Date("2026-08-14T12:07:00.000Z"),
      }),
    ).toThrow(/No dispatch/);
    expect(() =>
      buildCloudflareOperationalAlertEvidence({
        policy: { id: "private-policy-id" },
        history: [
          {
            id: "dispatch-id",
            policy_id: "private-policy-id",
            alert_type: "workers_observability_alert",
            mechanism_type: "email",
            sent: "2026-08-14T12:05:00.000Z",
          },
        ],
        receiptConfirmedAt: "2026-08-14T12:04:00.000Z",
        now: new Date("2026-08-14T12:07:00.000Z"),
      }),
    ).toThrow(/at or after/);
  });
});
