import { Button } from "@rem-viet/ui/components/button";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Image, UploadCloud, X } from "lucide-react";
import { useMemo, useState } from "react";

import { useTRPC } from "@/utils/trpc";

type MediaRow = {
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
};

export default function MediaPickerField({
  helpText,
  id,
  label,
  value,
  onChange,
}: MediaPickerFieldProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const mediaQuery = useQuery(trpc.content.media.list.queryOptions());
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaItems = useMemo(
    () => ((mediaQuery.data ?? []) as MediaRow[]).slice(0, 24),
    [mediaQuery.data],
  );

  async function uploadFile(file?: File | null) {
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("files", file);
    setError(null);
    setIsUploading(true);

    try {
      const response = await fetch("/api/uploads/media", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as {
        data?: Array<{ url?: string }>;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(result.message || "Không thể tải media.");
      }

      const uploadedUrl = result.data?.[0]?.url ?? "";

      if (uploadedUrl) {
        onChange(uploadedUrl);
      }

      queryClient.invalidateQueries(trpc.content.media.list.queryFilter());
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

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          placeholder="/api/media/..."
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {value ? (
          <Button
            aria-label="Xóa media"
            size="icon"
            type="button"
            variant="ghost"
            onClick={() => onChange("")}
          >
            <X aria-hidden />
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
          className="max-w-sm"
          disabled={isUploading}
          type="file"
          onChange={(event) => {
            uploadFile(event.target.files?.[0]).finally(() => {
              event.target.value = "";
            });
          }}
        />
        <Button
          disabled={mediaQuery.isLoading}
          type="button"
          variant="secondary"
          onClick={() => setIsOpen((current) => !current)}
        >
          <Image aria-hidden />
          {isOpen ? "Ẩn thư viện" : "Chọn từ thư viện"}
        </Button>
        {isUploading ? (
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <UploadCloud aria-hidden className="size-4" />
            Đang tải...
          </span>
        ) : null}
      </div>

      {helpText ? <p className="text-xs text-muted-foreground">{helpText}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {value ? (
        <img
          alt=""
          className="h-40 w-full max-w-md rounded-md object-cover"
          src={value}
        />
      ) : null}

      {isOpen ? (
        <div className="grid max-h-96 gap-3 overflow-y-auto rounded-md border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {mediaItems.length ? (
            mediaItems.map((item) => {
              const selected = item.url === value;

              return (
                <button
                  className={`group relative overflow-hidden rounded-md border bg-background text-left transition hover:border-primary ${
                    selected ? "border-primary ring-1 ring-primary" : ""
                  }`}
                  key={item._id}
                  type="button"
                  onClick={() => {
                    onChange(item.url);
                    setIsOpen(false);
                  }}
                >
                  <img
                    alt={item.altText || item.key}
                    className="h-28 w-full object-cover"
                    loading="lazy"
                    src={item.url}
                  />
                  <span className="block truncate px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
                    {item.key}
                  </span>
                  {selected ? (
                    <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check aria-hidden className="size-4" />
                    </span>
                  ) : null}
                </button>
              );
            })
          ) : (
            <div className="col-span-full flex min-h-32 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <Image aria-hidden className="size-7" />
              Chưa có media trong thư viện.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
