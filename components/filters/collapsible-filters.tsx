"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Props = {
  children: ReactNode;
  /** Count of advanced filters that differ from defaults (search excluded). */
  activeCount?: number;
  onReset?: () => void;
  defaultOpen?: boolean;
};

/** Search stays outside. Advanced filters collapse to keep list toolbars compact. */
export function CollapsibleFilters({
  children,
  activeCount = 0,
  onReset,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          <ListFilter className="size-4" />
          Filters
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          {activeCount > 0 ? (
            <Badge variant="secondary" className="ml-1">
              {activeCount}
            </Badge>
          ) : null}
        </Button>
        {open && onReset ? (
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            Reset
          </Button>
        ) : null}
      </div>
      {open ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">{children}</div>
      ) : null}
    </div>
  );
}
