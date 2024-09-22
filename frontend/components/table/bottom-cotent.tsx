import React, { useMemo } from "react";
import { Button, Pagination } from "@nextui-org/react";

export default function BottomContent({
  page,
  pages,
  setPage,
}: {
  page: any;
  pages: any;
  setPage: any;
}) {
  return useMemo(() => {
    return (
      <div className="flex flex-col items-center justify-between gap-2 px-2 py-2 sm:flex-row">
        <Pagination
          isCompact
          showControls
          showShadow
          color="primary"
          page={page}
          total={pages}
          onChange={setPage}
        />
        <div className="flex items-center justify-end gap-6">
          <span className="text-small text-default-400">
            {/*{filterSelectedKeys === "all"*/}
            {/*    ? "All items selected"*/}
            {/*    : `${filterSelectedKeys.size} of ${filteredItems.length} selected`}*/}
          </span>
          <div className="flex items-center gap-3">
            <Button
              isDisabled={page === 1}
              size="sm"
              variant="flat"
              // onPress={onPreviousPage}
            >
              Previous
            </Button>
            <Button
              isDisabled={page === pages}
              size="sm"
              variant="flat"
              // onPress={onNextPage}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    );
    // }, [filterSelectedKeys, page, pages, filteredItems.length, onPreviousPage, onNextPage]);
  }, []);
}
