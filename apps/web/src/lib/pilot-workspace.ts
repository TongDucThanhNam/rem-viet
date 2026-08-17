import {
  isCleanDeploymentProvenance,
  type DeploymentProvenance,
} from "@rem-viet/cms";
import { z } from "zod";

export const timedPilotTaskKeys = [
  "loginAndRole",
  "editHeroImageFaqAndGallery",
  "privateResponsivePreview",
  "publishRestoreAndRepublish",
  "pageSlugAndRedirect",
  "sanitizedRichTextPost",
  "leadInboxNoteAndCsv",
  "referencedMediaDeleteBlocked",
] as const;

export type TimedPilotTaskKey = (typeof timedPilotTaskKeys)[number];

export const pilotTasks = [
  {
    key: "loginAndRole",
    title: "Đăng nhập và xác nhận vai trò",
    description:
      "Tự đăng nhập, nhận biết vai trò hiện tại và phạm vi thao tác được phép.",
    expected: "Vai trò hiển thị đúng; không cần developer giải thích quyền.",
    to: "/admin/dashboard",
  },
  {
    key: "editHeroImageFaqAndGallery",
    title: "Biên tập trang chủ trực tiếp",
    description:
      "Sửa Hero, thay ảnh có alt, thêm FAQ và đổi thứ tự gallery bằng canvas.",
    expected: "Không mở JSON/code; thay đổi tự lưu và còn nguyên sau reload.",
    to: "/admin/home",
  },
  {
    key: "privateResponsivePreview",
    title: "Kiểm tra preview riêng tư",
    description:
      "Xem bản nháp ở desktop/mobile và xác nhận website công khai chưa đổi.",
    expected: "Preview phản ánh draft; public vẫn đọc published snapshot.",
    to: "/admin/home-preview",
  },
  {
    key: "publishRestoreAndRepublish",
    title: "Publish, restore và publish lại",
    description:
      "Xuất bản thay đổi, kiểm tra public, khôi phục revision rồi xuất bản lại.",
    expected: "Restore tạo draft mới và không âm thầm đổi public.",
    to: "/admin/home",
  },
  {
    key: "pageSlugAndRedirect",
    title: "Trang cấu trúc, slug và redirect",
    description:
      "Tạo standard page bằng blocks, đổi slug và giữ đường dẫn cũ bằng redirect.",
    expected: "URL mới hoạt động; URL cũ chuyển đúng và không tạo vòng lặp.",
    to: "/admin/pages",
  },
  {
    key: "sanitizedRichTextPost",
    title: "Bài viết rich text an toàn",
    description:
      "Tạo bài có heading, list, link, ảnh và video bằng trình soạn thảo.",
    expected:
      "Nội dung dán vào sạch định dạng lạ; preview/publish đúng cấu trúc.",
    to: "/admin/posts/new",
  },
  {
    key: "leadInboxNoteAndCsv",
    title: "Xử lý lead và xuất dữ liệu",
    description:
      "Gửi form liên hệ, tìm lead trong inbox, thêm note và xuất CSV.",
    expected:
      "Một submission tạo đúng một lead; CSV không cần thao tác kỹ thuật.",
    to: "/admin/leads",
  },
  {
    key: "referencedMediaDeleteBlocked",
    title: "Xác nhận media đang dùng được bảo vệ",
    description:
      "Thử xóa media đang được nội dung tham chiếu và đọc hướng dẫn phục hồi.",
    expected:
      "Xóa thường bị chặn; màn hình chỉ rõ nơi tài nguyên đang được dùng.",
    to: "/admin/media",
  },
] as const satisfies readonly {
  key: TimedPilotTaskKey;
  title: string;
  description: string;
  expected: string;
  to: string;
}[];

const taskStateSchema = z.object({
  completed: z.boolean(),
  minutes: z.number().nonnegative().max(30),
});

const taskStatesSchema = z.object(
  Object.fromEntries(
    timedPilotTaskKeys.map((key) => [key, taskStateSchema]),
  ) as Record<TimedPilotTaskKey, typeof taskStateSchema>,
);

export const pilotWorkspaceSchema = z
  .object({
    schemaVersion: z.literal(1),
    startedAt: z.string().datetime().nullable(),
    completedAt: z.string().datetime().nullable(),
    activeTask: z.enum(timedPilotTaskKeys).nullable(),
    activeTaskStartedAt: z.string().datetime().nullable(),
    tasks: taskStatesSchema,
    noJsonOrCode: z.boolean(),
    testerName: z.string().max(120),
    browserAndDevice: z.string().max(200),
    editableRecurringContentPercent: z.number().min(0).max(100),
    clientManualUsedWithoutExtraGuidance: z.boolean(),
    developerInterventions: z.number().int().nonnegative().max(100),
    openP0: z.number().int().nonnegative().max(100),
    openP1: z.number().int().nonnegative().max(100),
    issueIds: z.array(z.string().min(1).max(120)).max(100),
    confusionPoints: z.array(z.string().min(1).max(500)).max(100),
  })
  .strict();

export type PilotWorkspace = z.infer<typeof pilotWorkspaceSchema>;

function emptyTasks(): PilotWorkspace["tasks"] {
  return Object.fromEntries(
    timedPilotTaskKeys.map((key) => [key, { completed: false, minutes: 0 }]),
  ) as PilotWorkspace["tasks"];
}

export function createPilotWorkspace(): PilotWorkspace {
  return {
    schemaVersion: 1,
    startedAt: null,
    completedAt: null,
    activeTask: null,
    activeTaskStartedAt: null,
    tasks: emptyTasks(),
    noJsonOrCode: false,
    testerName: "",
    browserAndDevice: "",
    editableRecurringContentPercent: 0,
    clientManualUsedWithoutExtraGuidance: false,
    developerInterventions: 0,
    openP0: 0,
    openP1: 0,
    issueIds: [],
    confusionPoints: [],
  };
}

export function parsePilotWorkspace(value: unknown) {
  return pilotWorkspaceSchema.safeParse(value);
}

export function pilotStorageKey(
  deployment: DeploymentProvenance,
  operatorId: string,
) {
  return `rem-viet:pilot-workspace:v1:${deployment.siteId}:${deployment.stage}:${operatorId}`;
}

export function canStartPilot(deployment: DeploymentProvenance) {
  return (
    deployment.stage === "staging" && isCleanDeploymentProvenance(deployment)
  );
}

export function startPilotWorkspace(
  workspace: PilotWorkspace,
  now: Date,
): PilotWorkspace {
  if (workspace.startedAt) return workspace;
  return { ...workspace, startedAt: now.toISOString() };
}

export function startPilotTask(
  workspace: PilotWorkspace,
  key: TimedPilotTaskKey,
  now: Date,
): PilotWorkspace {
  if (!workspace.startedAt || workspace.completedAt || workspace.activeTask)
    return workspace;
  if (workspace.tasks[key].completed) return workspace;
  return {
    ...workspace,
    activeTask: key,
    activeTaskStartedAt: now.toISOString(),
  };
}

export function completePilotTask(
  workspace: PilotWorkspace,
  key: TimedPilotTaskKey,
  now: Date,
): PilotWorkspace {
  if (workspace.activeTask !== key || !workspace.activeTaskStartedAt)
    return workspace;
  const startedAt = Date.parse(workspace.activeTaskStartedAt);
  const elapsed = now.getTime() - startedAt;
  if (!Number.isFinite(startedAt) || elapsed < 0) return workspace;
  const minutes = Math.max(0.01, Math.round((elapsed / 60_000) * 100) / 100);
  return {
    ...workspace,
    activeTask: null,
    activeTaskStartedAt: null,
    tasks: {
      ...workspace.tasks,
      [key]: { completed: true, minutes },
    },
  };
}

export function completedPilotTaskCount(workspace: PilotWorkspace) {
  return timedPilotTaskKeys.filter((key) => workspace.tasks[key].completed)
    .length;
}

export function pilotTaskMinutes(workspace: PilotWorkspace) {
  return timedPilotTaskKeys.reduce(
    (total, key) => total + workspace.tasks[key].minutes,
    0,
  );
}

export function canCompletePilot(workspace: PilotWorkspace) {
  return (
    Boolean(workspace.startedAt) &&
    !workspace.completedAt &&
    !workspace.activeTask &&
    completedPilotTaskCount(workspace) === timedPilotTaskKeys.length &&
    workspace.noJsonOrCode
  );
}

export function completePilotWorkspace(
  workspace: PilotWorkspace,
  now: Date,
): PilotWorkspace {
  if (!canCompletePilot(workspace)) return workspace;
  return { ...workspace, completedAt: now.toISOString() };
}

function roundedDurationMinutes(workspace: PilotWorkspace, now: Date) {
  if (!workspace.startedAt) return 0;
  const end = workspace.completedAt
    ? Date.parse(workspace.completedAt)
    : now.getTime();
  const start = Date.parse(workspace.startedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.max(0.01, Math.round(((end - start) / 60_000) * 100) / 100);
}

export function buildPilotObserverDraft(input: {
  deployment: DeploymentProvenance;
  now: Date;
  origin: string;
  workspace: PilotWorkspace;
}) {
  const { deployment, now, origin, workspace } = input;
  if (!isCleanDeploymentProvenance(deployment))
    throw new Error("Pilot export requires clean deployment provenance.");
  if (deployment.stage !== "staging")
    throw new Error("Pilot export requires the staging deployment.");

  return {
    schemaVersion: 1,
    siteId: deployment.siteId,
    stage: "staging",
    origin,
    recordedAt: "",
    pilot: {
      deployment: {
        commit: deployment.commit,
        inputSha256: deployment.inputSha256,
      },
      testerName: workspace.testerName.trim(),
      testerRelationship: "non-developer",
      browserAndDevice: workspace.browserAndDevice.trim(),
      startedAt: workspace.startedAt ?? "",
      completedAt: workspace.completedAt ?? "",
      durationMinutes: roundedDurationMinutes(workspace, now),
      trainingDurationMinutes: roundedDurationMinutes(workspace, now),
      revisionRestoreMinutes:
        workspace.tasks.publishRestoreAndRepublish.minutes,
      editableRecurringContentPercent:
        workspace.editableRecurringContentPercent,
      clientManualUsedWithoutExtraGuidance:
        workspace.clientManualUsedWithoutExtraGuidance,
      developerInterventions: workspace.developerInterventions,
      openP0: workspace.openP0,
      openP1: workspace.openP1,
      issueIds: workspace.issueIds,
      tasks: {
        loginAndRole: workspace.tasks.loginAndRole.completed,
        editHeroImageFaqAndGallery:
          workspace.tasks.editHeroImageFaqAndGallery.completed,
        privateResponsivePreview:
          workspace.tasks.privateResponsivePreview.completed,
        publishRestoreAndRepublish:
          workspace.tasks.publishRestoreAndRepublish.completed,
        pageSlugAndRedirect: workspace.tasks.pageSlugAndRedirect.completed,
        sanitizedRichTextPost: workspace.tasks.sanitizedRichTextPost.completed,
        leadInboxNoteAndCsv: workspace.tasks.leadInboxNoteAndCsv.completed,
        referencedMediaDeleteBlocked:
          workspace.tasks.referencedMediaDeleteBlocked.completed,
        noJsonOrCode: workspace.noJsonOrCode,
      },
    },
    taskMinutes: Object.fromEntries(
      timedPilotTaskKeys.map((key) => [key, workspace.tasks[key].minutes]),
    ),
    confusionPoints: workspace.confusionPoints,
    testerApproval: {
      name: workspace.testerName.trim(),
      approvedAt: "",
    },
  };
}
