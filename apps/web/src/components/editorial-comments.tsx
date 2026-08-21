import { Button } from "@rem-viet/ui/components/button";
import { Checkbox } from "@rem-viet/ui/components/checkbox";
import { Textarea } from "@rem-viet/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AtSign,
  CheckCircle2,
  CornerDownRight,
  MessageSquarePlus,
  RotateCcw,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

type EditorialParticipant = {
  id: string;
  name: string;
  role: "owner" | "admin" | "editor";
};

type EditorialCommentsProps = {
  commentGranted: boolean;
  decisionGranted: boolean;
  documentId: string;
  documentType: "page" | "post";
  participants: EditorialParticipant[];
};

function formatCommentDate(value: string | Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("vi-VN");
}

function toggleValue(values: string[], value: string, checked: boolean) {
  return checked
    ? [...new Set([...values, value])]
    : values.filter((candidate) => candidate !== value);
}

export default function EditorialComments({
  commentGranted,
  decisionGranted,
  documentId,
  documentType,
  participants,
}: EditorialCommentsProps) {
  const trpc = useTRPC();
  const target = useMemo(
    () => ({ documentId, documentType }),
    [documentId, documentType],
  );
  const commentsQuery = useQuery(
    trpc.content.comments.list.queryOptions(target),
  );
  const createComment = useMutation(
    trpc.content.comments.create.mutationOptions(),
  );
  const replyComment = useMutation(
    trpc.content.comments.reply.mutationOptions(),
  );
  const setResolved = useMutation(
    trpc.content.comments.setResolved.mutationOptions(),
  );
  const [body, setBody] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [replyBodies, setReplyBodies] = useState<Record<string, string>>({});
  const [replyMentionIds, setReplyMentionIds] = useState<
    Record<string, string[]>
  >({});
  const operationIds = useRef(new Map<string, string>());
  const threads = commentsQuery.data ?? [];
  const participantById = useMemo(
    () =>
      new Map(participants.map((participant) => [participant.id, participant])),
    [participants],
  );
  const pending =
    createComment.isPending || replyComment.isPending || setResolved.isPending;

  const operationIdFor = (key: string) => {
    const current = operationIds.current.get(key);
    if (current) return current;
    const created = crypto.randomUUID();
    operationIds.current.set(key, created);
    return created;
  };

  const clearOperation = (key: string) => operationIds.current.delete(key);

  const handleCreate = async () => {
    if (!body.trim()) {
      toast.error("Hãy nhập nội dung bình luận.");
      return;
    }
    const operationKey = "create";
    try {
      await createComment.mutateAsync({
        ...target,
        body,
        mentionIds,
        operationId: operationIdFor(operationKey),
      });
      clearOperation(operationKey);
      setBody("");
      setMentionIds([]);
      await commentsQuery.refetch();
      toast.success("Đã tạo luồng bình luận.");
    } catch (error) {
      await commentsQuery.refetch();
      toast.error(
        error instanceof Error ? error.message : "Không thể tạo bình luận.",
      );
    }
  };

  const handleReply = async (thread: (typeof threads)[number]) => {
    const replyBody = replyBodies[thread.id] ?? "";
    if (!replyBody.trim()) {
      toast.error("Hãy nhập nội dung phản hồi.");
      return;
    }
    const operationKey = `reply:${thread.id}`;
    try {
      await replyComment.mutateAsync({
        threadId: thread.id,
        expectedVersion: thread.version,
        body: replyBody,
        mentionIds: replyMentionIds[thread.id] ?? [],
        operationId: operationIdFor(operationKey),
      });
      clearOperation(operationKey);
      setReplyBodies((current) => ({ ...current, [thread.id]: "" }));
      setReplyMentionIds((current) => ({ ...current, [thread.id]: [] }));
      await commentsQuery.refetch();
      toast.success("Đã gửi phản hồi.");
    } catch (error) {
      await commentsQuery.refetch();
      toast.error(
        error instanceof Error ? error.message : "Không thể gửi phản hồi.",
      );
    }
  };

  const handleResolved = async (
    thread: (typeof threads)[number],
    resolved: boolean,
  ) => {
    const operationKey = `resolved:${thread.id}:${String(resolved)}`;
    try {
      await setResolved.mutateAsync({
        threadId: thread.id,
        expectedVersion: thread.version,
        resolved,
        operationId: operationIdFor(operationKey),
      });
      clearOperation(operationKey);
      await commentsQuery.refetch();
      toast.success(resolved ? "Đã xử lý bình luận." : "Đã mở lại bình luận.");
    } catch (error) {
      await commentsQuery.refetch();
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật bình luận.",
      );
    }
  };

  return (
    <section
      aria-labelledby={`${documentType}-editorial-comments-title`}
      className="grid gap-4 border-t pt-4"
      data-testid="editorial-comments"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3
            className="text-sm font-semibold"
            id={`${documentType}-editorial-comments-title`}
          >
            Thảo luận biên tập
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Bình luận theo luồng, nhắc đúng người và đánh dấu khi đã xử lý.
          </p>
        </div>
        <span
          aria-live="polite"
          className="rounded-full border px-2 py-1 text-[11px] text-muted-foreground"
        >
          {threads.filter((thread) => thread.status === "open").length} đang mở
        </span>
      </div>

      {commentGranted ? (
        <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
          <label
            className="text-xs font-medium"
            htmlFor={`${documentType}-new-editorial-comment`}
          >
            Bình luận mới
          </label>
          <Textarea
            id={`${documentType}-new-editorial-comment`}
            maxLength={5_000}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Nêu rõ điểm cần thảo luận hoặc kiểm tra…"
            rows={3}
            value={body}
          />
          {participants.length ? (
            <details className="rounded-md border bg-background px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium">
                <AtSign aria-hidden className="mr-1.5 inline size-3.5" />
                Nhắc người tham gia
              </summary>
              <fieldset className="mt-3 grid gap-2 sm:grid-cols-2">
                <legend className="sr-only">
                  Người được nhắc trong bình luận mới
                </legend>
                {participants.map((participant) => (
                  <label
                    className="flex items-center gap-2 text-xs"
                    key={participant.id}
                  >
                    <Checkbox
                      checked={mentionIds.includes(participant.id)}
                      onCheckedChange={(value) =>
                        setMentionIds((current) =>
                          toggleValue(current, participant.id, value === true),
                        )
                      }
                    />
                    {participant.name}
                  </label>
                ))}
              </fieldset>
            </details>
          ) : null}
          <div className="flex justify-end">
            <Button
              disabled={pending || !body.trim()}
              onClick={() => void handleCreate()}
              size="sm"
              type="button"
            >
              <MessageSquarePlus aria-hidden />
              Tạo luồng bình luận
            </Button>
          </div>
        </div>
      ) : null}

      {commentsQuery.isLoading ? (
        <p className="text-xs text-muted-foreground" role="status">
          Đang tải thảo luận…
        </p>
      ) : commentsQuery.isError ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 p-3">
          <p className="text-xs text-destructive">
            {commentsQuery.error.message || "Không thể tải thảo luận."}
          </p>
          <Button
            onClick={() => void commentsQuery.refetch()}
            size="sm"
            type="button"
            variant="outline"
          >
            Thử lại
          </Button>
        </div>
      ) : threads.length ? (
        <ol className="grid gap-3">
          {threads.map((thread) => {
            const open = thread.status === "open";
            const author =
              participantById.get(thread.authorId)?.name ?? thread.authorId;
            return (
              <li key={thread.id}>
                <article className="grid gap-3 rounded-md border p-3">
                  <header className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium">{author}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatCommentDate(thread.createdAt)} · v
                        {thread.version}
                      </p>
                    </div>
                    <span
                      className={
                        open
                          ? "rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-700 dark:text-amber-300"
                          : "rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300"
                      }
                    >
                      {open ? "Đang mở" : "Đã xử lý"}
                    </span>
                  </header>
                  {(thread.target.fieldPath || thread.target.blockId) && (
                    <p className="rounded bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">
                      {thread.target.fieldPath}
                      {thread.target.blockId
                        ? ` · ${thread.target.blockId}`
                        : ""}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap text-xs leading-5">
                    {thread.body}
                  </p>
                  {thread.mentions.length ? (
                    <p className="text-[11px] text-muted-foreground">
                      <AtSign aria-hidden className="mr-1 inline size-3" />
                      {thread.mentions
                        .map((id) => participantById.get(id)?.name ?? id)
                        .join(", ")}
                    </p>
                  ) : null}

                  {thread.replies.length ? (
                    <ol
                      aria-label={`Phản hồi cho bình luận của ${author}`}
                      className="grid gap-2 border-l pl-3"
                    >
                      {thread.replies.map((reply) => (
                        <li className="grid gap-1" key={reply.id}>
                          <p className="text-[11px] text-muted-foreground">
                            <CornerDownRight
                              aria-hidden
                              className="mr-1 inline size-3"
                            />
                            {participantById.get(reply.authorId)?.name ??
                              reply.authorId}{" "}
                            · {formatCommentDate(reply.createdAt)}
                          </p>
                          <p className="whitespace-pre-wrap text-xs leading-5">
                            {reply.body}
                          </p>
                          {reply.mentions.length ? (
                            <p className="text-[11px] text-muted-foreground">
                              <AtSign
                                aria-hidden
                                className="mr-1 inline size-3"
                              />
                              {reply.mentions
                                .map(
                                  (id) => participantById.get(id)?.name ?? id,
                                )
                                .join(", ")}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  ) : null}

                  {open && commentGranted ? (
                    <div className="grid gap-2 border-t pt-3">
                      <label
                        className="text-xs font-medium"
                        htmlFor={`${documentType}-comment-reply-${thread.id}`}
                      >
                        Phản hồi
                      </label>
                      <Textarea
                        id={`${documentType}-comment-reply-${thread.id}`}
                        maxLength={5_000}
                        onChange={(event) =>
                          setReplyBodies((current) => ({
                            ...current,
                            [thread.id]: event.target.value,
                          }))
                        }
                        placeholder="Viết phản hồi…"
                        rows={2}
                        value={replyBodies[thread.id] ?? ""}
                      />
                      {participants.length ? (
                        <details className="rounded-md border px-3 py-2">
                          <summary className="cursor-pointer text-[11px] font-medium">
                            <AtSign
                              aria-hidden
                              className="mr-1 inline size-3"
                            />
                            Nhắc người trong phản hồi
                          </summary>
                          <fieldset className="mt-3 grid gap-2 sm:grid-cols-2">
                            <legend className="sr-only">
                              Người được nhắc trong phản hồi cho {author}
                            </legend>
                            {participants.map((participant) => (
                              <label
                                className="flex items-center gap-2 text-xs"
                                key={participant.id}
                              >
                                <Checkbox
                                  checked={(
                                    replyMentionIds[thread.id] ?? []
                                  ).includes(participant.id)}
                                  onCheckedChange={(value) =>
                                    setReplyMentionIds((current) => ({
                                      ...current,
                                      [thread.id]: toggleValue(
                                        current[thread.id] ?? [],
                                        participant.id,
                                        value === true,
                                      ),
                                    }))
                                  }
                                />
                                {participant.name}
                              </label>
                            ))}
                          </fieldset>
                        </details>
                      ) : null}
                      <div className="flex justify-end">
                        <Button
                          disabled={
                            pending || !(replyBodies[thread.id] ?? "").trim()
                          }
                          onClick={() => void handleReply(thread)}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          <CornerDownRight aria-hidden />
                          Gửi phản hồi
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {decisionGranted ? (
                    <div className="flex justify-end border-t pt-3">
                      <Button
                        disabled={pending}
                        onClick={() => void handleResolved(thread, open)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {open ? (
                          <CheckCircle2 aria-hidden />
                        ) : (
                          <RotateCcw aria-hidden />
                        )}
                        {open ? "Đánh dấu đã xử lý" : "Mở lại bình luận"}
                      </Button>
                    </div>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          Chưa có bình luận cho tài liệu này.
        </p>
      )}
    </section>
  );
}
