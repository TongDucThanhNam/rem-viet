import { Button } from "@rem-viet/ui/components/button";
import { Card, CardContent } from "@rem-viet/ui/components/card";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { Skeleton } from "@rem-viet/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rem-viet/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  CheckCircle2,
  Copy,
  FileImage,
  Grid2X2,
  Images,
  List,
  RotateCcw,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type FormEvent,
} from "react";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import {
  AsyncState,
  ConfirmDestructiveAction,
  StatusBadge,
} from "@/components/admin-ui";
import { getAdminUser } from "@/functions/get-admin-user";
import {
  maxMediaBatchBytes,
  maxMediaBytes,
  maxMediaFiles,
  validateMediaFiles,
} from "@/lib/media";
import { uploadMediaFile } from "@/lib/media-upload-client";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/media")({
  component: AdminMediaRoute,
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

type MediaRow = {
  _id: string;
  key: string;
  url: string;
  altText: string;
  size: number;
  mimeType: string;
  createdAt: string;
  usageReferences: readonly { type: string; id: string }[];
};

type UploadState = "pending" | "uploading" | "done" | "error";

type UploadProgress = {
  percent: number;
  state: UploadState;
};

type DateRange = "all" | "today" | "7d" | "30d" | "older";

function mediaFileId(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function mergeMediaFiles(current: File[], incoming: File[]) {
  const files = new Map(current.map((file) => [mediaFileId(file), file]));
  for (const file of incoming) files.set(mediaFileId(file), file);
  return [...files.values()];
}

function matchesDateRange(createdAt: string, range: DateRange) {
  if (range === "all") return true;

  const createdTime = new Date(createdAt).getTime();
  if (!Number.isFinite(createdTime)) return false;

  const now = new Date();
  if (range === "today") {
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    return createdTime >= startOfToday;
  }

  const cutoff = now.getTime() - (range === "7d" ? 7 : 30) * 86_400_000;
  return range === "older" ? createdTime < cutoff : createdTime >= cutoff;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (!value) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const size = value / 1024 ** index;

  return `${size.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function AdminMediaRoute() {
  const { session } = Route.useRouteContext();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [dragActive, setDragActive] = useState(false);
  const [altDrafts, setAltDrafts] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<
    Record<string, UploadProgress>
  >({});
  const [search, setSearch] = useState("");
  const [mime, setMime] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const mediaQuery = useQuery(trpc.content.media.list.queryOptions());
  const mediaItems = (mediaQuery.data ?? []) as MediaRow[];
  const sortedMedia = useMemo(
    () =>
      [...mediaItems].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      ),
    [mediaItems],
  );
  const filteredMedia = useMemo(
    () =>
      sortedMedia.filter(
        (item) =>
          (mime === "all" || item.mimeType === mime) &&
          matchesDateRange(item.createdAt, dateRange) &&
          `${item.key} ${item.altText}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
      ),
    [dateRange, mime, search, sortedMedia],
  );
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(filteredMedia.length / pageSize));
  const allUploadsDone =
    selectedFiles.length > 0 &&
    selectedFiles.every(
      (file) => uploadProgress[mediaFileId(file)]?.state === "done",
    );
  const visibleMedia = filteredMedia.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const updateMedia = useMutation(
    trpc.content.media.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.content.media.list.queryFilter());
        toast.success("Đã lưu văn bản thay thế.");
      },
      onError: (mutationError) => toast.error(mutationError.message),
    }),
  );
  const deleteMedia = useMutation(
    trpc.content.media.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.content.media.list.queryFilter());
        toast.success("Đã xóa media.");
      },
      onError: (mutationError) => toast.error(mutationError.message),
    }),
  );

  useEffect(() => {
    setAltDrafts(
      Object.fromEntries(
        mediaItems.map((item) => [item._id, item.altText ?? ""]),
      ),
    );
  }, [mediaItems]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  useEffect(() => {
    const urls = Object.fromEntries(
      selectedFiles.map((file) => [
        mediaFileId(file),
        URL.createObjectURL(file),
      ]),
    );
    setPreviewUrls(urls);
    return () => Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
  }, [selectedFiles]);

  async function stageFiles(incoming: File[]) {
    setError(null);
    if (!incoming.length) return;

    const finished =
      selectedFiles.length > 0 &&
      selectedFiles.every(
        (file) => uploadProgress[mediaFileId(file)]?.state === "done",
      );
    const files = mergeMediaFiles(finished ? [] : selectedFiles, incoming);

    try {
      await validateMediaFiles(files);
    } catch (selectionError) {
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : "Không thể thêm các tệp đã chọn.",
      );
      return;
    }

    setSelectedFiles(files);
    setUploadProgress((current) =>
      Object.fromEntries(
        files.map((file) => {
          const fileId = mediaFileId(file);
          return [
            fileId,
            finished
              ? { percent: 0, state: "pending" as const }
              : (current[fileId] ?? {
                  percent: 0,
                  state: "pending" as const,
                }),
          ];
        }),
      ),
    );
  }

  function removeStagedFile(file: File) {
    const fileId = mediaFileId(file);
    if (uploadProgress[fileId]?.state === "uploading") return;
    setSelectedFiles((current) =>
      current.filter((candidate) => mediaFileId(candidate) !== fileId),
    );
    setUploadProgress((current) => {
      const next = { ...current };
      delete next[fileId];
      return next;
    });
    setError(null);
  }

  function clearUploadQueue() {
    if (isUploading) return;
    setSelectedFiles([]);
    setUploadProgress({});
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDrop(event: ReactDragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragActive(false);
    void stageFiles(Array.from(event.dataTransfer.files));
  }

  async function uploadOne(file: File) {
    const fileId = mediaFileId(file);
    setUploadProgress((current) => ({
      ...current,
      [fileId]: { percent: 0, state: "uploading" },
    }));

    try {
      await uploadMediaFile(file, (percent) => {
        setUploadProgress((current) => ({
          ...current,
          [fileId]: {
            percent,
            state: "uploading",
          },
        }));
      });
      setUploadProgress((current) => ({
        ...current,
        [fileId]: { percent: 100, state: "done" },
      }));
      return true;
    } catch (uploadError) {
      setUploadProgress((current) => ({
        ...current,
        [fileId]: {
          percent: current[fileId]?.percent ?? 0,
          state: "error",
        },
      }));
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Không thể tải media.",
      );
      return false;
    }
  }

  async function uploadFiles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!selectedFiles.length) {
      setError("Chọn ít nhất một file.");
      return;
    }

    setIsUploading(true);
    const filesToUpload = selectedFiles.filter(
      (file) => uploadProgress[mediaFileId(file)]?.state !== "done",
    );
    setUploadProgress((current) => ({
      ...current,
      ...Object.fromEntries(
        filesToUpload.map(
          (file) =>
            [mediaFileId(file), { percent: 0, state: "pending" }] as const,
        ),
      ),
    }));
    const results = [];
    for (const file of filesToUpload) results.push(await uploadOne(file));
    if (results.every(Boolean)) {
      toast.success("Đã tải media.");
    }
    queryClient.invalidateQueries(trpc.content.media.list.queryFilter());
    setIsUploading(false);
  }

  async function retryUpload(file: File) {
    setError(null);
    setIsUploading(true);
    const uploaded = await uploadOne(file);
    if (uploaded) {
      toast.success(`Đã tải lại ${file.name}.`);
      queryClient.invalidateQueries(trpc.content.media.list.queryFilter());
    }
    setIsUploading(false);
  }

  async function copyMediaUrl(item: MediaRow) {
    try {
      await navigator.clipboard.writeText(item.url);
      toast.success("Đã sao chép URL.");
    } catch {
      toast.error("Không thể sao chép URL. Hãy mở ảnh và sao chép thủ công.");
    }
  }

  function renderDeleteAction(item: MediaRow) {
    const referenced = item.usageReferences.length > 0;
    if (referenced && session?.staffRole !== "owner") {
      return (
        <Button
          aria-label={`Không thể xóa media ${item.key}`}
          disabled
          size="icon-sm"
          title={`Ảnh đang được dùng tại ${item.usageReferences.length} vị trí. Chỉ chủ sở hữu có thể xóa.`}
          type="button"
          variant="ghost"
        >
          <Trash2 aria-hidden />
        </Button>
      );
    }

    return (
      <ConfirmDestructiveAction
        description={
          referenced
            ? `Ảnh đang được dùng tại ${item.usageReferences.length} vị trí. Xóa ảnh có thể làm hỏng nội dung đang hiển thị và không thể hoàn tác.`
            : "Ảnh và thông tin mô tả sẽ bị xóa vĩnh viễn khỏi thư viện và không thể khôi phục."
        }
        pending={deleteMedia.isPending}
        title={`Xóa media ${item.key}?`}
        trigger={
          <Button
            aria-label={`Xóa media ${item.key}`}
            disabled={deleteMedia.isPending}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Trash2 aria-hidden />
          </Button>
        }
        onConfirm={() =>
          deleteMedia.mutate({ mediaId: item._id, force: referenced })
        }
      />
    );
  }

  return (
    <AdminShell>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 pb-16">
        <Card className="rounded-md border bg-background">
          <CardContent>
            <form className="grid gap-4" onSubmit={uploadFiles}>
              <div className="grid gap-0">
                {allUploadsDone ? (
                  <div className="flex flex-wrap items-center gap-3 border bg-emerald-50/60 px-4 py-3 text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-100">
                    <span className="grid size-9 place-items-center border border-emerald-600/25 bg-background">
                      <CheckCircle2
                        aria-hidden
                        className="size-4 text-emerald-600"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium">
                        Đã tải xong {selectedFiles.length} ảnh
                      </span>
                      <span className="mt-0.5 block text-[11px] opacity-75">
                        Media mới đã sẵn sàng trong thư viện bên dưới.
                      </span>
                    </span>
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Images aria-hidden />
                      Tải thêm ảnh
                    </Button>
                  </div>
                ) : (
                  <button
                    aria-label="Thêm ảnh vào hàng đợi tải lên"
                    className={`group grid min-h-44 cursor-pointer place-items-center border border-dashed px-6 py-8 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      dragActive
                        ? "border-primary bg-primary/8"
                        : "border-border bg-muted/20 hover:border-primary/55 hover:bg-muted/35"
                    }`}
                    data-testid="media-upload-dropzone"
                    onClick={() => fileInputRef.current?.click()}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={(event) => {
                      if (
                        !event.currentTarget.contains(
                          event.relatedTarget as Node,
                        )
                      )
                        setDragActive(false);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "copy";
                      setDragActive(true);
                    }}
                    onDrop={handleDrop}
                    type="button"
                  >
                    <div className="grid max-w-xl justify-items-center gap-3">
                      <span className="grid size-12 place-items-center border bg-background text-primary shadow-sm transition-transform group-hover:-translate-y-0.5">
                        <Images aria-hidden className="size-5" />
                      </span>
                      <div>
                        <p className="text-sm font-medium">
                          {dragActive
                            ? "Thả ảnh để thêm vào hàng đợi"
                            : "Kéo thả ảnh vào đây"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          hoặc nhấn để chọn từ thiết bị
                        </p>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        AVIF, GIF, JPEG, PNG, WEBP · tối đa {maxMediaFiles} ảnh
                        · {formatBytes(maxMediaBytes)}/ảnh ·{" "}
                        {formatBytes(maxMediaBatchBytes)}/lượt
                      </p>
                    </div>
                  </button>
                )}
                <Label className="sr-only" htmlFor="media-files">
                  Tải ảnh lên thư viện
                </Label>
                <Input
                  accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                  className="sr-only"
                  id="media-files"
                  multiple
                  ref={fileInputRef}
                  tabIndex={-1}
                  type="file"
                  onChange={(event) => {
                    const files = event.target.files
                      ? Array.from(event.target.files)
                      : [];
                    void stageFiles(files);
                    event.target.value = "";
                  }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p aria-live="polite" className="text-xs text-muted-foreground">
                  {selectedFiles.length
                    ? `${selectedFiles.length} ảnh · ${formatBytes(
                        selectedFiles.reduce(
                          (total, file) => total + file.size,
                          0,
                        ),
                      )}`
                    : "Chưa có ảnh trong hàng đợi"}
                </p>
                {selectedFiles.length ? (
                  <Button
                    disabled={isUploading}
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={clearUploadQueue}
                  >
                    <X aria-hidden />
                    Xóa hàng đợi
                  </Button>
                ) : null}
              </div>

              <div className="grid gap-2">
                {selectedFiles.length ? (
                  <div aria-label="Hàng đợi tải media" className="grid gap-2">
                    {selectedFiles.map((file) => {
                      const fileId = mediaFileId(file);
                      const progress = uploadProgress[mediaFileId(file)] ?? {
                        percent: 0,
                        state: "pending" as const,
                      };
                      const status =
                        progress.state === "pending"
                          ? "Chờ tải"
                          : progress.state === "uploading"
                            ? `${progress.percent}%`
                            : progress.state === "done"
                              ? "Hoàn tất"
                              : "Lỗi";
                      return (
                        <div
                          className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 border bg-muted/15 p-2.5"
                          data-upload-file={file.name}
                          key={fileId}
                        >
                          <span className="grid size-14 place-items-center overflow-hidden border bg-muted">
                            {previewUrls[fileId] ? (
                              <img
                                alt=""
                                className="size-full object-cover"
                                src={previewUrls[fileId]}
                              />
                            ) : (
                              <FileImage
                                aria-hidden
                                className="size-5 text-muted-foreground"
                              />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium text-foreground">
                              {file.name}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                              {file.type} · {formatBytes(file.size)}
                            </span>
                            <span className="mt-2 flex items-center gap-2">
                              <progress
                                aria-label={`Tiến độ tải ${file.name}`}
                                className="h-1.5 min-w-24 flex-1 accent-primary"
                                max={100}
                                value={progress.percent}
                              />
                              <span className="w-14 text-right text-[11px] tabular-nums text-muted-foreground">
                                {status}
                              </span>
                            </span>
                          </span>
                          <span className="flex items-center justify-end gap-1">
                            {progress.state === "done" ? (
                              <CheckCircle2
                                aria-label="Tải lên hoàn tất"
                                className="size-4 text-emerald-600"
                              />
                            ) : null}
                            {progress.state === "error" ? (
                              <Button
                                aria-label="Thử lại"
                                size="icon-sm"
                                title={`Thử tải lại ${file.name}`}
                                type="button"
                                variant="ghost"
                                onClick={() => void retryUpload(file)}
                              >
                                <RotateCcw aria-hidden />
                              </Button>
                            ) : null}
                            {progress.state !== "uploading" ? (
                              <Button
                                aria-label={`Bỏ ${file.name} khỏi hàng đợi`}
                                size="icon-sm"
                                type="button"
                                variant="ghost"
                                onClick={() => removeStagedFile(file)}
                              >
                                <X aria-hidden />
                              </Button>
                            ) : null}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="text-[11px] text-muted-foreground">
                  Ảnh được kiểm tra định dạng và dung lượng trước khi gửi.
                </p>
                <Button
                  disabled={
                    isUploading ||
                    !selectedFiles.length ||
                    selectedFiles.every(
                      (file) =>
                        uploadProgress[mediaFileId(file)]?.state === "done",
                    )
                  }
                  type="submit"
                >
                  <UploadCloud aria-hidden />
                  {isUploading
                    ? "Đang tải…"
                    : selectedFiles.length &&
                        selectedFiles.every(
                          (file) =>
                            uploadProgress[mediaFileId(file)]?.state === "done",
                        )
                      ? "Đã hoàn tất"
                      : `Tải lên${selectedFiles.length ? ` ${selectedFiles.length} ảnh` : ""}`}
                </Button>
              </div>
            </form>
            {error ? (
              <p className="mt-3 text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_14rem_12rem_auto]">
          <Input
            aria-label="Tìm trong thư viện media"
            placeholder="Tìm theo tên tệp hoặc văn bản thay thế…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <select
            aria-label="Lọc MIME"
            className="h-8 rounded-md border bg-background px-3 text-xs"
            value={mime}
            onChange={(event) => {
              setMime(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Tất cả định dạng</option>
            {[...new Set(mediaItems.map((item) => item.mimeType))].map(
              (value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ),
            )}
          </select>
          <select
            aria-label="Lọc ngày tải"
            className="h-8 rounded-md border bg-background px-3 text-xs"
            value={dateRange}
            onChange={(event) => {
              setDateRange(event.target.value as DateRange);
              setPage(1);
            }}
          >
            <option value="all">Mọi thời gian</option>
            <option value="today">Hôm nay</option>
            <option value="7d">7 ngày gần đây</option>
            <option value="30d">30 ngày gần đây</option>
            <option value="older">Cũ hơn 30 ngày</option>
          </select>
          <div
            aria-label="Kiểu hiển thị media"
            className="flex justify-end gap-1"
            role="group"
          >
            <Button
              aria-label="Hiển thị dạng lưới"
              aria-pressed={view === "grid"}
              size="icon-sm"
              type="button"
              variant={view === "grid" ? "secondary" : "outline"}
              onClick={() => setView("grid")}
            >
              <Grid2X2 aria-hidden />
            </Button>
            <Button
              aria-label="Hiển thị dạng danh sách"
              aria-pressed={view === "list"}
              size="icon-sm"
              type="button"
              variant={view === "list" ? "secondary" : "outline"}
              onClick={() => setView("list")}
            >
              <List aria-hidden />
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border bg-background">
          {mediaQuery.isLoading ? (
            <div
              aria-label="Đang tải thư viện media"
              className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3"
              role="status"
            >
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton className="h-64" key={index} />
              ))}
            </div>
          ) : mediaQuery.isError ? (
            <AsyncState
              action={
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => void mediaQuery.refetch()}
                >
                  Thử lại
                </Button>
              }
              description="Không thể tải ảnh và thông tin mô tả trong thư viện hiện tại."
              title="Không thể tải thư viện media"
              tone="error"
            />
          ) : visibleMedia.length ? (
            view === "grid" ? (
              <div
                aria-label="Media dạng lưới"
                className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
              >
                {visibleMedia.map((item) => (
                  <article
                    className="flex min-w-0 flex-col overflow-hidden rounded-md border bg-card"
                    data-media-item
                    key={item._id}
                  >
                    <a href={item.url} rel="noreferrer" target="_blank">
                      <img
                        alt={item.altText || ""}
                        className="aspect-video w-full bg-muted object-cover"
                        src={item.url}
                      />
                    </a>
                    <div className="grid flex-1 gap-3 p-3">
                      <div className="min-w-0">
                        <p
                          className="truncate font-mono text-xs"
                          title={item.key}
                        >
                          {item.key}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {item.mimeType} · {formatBytes(item.size)} ·{" "}
                          {formatDate(item.createdAt)}
                        </p>
                      </div>
                      <Input
                        aria-label={`Văn bản thay thế cho ${item.key}`}
                        value={altDrafts[item._id] ?? ""}
                        onChange={(event) =>
                          setAltDrafts((current) => ({
                            ...current,
                            [item._id]: event.target.value,
                          }))
                        }
                      />
                      {item.usageReferences.length ? (
                        <StatusBadge status="warning">
                          Đang dùng tại {item.usageReferences.length} vị trí
                        </StatusBadge>
                      ) : null}
                      <div className="mt-auto flex flex-wrap justify-end gap-2">
                        <Button
                          aria-label={`Sao chép URL ${item.key}`}
                          size="icon-sm"
                          type="button"
                          variant="outline"
                          onClick={() => void copyMediaUrl(item)}
                        >
                          <Copy aria-hidden />
                        </Button>
                        <Button
                          disabled={updateMedia.isPending}
                          size="sm"
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            updateMedia.mutate({
                              mediaId: item._id,
                              altText: altDrafts[item._id] ?? "",
                            })
                          }
                        >
                          Lưu mô tả
                        </Button>
                        {renderDeleteAction(item)}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[1040px]">
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="w-24">Xem trước</TableHead>
                      <TableHead>Tên tệp / URL</TableHead>
                      <TableHead className="w-64">Văn bản thay thế</TableHead>
                      <TableHead>Ngày tải</TableHead>
                      <TableHead>Dung lượng</TableHead>
                      <TableHead>MIME</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleMedia.map((item) => (
                      <TableRow data-media-item key={item._id}>
                        <TableCell>
                          <img
                            alt={item.altText || ""}
                            className="size-16 rounded-md object-cover"
                            src={item.url}
                          />
                        </TableCell>
                        <TableCell>
                          <p className="font-mono text-xs">{item.key}</p>
                          <a
                            className="mt-1 block truncate text-xs text-muted-foreground underline-offset-4 hover:underline"
                            href={item.url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {item.url}
                          </a>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Input
                              aria-label={`Văn bản thay thế cho ${item.key}`}
                              value={altDrafts[item._id] ?? ""}
                              onChange={(event) =>
                                setAltDrafts((current) => ({
                                  ...current,
                                  [item._id]: event.target.value,
                                }))
                              }
                            />
                            <Button
                              aria-label="Lưu mô tả"
                              disabled={updateMedia.isPending}
                              size="sm"
                              type="button"
                              variant="secondary"
                              onClick={() =>
                                updateMedia.mutate({
                                  mediaId: item._id,
                                  altText: altDrafts[item._id] ?? "",
                                })
                              }
                            >
                              Lưu
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDate(item.createdAt)}
                        </TableCell>
                        <TableCell>{formatBytes(item.size)}</TableCell>
                        <TableCell>{item.mimeType}</TableCell>
                        <TableCell className="align-top">
                          <div className="flex items-start justify-end gap-2">
                            <Button
                              aria-label={`Sao chép URL ${item.key}`}
                              size="icon-sm"
                              type="button"
                              variant="outline"
                              onClick={() => void copyMediaUrl(item)}
                            >
                              <Copy aria-hidden />
                            </Button>
                            {renderDeleteAction(item)}
                          </div>
                          {item.usageReferences.length ? (
                            <div className="mt-2 flex justify-end">
                              <StatusBadge status="warning">
                                Đang dùng tại {item.usageReferences.length} vị
                                trí
                              </StatusBadge>
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            <AsyncState
              description={
                search || mime !== "all" || dateRange !== "all"
                  ? "Không có ảnh nào khớp bộ lọc hiện tại. Hãy đổi hoặc xóa bộ lọc để xem thêm."
                  : "Ảnh mới tải lên sẽ xuất hiện tại đây."
              }
              title={
                search || mime !== "all" || dateRange !== "all"
                  ? "Không có kết quả phù hợp"
                  : "Chưa có media"
              }
            />
          )}
        </div>
        {filteredMedia.length ? (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {filteredMedia.length} tệp · trang {page}/{totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Trang trước
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Trang sau
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
