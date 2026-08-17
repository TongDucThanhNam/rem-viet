import { Button } from "@rem-viet/ui/components/button";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@rem-viet/ui/components/sheet";
import { cn } from "@rem-viet/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Image,
  ImagePlus,
  Loader2,
  Search,
  UploadCloud,
  X,
} from "lucide-react";
import {
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
} from "react";
import { toast } from "sonner";

import { validateMediaFiles } from "@/lib/media";
import { uploadMediaFile } from "@/lib/media-upload-client";
import { useTRPC } from "@/utils/trpc";

export type MediaPickerAsset = {
  _id: string;
  altText?: string;
  key: string;
  mimeType: string;
  url: string;
};

type MediaPickerFieldProps = {
  helpText?: string;
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Owns library/upload selection atomically when the field stores metadata. */
  onAssetSelect?: (asset: MediaPickerAsset) => void;
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

export default function MediaPickerField({
  helpText,
  id,
  label,
  value,
  onChange,
  onAssetSelect,
}: MediaPickerFieldProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mediaQuery = useQuery(trpc.content.media.list.queryOptions());
  const mediaItems = useMemo(() => {
    const items = (mediaQuery.data ?? []) as MediaPickerAsset[];
    const normalizedQuery = normalizeSearch(query);
    if (!normalizedQuery) return items;
    return items.filter((item) =>
      normalizeSearch(`${item.key} ${item.altText ?? ""}`).includes(
        normalizedQuery,
      ),
    );
  }, [mediaQuery.data, query]);
  const selectedMedia = useMemo(
    () =>
      ((mediaQuery.data ?? []) as MediaPickerAsset[]).find(
        (item) => item.url === value,
      ),
    [mediaQuery.data, value],
  );

  function setOpen(open: boolean) {
    setIsOpen(open);
    setError(null);
    if (!open) {
      setDragActive(false);
      setQuery("");
    }
  }

  function commitAsset(asset: MediaPickerAsset) {
    if (onAssetSelect) onAssetSelect(asset);
    else onChange(asset.url);
  }

  async function uploadFile(file?: File | null) {
    if (!file) return;
    setError(null);
    setUploadProgress(0);

    try {
      await validateMediaFiles([file]);
      setIsUploading(true);
      const uploaded = await uploadMediaFile(file, setUploadProgress);
      commitAsset({
        _id: uploaded.key,
        altText: "",
        key: uploaded.key,
        mimeType: file.type,
        url: uploaded.url,
      });
      await queryClient.invalidateQueries(
        trpc.content.media.list.queryFilter(),
      );
      toast.success("Đã tải và chọn ảnh.");
      setOpen(false);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Không thể tải media.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  function handleDrop(event: ReactDragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragActive(false);
    void uploadFile(event.dataTransfer.files[0]);
  }

  function chooseMedia(item: MediaPickerAsset) {
    commitAsset(item);
    setOpen(false);
  }

  return (
    <div aria-labelledby={`${id}-label`} className="grid gap-2" role="group">
      <Label id={`${id}-label`}>{label}</Label>

      <div className="overflow-hidden border bg-muted/15">
        {value ? (
          <div className="grid gap-0 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <img
              alt={selectedMedia?.altText || "Ảnh đang chọn"}
              className="aspect-video size-full min-h-24 bg-muted object-cover"
              src={value}
            />
            <div className="flex min-w-0 flex-col justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="text-xs font-medium">Ảnh đang chọn</p>
                <p
                  className="mt-1 truncate font-mono text-[11px] text-muted-foreground"
                  title={selectedMedia?.key || value}
                >
                  {selectedMedia?.key || value}
                </p>
                {selectedMedia?.altText ? (
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                    {selectedMedia.altText}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => setOpen(true)}
                >
                  <ImagePlus aria-hidden />
                  Thay ảnh
                </Button>
                <Button
                  aria-label={`Xóa media khỏi ${label}`}
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => onChange("")}
                >
                  <X aria-hidden />
                  Xóa
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 p-3">
            <span className="grid size-12 shrink-0 place-items-center border bg-background text-muted-foreground">
              <Image aria-hidden className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium">Chưa chọn ảnh</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                Chọn từ thư viện hoặc tải ảnh mới ngay tại đây.
              </span>
            </span>
            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => setOpen(true)}
            >
              <ImagePlus aria-hidden />
              Chọn từ thư viện
            </Button>
          </div>
        )}
      </div>

      {helpText ? (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      ) : null}

      <details className="border bg-muted/10 px-3 py-2 text-xs">
        <summary className="cursor-pointer select-none text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Tùy chọn URL nâng cao
        </summary>
        <div className="mt-3 grid gap-1.5 border-t pt-3">
          <Label htmlFor={id}>Đường dẫn media</Label>
          <Input
            id={id}
            placeholder="/api/media/..."
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            Chỉ dùng khi media được quản lý ngoài thư viện hiện tại.
          </p>
        </div>
      </details>

      <Sheet open={isOpen} onOpenChange={setOpen}>
        <SheetContent className="w-[min(44rem,96vw)] bg-background text-foreground">
          <div className="border-b px-5 py-5 pr-12">
            <SheetTitle>Chọn media</SheetTitle>
            <SheetDescription className="mt-1.5">
              Tìm trong thư viện hoặc tải ảnh mới cho “{label}”.
            </SheetDescription>
          </div>

          <div className="grid gap-3 border-b p-4">
            <button
              aria-label={`Tải ảnh mới cho ${label}`}
              className={cn(
                "grid min-h-24 place-items-center border border-dashed px-4 py-3 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                dragActive
                  ? "border-primary bg-primary/8"
                  : "border-border bg-muted/20 hover:border-primary/55 hover:bg-muted/35",
              )}
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node))
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
              <span className="grid justify-items-center gap-1.5">
                {isUploading ? (
                  <Loader2 aria-hidden className="size-5 animate-spin" />
                ) : (
                  <UploadCloud aria-hidden className="size-5" />
                )}
                <span className="text-xs font-medium">
                  {isUploading
                    ? `Đang tải ${uploadProgress}%`
                    : dragActive
                      ? "Thả ảnh để tải lên"
                      : "Kéo thả hoặc nhấn để tải ảnh mới"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  AVIF, GIF, JPEG, PNG hoặc WEBP · tối đa 5 MB
                </span>
              </span>
            </button>
            <Label className="sr-only" htmlFor={`${id}-upload`}>
              Tải ảnh cho {label}
            </Label>
            <Input
              accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={isUploading}
              id={`${id}-upload`}
              ref={fileInputRef}
              tabIndex={-1}
              type="file"
              onChange={(event) => {
                void uploadFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            {isUploading ? (
              <progress
                aria-label={`Tiến độ tải ảnh cho ${label}`}
                className="h-1.5 w-full accent-primary"
                max={100}
                value={uploadProgress}
              />
            ) : null}
            {error ? (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="border-b p-4">
            <Label className="sr-only" htmlFor={`${id}-media-search`}>
              Tìm trong thư viện media
            </Label>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                autoFocus
                className="h-10 pl-9"
                id={`${id}-media-search`}
                placeholder="Tìm theo tên tệp hoặc mô tả…"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <p
              aria-live="polite"
              className="mt-2 text-[11px] text-muted-foreground"
            >
              {mediaQuery.isLoading
                ? "Đang tải thư viện…"
                : `${mediaItems.length} ảnh phù hợp`}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {mediaQuery.isLoading ? (
              <div
                aria-label="Đang tải thư viện media"
                className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                role="status"
              >
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    className="aspect-[4/3] animate-pulse border bg-muted"
                    key={index}
                  />
                ))}
              </div>
            ) : mediaQuery.isError ? (
              <div className="grid min-h-48 place-items-center border border-dashed p-6 text-center">
                <div>
                  <p className="text-sm font-medium">
                    Không thể tải thư viện media
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Thử tải lại mà không làm mất nội dung đang chỉnh sửa.
                  </p>
                  <Button
                    className="mt-4"
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => void mediaQuery.refetch()}
                  >
                    Thử lại
                  </Button>
                </div>
              </div>
            ) : mediaItems.length ? (
              <div
                aria-label="Kết quả thư viện media"
                className="grid grid-cols-2 gap-3 sm:grid-cols-3"
              >
                {mediaItems.map((item) => {
                  const selected = item.url === value;
                  const accessibleName = item.altText || item.key;
                  return (
                    <button
                      aria-label={`Chọn ${accessibleName}`}
                      aria-pressed={selected}
                      className={cn(
                        "group relative overflow-hidden border bg-background text-left outline-none transition hover:border-primary focus-visible:ring-2 focus-visible:ring-ring",
                        selected && "border-primary ring-1 ring-primary",
                      )}
                      key={item._id}
                      type="button"
                      onClick={() => chooseMedia(item)}
                    >
                      <img
                        alt={accessibleName}
                        className="aspect-[4/3] w-full object-cover"
                        loading="lazy"
                        src={item.url}
                      />
                      <span className="block p-2">
                        <span className="block truncate text-[11px] font-medium">
                          {item.altText || "Chưa có mô tả"}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                          {item.key}
                        </span>
                      </span>
                      {selected ? (
                        <span className="absolute right-2 top-2 grid size-6 place-items-center bg-primary text-primary-foreground">
                          <Check aria-hidden className="size-4" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid min-h-48 place-items-center border border-dashed p-6 text-center">
                <div>
                  <Image
                    aria-hidden
                    className="mx-auto size-7 text-muted-foreground"
                  />
                  <p className="mt-3 text-sm font-medium">
                    {query ? "Không có ảnh phù hợp" : "Thư viện chưa có ảnh"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {query
                      ? "Thử tên tệp hoặc mô tả khác."
                      : "Tải ảnh đầu tiên bằng khu vực phía trên."}
                  </p>
                  {query ? (
                    <Button
                      className="mt-4"
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => setQuery("")}
                    >
                      Xóa tìm kiếm
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
