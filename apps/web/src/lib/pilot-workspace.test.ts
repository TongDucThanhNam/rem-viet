import { describe, expect, test } from "bun:test";
import type { DeploymentProvenance } from "@rem-viet/cms";

import { pilotEvidenceRecordSchema } from "../../../../scripts/release-evidence";
import {
  buildPilotObserverDraft,
  canCompletePilot,
  canStartPilot,
  completePilotTask,
  completePilotWorkspace,
  completedPilotTaskCount,
  createPilotWorkspace,
  parsePilotWorkspace,
  pilotStorageKey,
  startPilotTask,
  startPilotWorkspace,
  timedPilotTaskKeys,
} from "./pilot-workspace";

const cleanDeployment: DeploymentProvenance = {
  siteId: "rem-viet",
  stage: "staging",
  commit: "a".repeat(40),
  inputSha256: "b".repeat(64),
  sourceState: "clean",
};

function completedWorkspace() {
  const epoch = Date.parse("2026-08-17T08:00:00.000Z");
  let workspace = startPilotWorkspace(createPilotWorkspace(), new Date(epoch));
  for (const [index, key] of timedPilotTaskKeys.entries()) {
    workspace = startPilotTask(
      workspace,
      key,
      new Date(epoch + index * 60_000),
    );
    workspace = completePilotTask(
      workspace,
      key,
      new Date(epoch + (index + 1) * 60_000),
    );
  }
  return completePilotWorkspace(
    {
      ...workspace,
      noJsonOrCode: true,
      testerName: "Nguyen Client",
      browserAndDevice: "Chrome on Windows laptop",
      editableRecurringContentPercent: 95,
      clientManualUsedWithoutExtraGuidance: true,
      confusionPoints: ["Khó tìm lịch sử revision"],
    },
    new Date(epoch + timedPilotTaskKeys.length * 60_000),
  );
}

describe("handover pilot workspace", () => {
  test("starts only on a clean and fully identified staging deployment", () => {
    expect(canStartPilot(cleanDeployment)).toBe(true);
    expect(canStartPilot({ ...cleanDeployment, sourceState: "dirty" })).toBe(
      false,
    );
    expect(canStartPilot({ ...cleanDeployment, stage: "dev" })).toBe(false);
    expect(canStartPilot({ ...cleanDeployment, commit: "unknown" })).toBe(
      false,
    );
    expect(pilotStorageKey(cleanDeployment, "operator-1")).toBe(
      "rem-viet:pilot-workspace:v1:rem-viet:staging:operator-1",
    );
  });

  test("persists one active timer and accumulates exact task minutes", () => {
    const started = startPilotWorkspace(
      createPilotWorkspace(),
      new Date("2026-08-17T08:00:00.000Z"),
    );
    const active = startPilotTask(
      started,
      "loginAndRole",
      new Date("2026-08-17T08:01:00.000Z"),
    );
    expect(
      startPilotTask(
        active,
        "privateResponsivePreview",
        new Date("2026-08-17T08:02:00.000Z"),
      ),
    ).toEqual(active);

    const completed = completePilotTask(
      active,
      "loginAndRole",
      new Date("2026-08-17T08:03:30.000Z"),
    );
    expect(completed.tasks.loginAndRole).toEqual({
      completed: true,
      minutes: 2.5,
    });
    expect(completed.activeTask).toBeNull();
    expect(completedPilotTaskCount(completed)).toBe(1);
    expect(parsePilotWorkspace(completed).success).toBe(true);
  });

  test("cannot complete until every timed task and the no-code assertion pass", () => {
    let workspace = startPilotWorkspace(
      createPilotWorkspace(),
      new Date("2026-08-17T08:00:00.000Z"),
    );
    for (const [index, key] of timedPilotTaskKeys.entries()) {
      workspace = startPilotTask(
        workspace,
        key,
        new Date(Date.parse("2026-08-17T08:00:00.000Z") + index * 60_000),
      );
      workspace = completePilotTask(
        workspace,
        key,
        new Date(Date.parse("2026-08-17T08:00:30.000Z") + index * 60_000),
      );
    }
    expect(canCompletePilot(workspace)).toBe(false);
    workspace = { ...workspace, noJsonOrCode: true };
    expect(canCompletePilot(workspace)).toBe(true);
    expect(
      completePilotWorkspace(workspace, new Date("2026-08-17T08:10:00.000Z"))
        .completedAt,
    ).toBe("2026-08-17T08:10:00.000Z");
  });

  test("exports a verifier-shaped observer draft without manufacturing approval", () => {
    const workspace = completedWorkspace();
    const draft = buildPilotObserverDraft({
      deployment: cleanDeployment,
      now: new Date("2026-08-17T08:08:00.000Z"),
      origin: "https://staging.example.com",
      workspace,
    });

    expect(draft).toMatchObject({
      siteId: "rem-viet",
      stage: "staging",
      origin: "https://staging.example.com",
      recordedAt: "",
      pilot: {
        deployment: {
          commit: "a".repeat(40),
          inputSha256: "b".repeat(64),
        },
        testerName: "Nguyen Client",
        durationMinutes: 8,
      },
      confusionPoints: ["Khó tìm lịch sử revision"],
      testerApproval: { name: "Nguyen Client", approvedAt: "" },
    });

    expect(
      pilotEvidenceRecordSchema.safeParse({
        ...draft,
        recordedAt: "2026-08-17T08:10:00.000Z",
        testerApproval: {
          ...draft.testerApproval,
          approvedAt: "2026-08-17T08:09:00.000Z",
        },
      }).success,
    ).toBe(true);
  });

  test("refuses observer export from dirty provenance", () => {
    expect(() =>
      buildPilotObserverDraft({
        deployment: { ...cleanDeployment, sourceState: "dirty" },
        now: new Date(),
        origin: "https://staging.example.com",
        workspace: createPilotWorkspace(),
      }),
    ).toThrow("clean deployment provenance");
  });
});
