import type { CmsRevisionFieldDetail } from "@agency/cms-admin";
import { ArrowRight } from "lucide-react";

function visibleSummary(value: string | null) {
  return value === "" ? "Để trống" : value;
}

export default function RevisionFieldComparison({
  afterLabel = "Bản nháp",
  beforeLabel = "Phiên bản",
  changes,
}: {
  afterLabel?: string;
  beforeLabel?: string;
  changes: readonly CmsRevisionFieldDetail[];
}) {
  return (
    <ul className="grid gap-2">
      {changes.map((change) => {
        const before = visibleSummary(change.beforeSummary);
        const after = visibleSummary(change.afterSummary);
        return (
          <li
            aria-label={`So sánh ${change.label}`}
            className="grid gap-2 rounded-lg border bg-background p-3"
            key={change.key}
          >
            <strong className="text-xs">{change.label}</strong>
            {before !== null || after !== null ? (
              <dl className="grid items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                <div className="rounded-md bg-muted/60 px-3 py-2">
                  <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {beforeLabel}
                  </dt>
                  <dd className="mt-1 break-words text-xs leading-5">
                    {before ?? "Không có tóm tắt"}
                  </dd>
                </div>
                <ArrowRight
                  aria-hidden
                  className="mx-auto size-4 self-center text-muted-foreground max-sm:rotate-90"
                />
                <div className="rounded-md bg-primary/7 px-3 py-2 ring-1 ring-inset ring-primary/10">
                  <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {afterLabel}
                  </dt>
                  <dd className="mt-1 break-words text-xs leading-5">
                    {after ?? "Không có tóm tắt"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-xs leading-5 text-muted-foreground">
                Giá trị có cấu trúc đã thay đổi. Chi tiết thô được giữ riêng để
                tránh lộ metadata nội bộ.
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
