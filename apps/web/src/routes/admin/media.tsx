import { Button } from "@rem-viet/ui/components/button";
import { Card, CardContent } from "@rem-viet/ui/components/card";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Image, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import { getAdminUser } from "@/functions/get-admin-user";
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
};

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
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [altDrafts, setAltDrafts] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
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
  const updateMedia = useMutation(
    trpc.content.media.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.content.media.list.queryFilter());
        toast.success("Đã lưu alt text.");
      },
    }),
  );
  const deleteMedia = useMutation(
    trpc.content.media.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.content.media.list.queryFilter());
        toast.success("Đã xóa media.");
      },
    }),
  );

  useEffect(() => {
    setAltDrafts(
      Object.fromEntries(
        mediaItems.map((item) => [item._id, item.altText ?? ""]),
      ),
    );
  }, [mediaItems]);

  async function uploadFiles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!selectedFiles.length) {
      setError("Chọn ít nhất một file.");
      return;
    }

    const formData = new FormData();
    for (const file of selectedFiles) {
      formData.append("files", file);
    }

    setIsUploading(true);
    try {
      const response = await fetch("/api/uploads/media", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message || "Không thể tải media.");
      }

      setSelectedFiles([]);
      queryClient.invalidateQueries(trpc.content.media.list.queryFilter());
      toast.success("Đã tải media.");
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
    <AdminShell hideHeading legacyContentFrame title="Media">
      <div className="mx-auto my-14 flex w-full max-w-[95rem] flex-col gap-4 lg:px-6">
        <div>
          <h1 className="text-2xl font-bold leading-8 tracking-normal">
            Media
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload ảnh lên R2, lưu metadata và quản lý alt text.
          </p>
        </div>

        <Card className="rounded-md border bg-background">
          <CardContent>
            <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={uploadFiles}>
              <div className="grid gap-2">
                <Label htmlFor="media-files">Upload media</Label>
                <Input
                  accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                  id="media-files"
                  multiple
                  type="file"
                  onChange={(event) =>
                    setSelectedFiles(
                      event.target.files ? Array.from(event.target.files) : [],
                    )
                  }
                />
                {selectedFiles.length ? (
                  <p className="text-xs text-muted-foreground">
                    {selectedFiles.length} file đã chọn.
                  </p>
                ) : null}
              </div>
              <Button
                className="self-end"
                disabled={isUploading}
                type="submit"
              >
                <UploadCloud aria-hidden />
                {isUploading ? "Đang tải..." : "Tải lên"}
              </Button>
            </form>
            {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
          </CardContent>
        </Card>

        <div className="overflow-hidden rounded-md border bg-background">
          {mediaQuery.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">
              Đang tải...
            </div>
          ) : sortedMedia.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="w-24 px-4 py-3 font-semibold">Preview</th>
                    <th className="px-4 py-3 font-semibold">Key / URL</th>
                    <th className="w-64 px-4 py-3 font-semibold">Alt text</th>
                    <th className="px-4 py-3 font-semibold">Size</th>
                    <th className="px-4 py-3 font-semibold">MIME</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMedia.map((item) => (
                    <tr className="border-b last:border-b-0" key={item._id}>
                      <td className="px-4 py-3">
                        <img
                          alt={item.altText || ""}
                          className="size-16 rounded-md object-cover"
                          src={item.url}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs">{item.key}</p>
                        <a
                          className="mt-1 block truncate text-xs text-muted-foreground underline-offset-4 hover:underline"
                          href={item.url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {item.url}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          value={altDrafts[item._id] ?? ""}
                          onChange={(event) =>
                            setAltDrafts((current) => ({
                              ...current,
                              [item._id]: event.target.value,
                            }))
                          }
                        />
                      </td>
                      <td className="px-4 py-3">{formatBytes(item.size)}</td>
                      <td className="px-4 py-3">{item.mimeType}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-3">
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
                            Lưu alt
                          </Button>
                          <Button
                            className="text-pink-600"
                            disabled={deleteMedia.isPending}
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              if (window.confirm(`Xóa ${item.key}?`)) {
                                deleteMedia.mutate({ mediaId: item._id });
                              }
                            }}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex min-h-60 flex-col items-center justify-center gap-3 p-6 text-center">
              <Image aria-hidden className="size-8 text-muted-foreground" />
              <div>
                <h2 className="text-sm font-medium">Chưa có media</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ảnh upload mới sẽ hiển thị ở đây.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
