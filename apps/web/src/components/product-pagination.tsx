import { Button } from "@rem-viet/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ProductPaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export default function ProductPagination({
  currentPage,
  totalPages,
  onPageChange,
}: ProductPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = visiblePages(currentPage, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-center gap-1 py-2 sm:py-4">
      <Button
        aria-label="Trang trước"
        className="size-9 rounded-lg"
        disabled={currentPage <= 1}
        size="icon"
        type="button"
        variant="outline"
        onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
      >
        <ChevronLeft aria-hidden className="size-4" />
      </Button>

      {pages.map((page, index) =>
        page === "ellipsis" ? (
          <span
            aria-hidden
            className="inline-flex size-9 items-center justify-center text-sm text-muted-foreground"
            key={`ellipsis-${index}`}
          >
            ...
          </span>
        ) : (
          <Button
            aria-label={`Trang ${page}`}
            className={`size-9 rounded-lg ${page === currentPage ? "pointer-events-none" : ""}`}
            key={page}
            size="icon"
            type="button"
            variant={page === currentPage ? "default" : "outline"}
            onClick={() => onPageChange(page)}
          >
            {page}
          </Button>
        ),
      )}

      <Button
        aria-label="Trang sau"
        className="size-9 rounded-lg"
        disabled={currentPage >= totalPages}
        size="icon"
        type="button"
        variant="outline"
        onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
      >
        <ChevronRight aria-hidden className="size-4" />
      </Button>
    </div>
  );
}

function visiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const clampedPage = Math.min(Math.max(currentPage, 1), totalPages);
  const pages: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, clampedPage - 1);
  const end = Math.min(totalPages - 1, clampedPage + 1);

  if (start > 2) {
    pages.push("ellipsis");
  }

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (end < totalPages - 1) {
    pages.push("ellipsis");
  }

  pages.push(totalPages);

  return pages;
}
