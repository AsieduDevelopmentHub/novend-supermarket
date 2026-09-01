"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LIST_PAGE_SIZE_OPTIONS, type ListPageSize } from "@/constants/list-page";
import { cn } from "@/lib/utils";

type Props = {
  page: number;
  pageSize: ListPageSize;
  total: number;
  /** Set when more pages exist but the exact total is not loaded yet (cursor pagination). */
  hasNextPage?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: ListPageSize) => void;
};

export function ListPagination({
  page,
  pageSize,
  total,
  hasNextPage = false,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const knownPages = Math.max(1, Math.ceil(total / pageSize));
  const pages = hasNextPage ? Math.max(knownPages, page + 1) : knownPages;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const pageIndicator = hasNextPage ? `${page}/${pages}+` : `${page}/${pages}`;
  const atLastPage = !hasNextPage && page >= pages;

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
      <p className="text-muted-foreground min-w-0 truncate text-xs sm:text-sm">
        {total === 0 ? (
          "No records"
        ) : (
          <>
            <span className="tabular-nums">
              {from}–{to} of {total}
              {hasNextPage ? "+" : ""}
            </span>
            <span className="text-muted-foreground/80"> records</span>
          </>
        )}
      </p>

      <div className={cn("flex shrink-0 items-center gap-1 sm:gap-2", total === 0 && "opacity-60")}>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value) as ListPageSize)}
        >
          <SelectTrigger className="h-9 w-[3.25rem] shrink-0 px-2 sm:w-auto sm:min-w-[5.75rem] sm:px-3">
            <SelectValue aria-label={`${pageSize} rows per page`}>
              <span className="tabular-nums">{pageSize}</span>
              <span className="hidden sm:inline"> / page</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            {LIST_PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                <span className="tabular-nums">{size}</span>
                <span className="hidden sm:inline"> / page</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-9 shrink-0 px-0 sm:w-auto sm:px-3"
          disabled={page <= 1 || total === 0}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        <p
          className="text-muted-foreground min-w-[2.75rem] shrink-0 text-center text-sm font-medium tabular-nums sm:min-w-[3.25rem]"
          aria-live="polite"
          aria-label={`Page ${page} of ${hasNextPage ? "many" : pages}`}
        >
          {pageIndicator}
        </p>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-9 shrink-0 px-0 sm:w-auto sm:px-3"
          disabled={atLastPage || total === 0}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
