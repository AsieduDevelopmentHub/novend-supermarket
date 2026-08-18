"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useAppNavigation } from "@/hooks/use-app-navigation";

type ClickableTableRowProps = React.ComponentProps<"tr"> & {
  href: string;
};

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("a, button, input, select, textarea, label, [role='menuitem']"));
}

/** Table row that opens a detail route on click / Enter / Space. Nested links and buttons keep their own behavior. */
export function ClickableTableRow({
  href,
  className,
  onClick,
  onKeyDown,
  ...props
}: ClickableTableRowProps) {
  const { navigate } = useAppNavigation();

  return (
    <tr
      role="link"
      tabIndex={0}
      className={cn(
        "border-border hover:bg-muted/40 focus-visible:bg-muted/40 cursor-pointer border-t transition-colors focus-visible:outline-none",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || isInteractiveTarget(event.target)) return;
        navigate(href);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || isInteractiveTarget(event.target)) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate(href);
        }
      }}
      {...props}
    />
  );
}
