import {
  CmsDraftStatusSlots,
  areCmsRevisionValuesEqual,
  useCmsAutosave,
  useCmsFocusWorkspace,
  type CmsDraftSaveState,
} from "@agency/cms-admin";
import {
  commitCmsDraftHistory,
  createCmsDraftHistory,
  redoCmsDraftHistory,
  undoCmsDraftHistory,
} from "@agency/cms-visual-editor";
import { parseRichTextDocument } from "@rem-viet/cms";
import { Button, buttonVariants } from "@rem-viet/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import {
  AlertTriangle,
  Check,
  Clock3,
  Eye,
  History,
  Monitor,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AdminPage } from "@/components/admin-shell";
import {
  type CmsPostFormValues,
  validateCmsPostFormValues,
} from "@/components/cms-post-form";
import { AdminStatus, ConfirmDestructiveAction } from "@/components/admin-ui";
import EditorialReviewPanel from "@/components/editorial-review-panel";
import PostEditorWorkspace from "@/components/post-editor-workspace";
import PostRevisionHistory, {
  type PostRevisionItem,
} from "@/components/post-revision-history";
import PostResponsivePreview from "@/components/post-responsive-preview";
import { getAdminUser } from "@/functions/get-admin-user";
import { useSaveBeforeNavigation } from "@/hooks/use-save-before-navigation";
import type { PostRichTextCompositionCommand } from "@/lib/post-rich-text-composition";
import { applyPostRichTextComposition } from "@/lib/post-rich-text-composition";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/posts/$postId/edit")({
  component: EditPostRoute,
  beforeLoad: async () => {
    const session = await getAdminUser();
    return { session };
  },
  loader: async ({ context }) => {
    if (!context.session) {
      throw redirect({ to: "/dang-nhap" });
    }
  },
});

type SaveState = CmsDraftSaveState;

type PostFormSource = Omit<CmsPostFormValues, "content" | "slug"> & {
  _id: string;
  content: unknown;
  publishedRevisionId: string | null;
  scheduledAt: string | null;
  slug: string;
  version: number;
};

function formValuesFromPost(post: PostFormSource): CmsPostFormValues {
  return {
    title: post.title,
    slug: post.slug,
    folder: post.folder,
    description: post.description,
    coverImage: post.coverImage,
    tags: post.tags,
    content:
      typeof post.content === "string"
        ? post.content
        : JSON.stringify(post.content, null, 2),
    publishDate: post.publishDate,
    seoTitle: post.seoTitle,
    seoDescription: post.seoDescription,
    canonicalUrl: post.canonicalUrl,
    ogImage: post.ogImage,
    robotsIndex: post.robotsIndex,
    robotsFollow: post.robotsFollow,
  };
}

function EditPostRoute() {
  const { postId } = Route.useParams();
  const { session } = Route.useRouteContext();
  const canWrite = session?.capabilities.includes("content.write") ?? false;
  const canPublish = session?.capabilities.includes("content.publish") ?? false;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const postQuery = useQuery(trpc.content.posts.byId.queryOptions({ postId }));
  const updatePost = useMutation(trpc.content.posts.update.mutationOptions());
  const revisionsQuery = useQuery(
    trpc.content.posts.revisions.queryOptions({ postId }),
  );
  const publishPost = useMutation(trpc.content.posts.publish.mutationOptions());
  const restorePost = useMutation(trpc.content.posts.restore.mutationOptions());
  const schedulePost = useMutation(
    trpc.content.posts.schedule.mutationOptions(),
  );
  const unschedulePost = useMutation(
    trpc.content.posts.unschedule.mutationOptions(),
  );
  const [scheduleAt, setScheduleAt] = useState("");
  const [formSeed, setFormSeed] = useState<CmsPostFormValues | null>(null);
  const [draftValues, setDraftValues] = useState<CmsPostFormValues | null>(
    null,
  );
  const [draftHistory, setDraftHistory] = useState(() =>
    createCmsDraftHistory<CmsPostFormValues | null>(null),
  );
  const [selectedPostBlockIndex, setSelectedPostBlockIndex] = useState<
    number | null
  >(null);
  const [formEpoch, setFormEpoch] = useState(0);
  const [workingVersion, setWorkingVersion] = useState<number | null>(null);
  const [serverSlug, setServerSlug] = useState("");
  const [publishedRevisionId, setPublishedRevisionId] = useState<string | null>(
    null,
  );
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("clean");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [slugDecisionRequired, setSlugDecisionRequired] = useState(false);
  const [createRedirectOnSlugChange, setCreateRedirectOnSlugChange] =
    useState(true);
  const [comparedRevisionId, setComparedRevisionId] = useState<string | null>(
    null,
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [workspaceFocused, setWorkspaceFocused] = useState(false);
  const {
    onKeyDown: handleFocusedWorkspaceKeyDown,
    triggerRef: workspaceFocusTriggerRef,
    workspaceRef,
  } = useCmsFocusWorkspace({
    focused: workspaceFocused,
    onFocusedChange: setWorkspaceFocused,
  });
  const editGeneration = useRef(0);
  const baselineDraftRef = useRef<CmsPostFormValues | null>(null);
  const draftValuesRef = useRef(draftValues);
  const saving = useRef(false);
  const loadedPostId = useRef<string | null>(null);
  const post = postQuery.data?.data;
  draftValuesRef.current = draftValues;

  const installServerPost = useCallback(
    (nextPost: PostFormSource, state: SaveState = "clean") => {
      const nextValues = formValuesFromPost(nextPost);
      editGeneration.current += 1;
      loadedPostId.current = nextPost._id;
      baselineDraftRef.current = nextValues;
      setFormSeed(nextValues);
      setDraftValues(nextValues);
      setDraftHistory(createCmsDraftHistory(nextValues));
      setSelectedPostBlockIndex(null);
      setWorkingVersion(nextPost.version);
      setServerSlug(nextPost.slug);
      setPublishedRevisionId(nextPost.publishedRevisionId);
      setScheduledAt(nextPost.scheduledAt);
      setDirty(false);
      setSaveState(state);
      setValidationError(null);
      setConflictMessage(null);
      setSlugDecisionRequired(false);
      setCreateRedirectOnSlugChange(true);
      setComparedRevisionId(null);
      setFormEpoch((current) => current + 1);
    },
    [],
  );

  useEffect(() => {
    if (!post || loadedPostId.current === postId) return;
    installServerPost(post as PostFormSource);
  }, [installServerPost, post, postId]);

  const invalidatePostLists = useCallback(
    () =>
      queryClient.invalidateQueries(trpc.content.posts.adminList.queryFilter()),
    [queryClient, trpc],
  );

  const reloadServerVersion = useCallback(async () => {
    const result = await postQuery.refetch();
    const latest = result.data?.data;
    if (!latest) {
      toast.error("Không tải được phiên bản bài viết mới nhất từ máy chủ.");
      return false;
    }
    installServerPost(latest as PostFormSource, "saved");
    await Promise.all([
      queryClient.invalidateQueries(
        trpc.content.posts.revisions.queryFilter({ postId }),
      ),
      invalidatePostLists(),
    ]);
    return true;
  }, [
    installServerPost,
    invalidatePostLists,
    postId,
    postQuery,
    queryClient,
    trpc,
  ]);

  const markDraftChanged = useCallback(
    (nextValues: CmsPostFormValues) => {
      editGeneration.current += 1;
      const changed = !areCmsRevisionValuesEqual(
        baselineDraftRef.current,
        nextValues,
      );
      setDirty(changed);
      setSaveState(
        changed
          ? saving.current
            ? "saving"
            : "dirty"
          : lastSavedAt
            ? "saved"
            : "clean",
      );
      setValidationError(null);
      setConflictMessage(null);
      setSlugDecisionRequired(false);
    },
    [lastSavedAt],
  );

  const handleFormChange = useCallback(
    (values: CmsPostFormValues, historyGroup?: string) => {
      setDraftHistory((current) =>
        areCmsRevisionValuesEqual(values, current.present)
          ? current
          : commitCmsDraftHistory(current, values, {
              group: historyGroup,
              limit: 50,
            }),
      );
      setDraftValues(values);
      markDraftChanged(values);
    },
    [markDraftChanged],
  );

  const canUndoDraft = draftHistory.past.length > 0;
  const canRedoDraft = draftHistory.future.length > 0;

  const navigateDraftHistory = useCallback(
    (direction: "undo" | "redo") => {
      const next =
        direction === "undo"
          ? undoCmsDraftHistory(draftHistory)
          : redoCmsDraftHistory(draftHistory);
      if (next === draftHistory || !next.present) return;
      const nextValues = next.present;
      setDraftHistory(next);
      setDraftValues(nextValues);
      setFormSeed(nextValues);
      setFormEpoch((current) => current + 1);
      const parsed = parseRichTextDocument(nextValues.content);
      setSelectedPostBlockIndex((current) =>
        current === null
          ? null
          : Math.min(current, Math.max(0, (parsed?.blocks.length ?? 1) - 1)),
      );
      markDraftChanged(nextValues);
    },
    [draftHistory, markDraftChanged],
  );

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if ((!event.ctrlKey && !event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      const undo = key === "z" && !event.shiftKey;
      const redo = key === "y" || (key === "z" && event.shiftKey);
      if (!undo && !redo) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('input, textarea, [contenteditable="true"]')
      )
        return;
      if ((undo && !canUndoDraft) || (redo && !canRedoDraft)) return;
      event.preventDefault();
      navigateDraftHistory(undo ? "undo" : "redo");
    };
    window.addEventListener("keydown", handleHistoryShortcut);
    return () => window.removeEventListener("keydown", handleHistoryShortcut);
  }, [canRedoDraft, canUndoDraft, navigateDraftHistory]);

  const handlePostComposition = useCallback(
    (command: PostRichTextCompositionCommand) => {
      const current = draftValuesRef.current;
      if (!current) return;
      const document = parseRichTextDocument(current.content);
      if (!document) return;
      const nextDocument = applyPostRichTextComposition(document, command);
      if (nextDocument === document) return;
      const nextValues = {
        ...current,
        content: JSON.stringify(nextDocument),
      };
      draftValuesRef.current = nextValues;
      handleFormChange(nextValues);
    },
    [handleFormChange],
  );

  const saveNow = useCallback(
    async (
      values: CmsPostFormValues | null,
      options: { announce?: boolean; allowSlugDecision?: boolean } = {},
    ) => {
      if (!values || workingVersion === null || saving.current) return null;
      const error = validateCmsPostFormValues(values);
      if (error) {
        setValidationError(error);
        setSaveState("dirty");
        if (options.announce) toast.error("Nội dung chưa hợp lệ.");
        return null;
      }

      const slugChanged = Boolean(values.slug && values.slug !== serverSlug);
      if (slugChanged && publishedRevisionId && !options.allowSlugDecision) {
        setSlugDecisionRequired(true);
        setSaveState("dirty");
        return null;
      }

      const createRedirect = Boolean(
        slugChanged && publishedRevisionId && createRedirectOnSlugChange,
      );
      const generation = editGeneration.current;
      const valuesAtSave = values;
      saving.current = true;
      setSaveState("saving");
      setValidationError(null);
      setConflictMessage(null);
      setSlugDecisionRequired(false);

      try {
        const result = await updatePost.mutateAsync({
          postId,
          expectedVersion: workingVersion,
          createRedirect,
          ...values,
        });
        const updated = result.data;
        if (!updated)
          throw new Error("Không tải lại được bài viết sau khi lưu.");

        setWorkingVersion(updated.version);
        setServerSlug(updated.slug);
        setPublishedRevisionId(updated.publishedRevisionId);
        setScheduledAt(updated.scheduledAt);
        setLastSavedAt(new Date());
        baselineDraftRef.current = valuesAtSave;
        if (editGeneration.current === generation) {
          setDirty(false);
          setSaveState("saved");
        } else {
          setSaveState("dirty");
        }
        await invalidatePostLists();
        if (options.announce) toast.success("Đã lưu bản nháp.");
        return { version: updated.version };
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : "Lưu bản nháp thất bại.";
        if (/changed since|expected version|conflict/i.test(message)) {
          setSaveState("conflict");
          setConflictMessage(
            "Bài viết đã được sửa ở tab khác. Tải phiên bản mới từ máy chủ hoặc sao chép nội dung hiện tại trước khi tiếp tục.",
          );
          await postQuery.refetch();
        } else {
          setSaveState("dirty");
        }
        setDirty(true);
        toast.error(message);
        return null;
      } finally {
        saving.current = false;
      }
    },
    [
      invalidatePostLists,
      postId,
      postQuery,
      createRedirectOnSlugChange,
      publishedRevisionId,
      serverSlug,
      updatePost,
      workingVersion,
    ],
  );

  const { openAfterSave } = useSaveBeforeNavigation({
    dirty,
    saving: saveState === "saving",
    save: () =>
      saveNow(draftValues, {
        announce: false,
        allowSlugDecision: true,
      }),
  });

  const openPostPreview = useCallback(
    (url: string) => {
      void openAfterSave(url).then((result) => {
        if (result === "popup-blocked") {
          toast.error(
            "Trình duyệt đã chặn thẻ xem trước. Hãy cho phép cửa sổ bật lên.",
          );
        } else if (result === "save-blocked") {
          toast.error("Chưa thể mở bản xem trước vì bản nháp chưa được lưu.");
        }
      });
    },
    [openAfterSave],
  );

  useCmsAutosave({
    changeToken: draftValues,
    conflicted: saveState === "conflict",
    dirty,
    save: () => saveNow(draftValues, { allowSlugDecision: false }),
    saving: saveState === "saving",
  });

  return (
    <AdminPage
      actions={
        formSeed && workingVersion !== null ? (
          <div className="flex flex-wrap gap-2">
            <Button
              aria-pressed={revisionsOpen}
              type="button"
              variant="outline"
              onClick={() => {
                const nextOpen = !revisionsOpen;
                setRevisionsOpen(nextOpen);
                if (nextOpen) {
                  requestAnimationFrame(() =>
                    document
                      .getElementById("post-revision-history")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  );
                }
              }}
            >
              <History aria-hidden />
              {revisionsOpen ? "Ẩn lịch sử" : "Lịch sử"}
            </Button>
            <Button
              aria-pressed={reviewOpen}
              type="button"
              variant="outline"
              onClick={() => setReviewOpen((open) => !open)}
            >
              <Check aria-hidden />
              {reviewOpen ? "Ẩn duyệt" : "Duyệt"}
            </Button>
            <Button
              aria-pressed={previewOpen}
              type="button"
              variant="outline"
              onClick={() => {
                const nextOpen = !previewOpen;
                setPreviewOpen(nextOpen);
                if (!nextOpen) setWorkspaceFocused(false);
              }}
            >
              <Monitor aria-hidden />
              {previewOpen ? "Ẩn canvas" : "Mở canvas"}
            </Button>
            <Link
              className={buttonVariants({ variant: "secondary" })}
              params={{ postId }}
              target="_blank"
              to="/admin/posts/$postId/preview"
              onClick={(event) => {
                event.preventDefault();
                openPostPreview(event.currentTarget.href);
              }}
            >
              <Eye aria-hidden />
              Xem trước
            </Link>
            {canPublish ? (
              <>
                <Button
                  aria-pressed={scheduleOpen}
                  type="button"
                  variant="outline"
                  onClick={() => setScheduleOpen((open) => !open)}
                >
                  <Clock3 aria-hidden />
                  {scheduleOpen ? "Ẩn lịch xuất bản" : "Lịch xuất bản"}
                </Button>
                {scheduleOpen ? (
                  <>
                    <input
                      aria-label="Thời gian xuất bản"
                      className="h-9 rounded-md border bg-background px-3 text-xs"
                      min={new Date(Date.now() + 60_000)
                        .toISOString()
                        .slice(0, 16)}
                      type="datetime-local"
                      value={scheduleAt}
                      onChange={(event) => setScheduleAt(event.target.value)}
                    />
                    {scheduledAt ? (
                      <Button
                        variant="secondary"
                        disabled={
                          unschedulePost.isPending || saveState === "conflict"
                        }
                        onClick={async () => {
                          const saved = dirty
                            ? await saveNow(draftValues, {
                                allowSlugDecision: true,
                              })
                            : { version: workingVersion };
                          if (!saved) return;
                          await unschedulePost.mutateAsync({
                            postId,
                            expectedVersion: saved.version,
                          });
                          await reloadServerVersion();
                          toast.success("Đã hủy lịch.");
                        }}
                      >
                        Hủy lịch {new Date(scheduledAt).toLocaleString("vi-VN")}
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        disabled={
                          !scheduleAt ||
                          schedulePost.isPending ||
                          saveState === "conflict"
                        }
                        onClick={async () => {
                          const saved = dirty
                            ? await saveNow(draftValues, {
                                allowSlugDecision: true,
                              })
                            : { version: workingVersion };
                          if (!saved) return;
                          await schedulePost.mutateAsync({
                            postId,
                            expectedVersion: saved.version,
                            scheduledAt: new Date(scheduleAt),
                            note: "Lên lịch từ trình biên tập bài viết",
                          });
                          setScheduleAt("");
                          await reloadServerVersion();
                          toast.success("Đã lên lịch.");
                        }}
                      >
                        <Clock3 />
                        Lên lịch
                      </Button>
                    )}
                  </>
                ) : null}
                <ConfirmDestructiveAction
                  confirmLabel="Xuất bản"
                  confirmVariant="default"
                  description="Bản nháp hiện tại sẽ trở thành nội dung công khai. Lịch sử phiên bản vẫn được giữ nguyên."
                  pending={publishPost.isPending}
                  title={`Xuất bản “${formSeed.title || "bài viết này"}”?`}
                  trigger={
                    <Button
                      disabled={
                        publishPost.isPending || saveState === "conflict"
                      }
                      type="button"
                    >
                      <Send />
                      Xuất bản
                    </Button>
                  }
                  onConfirm={async () => {
                    const saved = dirty
                      ? await saveNow(draftValues, {
                          allowSlugDecision: true,
                        })
                      : { version: workingVersion };
                    if (!saved) return;
                    await publishPost.mutateAsync({
                      postId,
                      expectedVersion: saved.version,
                      note: "Xuất bản từ trình biên tập bài viết",
                    });
                    await reloadServerVersion();
                    toast.success("Đã xuất bản.");
                  }}
                />
              </>
            ) : null}
          </div>
        ) : null
      }
    >
      {postQuery.isLoading ? (
        <AdminStatus
          description="Đang đồng bộ bản nháp và lịch sử phiên bản mới nhất."
          title="Đang tải bài viết"
          tone="loading"
        />
      ) : post && formSeed && workingVersion !== null ? (
        <div className="grid gap-5">
          {conflictMessage ? (
            <AdminStatus
              action={
                <Button variant="secondary" onClick={reloadServerVersion}>
                  Tải phiên bản từ máy chủ
                </Button>
              }
              description={conflictMessage}
              title="Xung đột phiên bản"
              tone="conflict"
            />
          ) : null}
          {slugDecisionRequired ? (
            <div className="mx-auto grid w-full max-w-4xl gap-2 border border-warning-foreground/20 bg-warning p-3 text-xs text-warning-foreground">
              <strong>Đường dẫn của bài đã xuất bản đang thay đổi.</strong>
              <label className="flex items-start gap-2">
                <input
                  checked={createRedirectOnSlugChange}
                  className="mt-0.5"
                  type="checkbox"
                  onChange={(event) =>
                    setCreateRedirectOnSlugChange(event.target.checked)
                  }
                />
                <span>
                  Tạo chuyển hướng 301 từ /bai-viet/{serverSlug} để giữ liên kết
                  cũ hoạt động. Sau đó bấm “Lưu thay đổi”.
                </span>
              </label>
            </div>
          ) : null}
          {validationError ? (
            <div className="mx-auto w-full max-w-4xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              <strong>Chưa thể tự động lưu:</strong> {validationError}
            </div>
          ) : null}
          {reviewOpen ? (
            <EditorialReviewPanel
              commentGranted={
                session?.capabilities.includes("content.write") ?? false
              }
              currentVersion={workingVersion}
              decisionGranted={
                session?.capabilities.includes("content.review.decide") ?? false
              }
              dirty={dirty}
              documentId={postId}
              documentType="post"
              onSaveDraft={() =>
                saveNow(draftValues, {
                  announce: false,
                  allowSlugDecision: true,
                })
              }
              publishGranted={canPublish}
              requestGranted={
                session?.capabilities.includes("content.review.request") ??
                false
              }
            />
          ) : null}
          <PostEditorWorkspace
            documentId={postId}
            formKey={`${postId}-${formEpoch}`}
            formProps={{
              canWrite,
              contentValue: draftValues?.content,
              contentVersion: workingVersion,
              initialValues: formSeed,
              isSubmitDisabled: saveState === "conflict",
              isSubmitting: saveState === "saving",
              onChange: handleFormChange,
              onSelectedBlockChange: setSelectedPostBlockIndex,
              selectedBlockIndex: selectedPostBlockIndex,
              submitLabel: "Lưu thay đổi",
              status: (
                <PostSaveStatus
                  lastSavedAt={lastSavedAt}
                  state={saveState}
                  version={workingVersion}
                />
              ),
              onSubmit: (values: CmsPostFormValues) =>
                void saveNow(values, {
                  announce: true,
                  allowSlugDecision: true,
                }),
            }}
            preview={
              <PostResponsivePreview
                canRedo={canRedoDraft}
                canUndo={canUndoDraft}
                onComposition={handlePostComposition}
                onRedo={() => navigateDraftHistory("redo")}
                onSelectedBlockChange={setSelectedPostBlockIndex}
                onUndo={() => navigateDraftHistory("undo")}
                onWorkspaceFocusChange={(focused) => {
                  setWorkspaceFocused(focused);
                  if (focused) setPreviewOpen(true);
                }}
                postId={postId}
                previewChannel={session!.previewChannel}
                values={draftValues ?? formSeed}
                version={workingVersion}
                workspaceFocusTriggerRef={workspaceFocusTriggerRef}
                workspaceFocused={workspaceFocused}
              />
            }
            previewOpen={previewOpen}
            workspaceFocused={workspaceFocused}
            workspaceRef={workspaceRef}
            onWorkspaceKeyDown={handleFocusedWorkspaceKeyDown}
          />
          {revisionsOpen ? (
            <PostRevisionHistory
              canRestore={canPublish}
              comparedRevisionId={comparedRevisionId}
              currentValues={draftValues ?? formSeed}
              restoreDisabled={dirty}
              restoring={restorePost.isPending}
              revisions={(revisionsQuery.data ?? []) as PostRevisionItem[]}
              onComparedRevisionChange={setComparedRevisionId}
              onRestore={async (revision) => {
                await restorePost.mutateAsync({
                  postId,
                  revisionId: revision.id,
                  expectedVersion: workingVersion,
                });
                await reloadServerVersion();
                setComparedRevisionId(null);
                toast.success("Đã khôi phục vào bản nháp.");
              }}
            />
          ) : null}
        </div>
      ) : (
        <AdminStatus
          action={
            <Link
              className={buttonVariants({ variant: "secondary" })}
              to="/admin/posts"
            >
              Quay lại danh sách
            </Link>
          }
          description="Bản ghi này không còn tồn tại."
          title="Không tìm thấy bài viết"
        />
      )}
    </AdminPage>
  );
}

function PostSaveStatus({
  state,
  lastSavedAt,
  version,
}: {
  state: SaveState;
  lastSavedAt: Date | null;
  version: number;
}) {
  const saved = lastSavedAt ? (
    <span className="flex items-center gap-2 text-xs text-success-foreground">
      <Check aria-hidden className="size-4" /> Đã lưu v{version} lúc{" "}
      {lastSavedAt.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}
    </span>
  ) : (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      <Check aria-hidden className="size-4" /> Bản làm việc v{version} · Đã đồng
      bộ với máy chủ
    </span>
  );
  return (
    <CmsDraftStatusSlots
      state={state}
      slots={{
        saving: (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 aria-hidden className="size-4" /> Đang tự động lưu…
          </span>
        ),
        conflict: (
          <span className="flex items-center gap-2 text-xs text-warning-foreground">
            <AlertTriangle aria-hidden className="size-4" /> Có xung đột phiên
            bản
          </span>
        ),
        dirty: (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 aria-hidden className="size-4" /> Có thay đổi chưa lưu · Tự
            động lưu sau 1,6 giây
          </span>
        ),
        saved,
        clean: saved,
      }}
    />
  );
}
