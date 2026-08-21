import { resolveCmsEditorialReviewPresentation } from "@agency/cms-admin";
import { Button } from "@rem-viet/ui/components/button";
import { Card, CardContent } from "@rem-viet/ui/components/card";
import { Checkbox } from "@rem-viet/ui/components/checkbox";
import { Input } from "@rem-viet/ui/components/input";
import { Textarea } from "@rem-viet/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CircleAlert,
  Clock3,
  ListChecks,
  MessageSquareMore,
  Send,
  UserRoundCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import EditorialComments from "@/components/editorial-comments";
import { useTRPC } from "@/utils/trpc";

type EditorialReviewPanelProps = {
  commentGranted: boolean;
  decisionGranted: boolean;
  currentVersion: number;
  dirty: boolean;
  documentId: string;
  documentType: "page" | "post";
  onSaveDraft: () => Promise<{ version: number } | null>;
  publishGranted: boolean;
  requestGranted: boolean;
};

const roleLabels = {
  admin: "Quản trị viên",
  editor: "Biên tập viên",
  owner: "Chủ sở hữu",
  system: "Hệ thống",
} as const;

function formatReviewDate(value: string | Date | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("vi-VN");
}

function checklistFromText(value: string) {
  return value
    .split("\n")
    .map((label) => label.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((label, index) => ({
      id: `check-${index + 1}`,
      label,
      required: true,
    }));
}

function toggleValue(values: string[], value: string, checked: boolean) {
  return checked
    ? [...new Set([...values, value])]
    : values.filter((candidate) => candidate !== value);
}

export default function EditorialReviewPanel({
  commentGranted,
  decisionGranted,
  currentVersion,
  dirty,
  documentId,
  documentType,
  onSaveDraft,
  publishGranted,
  requestGranted,
}: EditorialReviewPanelProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const target = useMemo(
    () => ({ documentId, documentType }),
    [documentId, documentType],
  );
  const reviewQuery = useQuery(
    trpc.content.reviews.byDocument.queryOptions(target),
  );
  const requestReview = useMutation(
    trpc.content.reviews.request.mutationOptions(),
  );
  const decideReview = useMutation(
    trpc.content.reviews.decide.mutationOptions(),
  );
  const participantsQuery = useQuery({
    ...trpc.content.reviews.participants.queryOptions(),
    enabled: requestGranted || commentGranted || decisionGranted,
  });
  const [note, setNote] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [assigneeRoles, setAssigneeRoles] = useState<string[]>([]);
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [checklistText, setChecklistText] = useState("");
  const [completedChecklistItemIds, setCompletedChecklistItemIds] = useState<
    string[]
  >([]);
  const state = reviewQuery.data;
  const participants = participantsQuery.data ?? [];
  const participantById = useMemo(
    () =>
      new Map(participants.map((participant) => [participant.id, participant])),
    [participants],
  );
  const presentation = resolveCmsEditorialReviewPresentation({
    currentVersion,
    decisionGranted,
    dirty,
    error: reviewQuery.isError,
    loading: reviewQuery.isLoading,
    requestGranted,
    state: state ?? null,
  });
  const isPending = requestReview.isPending || decideReview.isPending;

  useEffect(() => {
    setCompletedChecklistItemIds(
      state?.checklist
        .filter((item) => item.completed)
        .map((item) => item.id) ?? [],
    );
  }, [state?.checklist, state?.reviewVersion]);

  const refresh = async () => {
    await Promise.all([
      reviewQuery.refetch(),
      queryClient.invalidateQueries(trpc.content.reviews.queue.queryFilter()),
    ]);
  };

  const prepareVersion = async () => {
    if (!dirty) return currentVersion;
    const saved = await onSaveDraft();
    return saved?.version ?? null;
  };

  const handleRequest = async () => {
    const version = await prepareVersion();
    if (version === null) return;
    const parsedDueAt = dueAt ? new Date(dueAt) : null;
    if (parsedDueAt && Number.isNaN(parsedDueAt.getTime())) {
      toast.error("Hạn duyệt không hợp lệ.");
      return;
    }
    try {
      await requestReview.mutateAsync({
        ...target,
        expectedVersion: version,
        note,
        assigneeIds,
        assigneeRoles,
        mentionIds,
        dueAt: parsedDueAt?.toISOString() ?? null,
        checklist: checklistFromText(checklistText),
        notify: true,
      });
      setNote("");
      setDueAt("");
      setAssigneeIds([]);
      setAssigneeRoles([]);
      setMentionIds([]);
      setChecklistText("");
      await refresh();
      toast.success(`Đã gửi bản v${version} để duyệt.`);
    } catch (error) {
      await reviewQuery.refetch();
      toast.error(
        error instanceof Error ? error.message : "Không thể gửi yêu cầu duyệt.",
      );
    }
  };

  const handleDecision = async (decision: "approved" | "changes_requested") => {
    if (decision === "changes_requested" && !note.trim()) {
      toast.error("Hãy ghi rõ thay đổi cần thực hiện.");
      return;
    }
    try {
      await decideReview.mutateAsync({
        ...target,
        decision,
        expectedVersion: currentVersion,
        note,
        completedChecklistItemIds,
      });
      setNote("");
      await refresh();
      toast.success(
        decision === "approved"
          ? `Đã duyệt bản v${currentVersion}.`
          : `Đã gửi yêu cầu chỉnh sửa cho bản v${currentVersion}.`,
      );
    } catch (error) {
      await reviewQuery.refetch();
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật xét duyệt.",
      );
    }
  };

  const status = (() => {
    if (presentation.kind === "loading") {
      return {
        icon: Clock3,
        label: "Đang tải trạng thái duyệt",
        detail: "Đang đối chiếu với phiên bản máy chủ.",
      };
    }
    if (presentation.kind === "unavailable" || !state) {
      return {
        icon: CircleAlert,
        label: "Chưa tải được trạng thái duyệt",
        detail: reviewQuery.error?.message ?? "Hãy thử tải lại.",
      };
    }
    if (presentation.kind === "dirty") {
      return {
        icon: CircleAlert,
        label: "Thay đổi chưa lưu chưa được xét duyệt",
        detail: `Trạng thái gần nhất chỉ áp dụng cho bản v${state.reviewVersion} trên máy chủ. Lưu và gửi phiên bản mới để xét duyệt lại.`,
      };
    }
    if (presentation.kind === "published") {
      return {
        icon: BadgeCheck,
        label: "Bản đã duyệt đã được xuất bản",
        detail: `Bản v${state.reviewVersion} có đầy đủ dấu vết xét duyệt.`,
      };
    }
    if (presentation.kind === "stale") {
      return {
        icon: CircleAlert,
        label: "Yêu cầu cũ không còn áp dụng",
        detail: `Nội dung hiện tại là v${currentVersion}; lần duyệt gần nhất gắn với v${state.reviewVersion}.`,
      };
    }
    if (presentation.kind === "requested") {
      return {
        icon: Clock3,
        label: `Bản v${state.reviewVersion} đang chờ duyệt`,
        detail: decisionGranted
          ? "Kiểm tra bản xem trước trước khi ra quyết định."
          : "Người có quyền xét duyệt sẽ nhận yêu cầu này.",
      };
    }
    if (presentation.kind === "changes-requested") {
      return {
        icon: MessageSquareMore,
        label: `Bản v${state.reviewVersion} cần chỉnh sửa`,
        detail: "Lưu một phiên bản mới rồi gửi lại để duyệt.",
      };
    }
    if (presentation.kind === "approved") {
      return {
        icon: BadgeCheck,
        label: `Bản v${state.reviewVersion} đã được duyệt`,
        detail: publishGranted
          ? "Bản được duyệt có thể xuất bản từ thanh hành động."
          : "Đang chờ người có quyền xuất bản.",
      };
    }
    return {
      icon: MessageSquareMore,
      label: "Chưa gửi xét duyệt",
      detail: "Yêu cầu duyệt sẽ luôn gắn với đúng phiên bản đã lưu.",
    };
  })();
  const StatusIcon = status.icon;
  const canRequest = presentation.actions.request;
  const canDecide = presentation.actions.approve;
  const missingRequiredChecklist =
    state?.checklist.filter(
      (item) => item.required && !completedChecklistItemIds.includes(item.id),
    ) ?? [];
  const assignmentLabels = state
    ? [
        ...state.assigneeIds.map((id) => participantById.get(id)?.name ?? id),
        ...state.assigneeRoles.map(
          (role) => roleLabels[role as keyof typeof roleLabels] ?? role,
        ),
      ]
    : [];

  return (
    <Card
      className="mx-auto w-full max-w-4xl rounded-md"
      data-testid="editorial-review-panel"
    >
      <CardContent className="grid gap-4 pt-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted">
            <StatusIcon aria-hidden className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-sm font-semibold">{status.label}</h2>
              <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Xét duyệt nội dung
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {status.detail}
            </p>
            {state?.requestedAt ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {roleLabels[state.actorRole ?? "system"]} ·{" "}
                {formatReviewDate(state.requestedAt)}
              </p>
            ) : null}
          </div>
          {reviewQuery.isError ? (
            <Button
              onClick={() => void reviewQuery.refetch()}
              size="sm"
              variant="outline"
            >
              Thử lại
            </Button>
          ) : null}
        </div>

        {state &&
        (state.dueAt || assignmentLabels.length || state.mentionIds.length) ? (
          <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-xs sm:grid-cols-2">
            {state.dueAt ? (
              <p
                className={
                  state.overdue
                    ? "font-medium text-destructive"
                    : "text-muted-foreground"
                }
              >
                <Clock3 aria-hidden className="mr-1.5 inline size-3.5" />
                {state.overdue ? "Quá hạn: " : "Hạn duyệt: "}
                {formatReviewDate(state.dueAt)}
              </p>
            ) : null}
            {assignmentLabels.length ? (
              <p className="text-muted-foreground">
                <UserRoundCheck
                  aria-hidden
                  className="mr-1.5 inline size-3.5"
                />
                Phụ trách: {assignmentLabels.join(", ")}
              </p>
            ) : null}
            {state.mentionIds.length ? (
              <p className="text-muted-foreground sm:col-span-2">
                Nhắc đến:{" "}
                {state.mentionIds
                  .map((id) => participantById.get(id)?.name ?? id)
                  .join(", ")}
              </p>
            ) : null}
          </div>
        ) : null}

        {state?.note ? (
          <blockquote className="border-l-2 pl-3 text-xs leading-5 text-muted-foreground">
            {state.note}
          </blockquote>
        ) : null}

        {state?.checklist.length ? (
          <fieldset className="grid gap-2 rounded-md border p-3">
            <legend className="px-1 text-xs font-medium">
              Danh sách kiểm tra
            </legend>
            {state.checklist.map((item) => {
              const checked = completedChecklistItemIds.includes(item.id);
              return (
                <label
                  className="flex items-start gap-2 text-xs leading-5"
                  key={item.id}
                >
                  <Checkbox
                    checked={checked}
                    className="mt-0.5"
                    disabled={!canDecide || isPending}
                    onCheckedChange={(value) =>
                      setCompletedChecklistItemIds((current) =>
                        toggleValue(current, item.id, value === true),
                      )
                    }
                  />
                  <span>
                    {item.label}
                    {item.required ? (
                      <span className="ml-1 text-muted-foreground">
                        (bắt buộc)
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
            {canDecide && missingRequiredChecklist.length ? (
              <p className="text-[11px] text-muted-foreground">
                Hoàn tất {missingRequiredChecklist.length} mục bắt buộc trước
                khi duyệt.
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {canRequest || canDecide ? (
          <div className="grid gap-2 border-t pt-4">
            <label
              className="text-xs font-medium"
              htmlFor={`${documentType}-review-note`}
            >
              {canDecide ? "Ghi chú xét duyệt" : "Ghi chú cho người duyệt"}
            </label>
            <Textarea
              id={`${documentType}-review-note`}
              maxLength={500}
              placeholder={
                canDecide
                  ? "Tóm tắt quyết định hoặc nêu rõ thay đổi cần thực hiện…"
                  : "Điểm cần người duyệt lưu ý (không bắt buộc)…"
              }
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            {canRequest ? (
              <div className="mt-1 grid gap-4 rounded-md border bg-muted/20 p-3">
                <div className="grid gap-1.5 sm:max-w-sm">
                  <label
                    className="text-xs font-medium"
                    htmlFor={`${documentType}-review-due-at`}
                  >
                    Hạn duyệt
                  </label>
                  <Input
                    id={`${documentType}-review-due-at`}
                    onChange={(event) => setDueAt(event.target.value)}
                    type="datetime-local"
                    value={dueAt}
                  />
                </div>

                <fieldset className="grid gap-2">
                  <legend className="text-xs font-medium">
                    Giao cho vai trò
                  </legend>
                  <div className="flex flex-wrap gap-4">
                    {(["owner", "admin"] as const).map((role) => (
                      <label
                        className="flex items-center gap-2 text-xs"
                        key={role}
                      >
                        <Checkbox
                          checked={assigneeRoles.includes(role)}
                          onCheckedChange={(value) =>
                            setAssigneeRoles((current) =>
                              toggleValue(current, role, value === true),
                            )
                          }
                        />
                        {roleLabels[role]}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="grid gap-2">
                  <legend className="text-xs font-medium">
                    Người phụ trách cụ thể
                  </legend>
                  {participantsQuery.isLoading ? (
                    <p className="text-[11px] text-muted-foreground">
                      Đang tải danh sách nhân sự…
                    </p>
                  ) : participants.filter(
                      (participant) => participant.canDecide,
                    ).length ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {participants
                        .filter((participant) => participant.canDecide)
                        .map((participant) => (
                          <label
                            className="flex items-center gap-2 text-xs"
                            key={participant.id}
                          >
                            <Checkbox
                              checked={assigneeIds.includes(participant.id)}
                              onCheckedChange={(value) =>
                                setAssigneeIds((current) =>
                                  toggleValue(
                                    current,
                                    participant.id,
                                    value === true,
                                  ),
                                )
                              }
                            />
                            <span>
                              {participant.name}{" "}
                              <span className="text-muted-foreground">
                                · {roleLabels[participant.role]}
                              </span>
                            </span>
                          </label>
                        ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Chưa có Owner hoặc Admin khả dụng.
                    </p>
                  )}
                </fieldset>

                {participants.length ? (
                  <fieldset className="grid gap-2">
                    <legend className="text-xs font-medium">
                      Nhắc đến và gửi thông báo
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {participants.map((participant) => (
                        <label
                          className="flex items-center gap-2 text-xs"
                          key={participant.id}
                        >
                          <Checkbox
                            checked={mentionIds.includes(participant.id)}
                            onCheckedChange={(value) =>
                              setMentionIds((current) =>
                                toggleValue(
                                  current,
                                  participant.id,
                                  value === true,
                                ),
                              )
                            }
                          />
                          {participant.name}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : null}

                <div className="grid gap-1.5">
                  <label
                    className="text-xs font-medium"
                    htmlFor={`${documentType}-review-checklist`}
                  >
                    <ListChecks
                      aria-hidden
                      className="mr-1.5 inline size-3.5"
                    />
                    Danh sách kiểm tra bắt buộc
                  </label>
                  <Textarea
                    id={`${documentType}-review-checklist`}
                    maxLength={2_000}
                    onChange={(event) => setChecklistText(event.target.value)}
                    placeholder={
                      "Mỗi dòng là một mục, ví dụ:\nKiểm tra SEO\nXác nhận pháp lý"
                    }
                    rows={3}
                    value={checklistText}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Người duyệt phải hoàn tất mọi dòng trước khi phê duyệt.
                  </p>
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              {canDecide ? (
                <>
                  <Button
                    disabled={isPending}
                    onClick={() => void handleDecision("changes_requested")}
                    variant="outline"
                  >
                    <MessageSquareMore aria-hidden />
                    Yêu cầu chỉnh sửa
                  </Button>
                  <Button
                    disabled={isPending || missingRequiredChecklist.length > 0}
                    onClick={() => void handleDecision("approved")}
                  >
                    <BadgeCheck aria-hidden />
                    Duyệt bản v{currentVersion}
                  </Button>
                </>
              ) : (
                <Button
                  disabled={isPending}
                  onClick={() => void handleRequest()}
                >
                  <Send aria-hidden />
                  {dirty
                    ? "Lưu và gửi duyệt"
                    : `Gửi duyệt bản v${currentVersion}`}
                </Button>
              )}
            </div>
          </div>
        ) : null}

        <EditorialComments
          commentGranted={commentGranted}
          decisionGranted={decisionGranted}
          documentId={documentId}
          documentType={documentType}
          participants={participants}
        />
      </CardContent>
    </Card>
  );
}
