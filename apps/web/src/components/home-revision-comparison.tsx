import {
  compareCmsBlockRevisions,
  compareCmsRevisionFieldDetails,
  type CmsRevisionFieldDefinition,
} from "@agency/cms-admin";
import { remVietTemplateBlockLabels as homeBlockLabels } from "@agency/cms-template-rem-viet";
import {
  homeBlockSchema,
  pageRevisionSnapshotSchema,
  type HomeBlock,
  type PageBlock,
} from "@rem-viet/cms";

import RevisionFieldComparison from "@/components/revision-field-comparison";

export type HomeRevisionSnapshot = {
  title: string;
  slug: string;
  template: string;
  blocks: PageBlock[];
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  ogImage: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
};

export type HomeRevisionRow = {
  id: string;
  version: number;
  note: string;
  createdAt: string | Date;
  createdBy: string;
  snapshot: HomeRevisionSnapshot;
};

export type HomeRevisionMetadata = Omit<
  HomeRevisionSnapshot,
  "blocks" | "template"
>;

const homeRevisionMetadataFields = [
  {
    key: "title",
    label: "Tên trang",
    read: (value) => value.title,
    summarize: (value) => value.title,
  },
  {
    key: "slug",
    label: "Đường dẫn",
    read: (value) => value.slug,
    summarize: (value) => `/${value.slug}`,
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
    summarize: (value) => value.canonicalUrl,
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
] as const satisfies readonly CmsRevisionFieldDefinition<HomeRevisionMetadata>[];

function revisionBlockChangeLabel(
  status: "added" | "removed" | "modified" | "moved" | "modified-and-moved",
) {
  switch (status) {
    case "added":
      return "Đã thêm sau phiên bản này";
    case "removed":
      return "Đã xóa sau phiên bản này";
    case "modified":
      return "Đã sửa nội dung";
    case "moved":
      return "Đã đổi vị trí";
    case "modified-and-moved":
      return "Đã sửa nội dung và đổi vị trí";
  }
}

export type HomeRevisionComparisonProps = {
  currentBlocks: readonly HomeBlock[];
  currentMetadata: HomeRevisionMetadata;
  revision: HomeRevisionRow;
};

export default function HomeRevisionComparison({
  currentBlocks,
  currentMetadata,
  revision,
}: HomeRevisionComparisonProps) {
  const normalizedRevision = pageRevisionSnapshotSchema.safeParse(
    revision.snapshot,
  );
  if (!normalizedRevision.success) {
    return (
      <div
        className="rounded-md border border-destructive/30 bg-destructive/8 p-3 text-destructive"
        id={`revision-diff-v${revision.version}`}
        role="alert"
      >
        Không thể đọc snapshot của phiên bản này. Hệ thống đã chặn so sánh và
        không thay đổi bản nháp.
      </div>
    );
  }
  const revisionBlocks = homeBlockSchema
    .array()
    .safeParse(normalizedRevision.data.blocks);
  if (!revisionBlocks.success) {
    return (
      <div
        className="rounded-md border border-destructive/30 bg-destructive/8 p-3 text-destructive"
        id={`revision-diff-v${revision.version}`}
        role="alert"
      >
        Không thể đọc snapshot của phiên bản này. Hệ thống đã chặn so sánh và
        không thay đổi bản nháp.
      </div>
    );
  }

  const blockDiff = compareCmsBlockRevisions(
    revisionBlocks.data,
    currentBlocks,
  );
  const metadataDiff = compareCmsRevisionFieldDetails(
    normalizedRevision.data,
    currentMetadata,
    homeRevisionMetadataFields,
  );
  const hasChanges =
    blockDiff.summary.totalChanges > 0 || metadataDiff.length > 0;

  return (
    <section
      aria-label={`Thay đổi từ phiên bản v${revision.version} đến bản nháp hiện tại`}
      className="grid gap-3 rounded-lg border bg-muted/35 p-3"
      id={`revision-diff-v${revision.version}`}
    >
      <div>
        <strong className="text-xs">So với bản nháp hiện tại</strong>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          Bao gồm cả thay đổi trên canvas chưa được lưu.
        </p>
      </div>

      {hasChanges ? (
        <>
          <div
            aria-label="Tóm tắt thay đổi section"
            className="flex flex-wrap gap-1.5"
          >
            {blockDiff.summary.added ? (
              <span className="rounded-full bg-emerald-500/12 px-2 py-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                +{blockDiff.summary.added} thêm
              </span>
            ) : null}
            {blockDiff.summary.removed ? (
              <span className="rounded-full bg-red-500/12 px-2 py-1 text-[10px] font-medium text-red-700 dark:text-red-300">
                −{blockDiff.summary.removed} xóa
              </span>
            ) : null}
            {blockDiff.summary.modified ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-medium text-amber-800 dark:text-amber-200">
                {blockDiff.summary.modified} sửa
              </span>
            ) : null}
            {blockDiff.summary.moved ? (
              <span className="rounded-full bg-blue-500/12 px-2 py-1 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                {blockDiff.summary.moved} đổi vị trí
              </span>
            ) : null}
            {metadataDiff.length ? (
              <span className="rounded-full bg-violet-500/12 px-2 py-1 text-[10px] font-medium text-violet-700 dark:text-violet-300">
                {metadataDiff.length} metadata
              </span>
            ) : null}
          </div>

          {blockDiff.changes.length ? (
            <div className="grid gap-1.5">
              {blockDiff.changes.map((change) => (
                <div
                  className="flex items-start justify-between gap-3 rounded-md border bg-background px-2.5 py-2"
                  key={`${change.status}-${change.id}`}
                >
                  <span className="grid gap-0.5">
                    <strong className="text-[11px]">
                      {homeBlockLabels[change.type]}
                    </strong>
                    <span className="text-[10px] text-muted-foreground">
                      {revisionBlockChangeLabel(change.status)}
                    </span>
                  </span>
                  {change.beforeIndex !== null &&
                  change.afterIndex !== null &&
                  change.beforeIndex !== change.afterIndex ? (
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {change.beforeIndex + 1} → {change.afterIndex + 1}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {metadataDiff.length ? (
            <div className="border-t pt-2">
              <strong className="text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
                Metadata đã thay đổi
              </strong>
              <div className="mt-2">
                <RevisionFieldComparison changes={metadataDiff} />
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p className="rounded-md border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-2 text-[11px] text-emerald-800 dark:text-emerald-200">
          Bản nháp hiện tại trùng với phiên bản này.
        </p>
      )}
    </section>
  );
}
