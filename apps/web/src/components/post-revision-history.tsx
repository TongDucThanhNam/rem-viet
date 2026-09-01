import {
  compareCmsRevisionFieldDetails,
  type CmsRevisionFieldDefinition,
} from "@agency/cms-admin";
import { remVietRichTextBlockLabels } from "@agency/cms-template-rem-viet";
import {
  parseRichTextDocument,
  postRevisionSnapshotSchema,
  type PostRevisionSnapshot,
} from "@rem-viet/cms";
import { Button } from "@rem-viet/ui/components/button";
import { Card, CardContent } from "@rem-viet/ui/components/card";
import { GitCompareArrows, History, RotateCcw } from "lucide-react";

import { ConfirmDestructiveAction } from "@/components/admin-ui";
import type { CmsPostFormValues } from "@/components/cms-post-form";
import RevisionFieldComparison from "@/components/revision-field-comparison";

export type PostRevisionItem = {
  id: string;
  version: number;
  note: string;
  createdAt: string | Date;
  snapshot: PostRevisionSnapshot;
};

export type PostRevisionHistoryProps = {
  canRestore: boolean;
  comparedRevisionId: string | null;
  currentValues: CmsPostFormValues;
  restoreDisabled: boolean;
  restoring: boolean;
  revisions: readonly PostRevisionItem[];
  onComparedRevisionChange: (revisionId: string | null) => void;
  onRestore: (revision: PostRevisionItem) => Promise<void> | void;
};

function summarizePostContent(content: string) {
  const document = parseRichTextDocument(content);
  if (!document) {
    return content.trim()
      ? `Nội dung định dạng cũ · ${[...content].length.toLocaleString("vi-VN")} ký tự`
      : "Để trống";
  }
  const counts = new Map<string, number>();
  for (const block of document.blocks) {
    const label =
      remVietRichTextBlockLabels[block.type].toLocaleLowerCase("vi");
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return `${document.blocks.length} block · ${[...counts]
    .map(([label, count]) => `${count} ${label}`)
    .join(", ")}`;
}

const postRevisionFields = [
  {
    key: "title",
    label: "Tiêu đề",
    read: (value) => value.title,
    summarize: (value) => value.title,
  },
  {
    key: "slug",
    label: "Đường dẫn",
    read: (value) => value.slug,
    summarize: (value) => `/${value.slug ?? ""}`,
  },
  {
    key: "folder",
    label: "Thư mục workflow",
    read: (value) => value.folder,
    summarize: (value) => value.folder || "Thư mục gốc",
  },
  {
    key: "description",
    label: "Mô tả",
    read: (value) => value.description,
    summarize: (value) => value.description,
  },
  {
    key: "coverImage",
    label: "Ảnh bìa",
    read: (value) => value.coverImage,
    summarize: (value) => (value.coverImage ? "Có ảnh" : "Để trống"),
  },
  {
    key: "tags",
    label: "Thẻ",
    read: (value) => value.tags,
    summarize: (value) => value.tags.join(", "),
  },
  {
    key: "content",
    label: "Nội dung bài viết",
    read: (value) => value.content,
    summarize: (value) => summarizePostContent(value.content),
  },
  {
    key: "publishDate",
    label: "Ngày xuất bản",
    read: (value) => value.publishDate,
    summarize: (value) => value.publishDate,
  },
  {
    key: "seoTitle",
    label: "Tiêu đề SEO",
    read: (value) => value.seoTitle,
    summarize: (value) => value.seoTitle,
  },
  {
    key: "seoDescription",
    label: "Mô tả SEO",
    read: (value) => value.seoDescription,
    summarize: (value) => value.seoDescription,
  },
  {
    key: "canonicalUrl",
    label: "Canonical URL",
    read: (value) => value.canonicalUrl,
    summarize: (value) => value.canonicalUrl || "Để trống",
  },
  {
    key: "ogImage",
    label: "Ảnh chia sẻ",
    read: (value) => value.ogImage,
    summarize: (value) => (value.ogImage ? "Có ảnh" : "Để trống"),
  },
  {
    key: "robotsIndex",
    label: "Cho phép lập chỉ mục",
    read: (value) => value.robotsIndex,
    summarize: (value) => (value.robotsIndex ? "Bật" : "Tắt"),
  },
  {
    key: "robotsFollow",
    label: "Cho phép theo liên kết",
    read: (value) => value.robotsFollow,
    summarize: (value) => (value.robotsFollow ? "Bật" : "Tắt"),
  },
] as const satisfies readonly CmsRevisionFieldDefinition<CmsPostFormValues>[];

function formValuesFromRevision(
  snapshot: PostRevisionSnapshot,
): CmsPostFormValues {
  const normalized = postRevisionSnapshotSchema.parse(snapshot);
  return {
    title: normalized.title,
    slug: normalized.slug,
    folder: normalized.folder,
    description: normalized.description,
    coverImage: normalized.coverImage,
    tags: normalized.tags,
    content: normalized.content,
    publishDate: normalized.publishDate,
    seoTitle: normalized.seoTitle,
    seoDescription: normalized.seoDescription,
    canonicalUrl: normalized.canonicalUrl,
    ogImage: normalized.ogImage,
    robotsIndex: normalized.robotsIndex,
    robotsFollow: normalized.robotsFollow,
  };
}

export default function PostRevisionHistory({
  canRestore,
  comparedRevisionId,
  currentValues,
  restoreDisabled,
  restoring,
  revisions,
  onComparedRevisionChange,
  onRestore,
}: PostRevisionHistoryProps) {
  return (
    <Card
      className="mx-auto w-full max-w-4xl scroll-mt-20 rounded-md"
      id="post-revision-history"
    >
      <CardContent className="grid gap-3">
        <div className="flex items-center gap-2">
          <History className="size-4" />
          <h2 className="font-semibold">Phiên bản đã xuất bản</h2>
        </div>
        {revisions.map((revision) => {
          const fieldChanges = compareCmsRevisionFieldDetails(
            formValuesFromRevision(revision.snapshot),
            currentValues,
            postRevisionFields,
          );
          const comparisonOpen = comparedRevisionId === revision.id;
          return (
            <div
              className="grid gap-3 border-t pt-3 text-xs"
              data-testid={`post-revision-v${revision.version}`}
              key={revision.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <strong>v{revision.version}</strong>
                  <p className="text-muted-foreground">
                    {revision.note || "Không có ghi chú"} ·{" "}
                    {new Date(revision.createdAt).toLocaleString("vi-VN")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    aria-controls={`post-revision-diff-${revision.version}`}
                    aria-expanded={comparisonOpen}
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() =>
                      onComparedRevisionChange(
                        comparisonOpen ? null : revision.id,
                      )
                    }
                  >
                    <GitCompareArrows aria-hidden />
                    {comparisonOpen ? "Ẩn thay đổi" : "So sánh"}
                  </Button>
                  {canRestore ? (
                    <ConfirmDestructiveAction
                      confirmLabel="Khôi phục bản nháp"
                      confirmVariant="default"
                      description={`Nội dung phiên bản v${revision.version} sẽ thay thế bản nháp hiện tại. Nội dung công khai chưa thay đổi.`}
                      pending={restoring}
                      title={`Khôi phục phiên bản v${revision.version}?`}
                      trigger={
                        <Button
                          disabled={restoring || restoreDisabled}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          <RotateCcw />
                          Khôi phục bản nháp
                        </Button>
                      }
                      onConfirm={() => onRestore(revision)}
                    />
                  ) : null}
                </div>
              </div>
              {comparisonOpen ? (
                <section
                  aria-label={`Thay đổi của phiên bản v${revision.version}`}
                  className="rounded-md bg-muted/50 p-3"
                  id={`post-revision-diff-${revision.version}`}
                >
                  <strong>So với bản nháp đang chỉnh sửa</strong>
                  {fieldChanges.length ? (
                    <div className="mt-3">
                      <RevisionFieldComparison changes={fieldChanges} />
                    </div>
                  ) : (
                    <p className="mt-1 text-muted-foreground">
                      Bản nháp hiện tại trùng với phiên bản này.
                    </p>
                  )}
                </section>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
