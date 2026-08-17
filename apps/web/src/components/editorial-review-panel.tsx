import { resolveCmsEditorialReviewPresentation } from "@agency/cms-admin";
import { Button } from "@rem-viet/ui/components/button";
import { Card, CardContent } from "@rem-viet/ui/components/card";
import { Textarea } from "@rem-viet/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CircleAlert,
  Clock3,
  MessageSquareMore,
  Send,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

type EditorialReviewPanelProps = {
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

export default function EditorialReviewPanel({
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
  const [note, setNote] = useState("");
  const state = reviewQuery.data;
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
    try {
      await requestReview.mutateAsync({
        ...target,
        expectedVersion: version,
        note,
      });
      setNote("");
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

        {state?.note ? (
          <blockquote className="border-l-2 pl-3 text-xs leading-5 text-muted-foreground">
            {state.note}
          </blockquote>
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
                    disabled={isPending}
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
      </CardContent>
    </Card>
  );
}
