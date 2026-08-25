"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNativeShell } from "@/hooks/use-native-shell";
import { cn } from "@/lib/utils";

export type PageHeaderCompactAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
};

const NATIVE_HEADER_HOST_ID = "native-page-header-host";

export function PageHeader({
  title,
  description,
  actions,
  compactActions,
  className,
}: {
  title: string;
  description?: string;
  /** Full CTAs — sticky on desktop; scrollable under the title on Capacitor. */
  actions?: ReactNode;
  /**
   * Icon shortcuts shown in the native title bar once `actions` scroll away.
   * Prefer one icon per primary header CTA (e.g. Print, Export, New Sale).
   */
  compactActions?: PageHeaderCompactAction[];
  className?: string;
}) {
  const nativeShell = useNativeShell();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarAway, setToolbarAway] = useState(false);
  // Host is mounted by the app shell before page content; read during render
  // so we do not need a syncing effect (avoids cascading setState).
  const headerHost =
    nativeShell && typeof document !== "undefined"
      ? document.getElementById(NATIVE_HEADER_HOST_ID)
      : null;

  useEffect(() => {
    if (!nativeShell) return;
    const node = toolbarRef.current;
    if (!node || (!actions && !compactActions?.length)) {
      queueMicrotask(() => setToolbarAway(false));
      return;
    }

    const scrollRoot = node.closest("main");
    const observer = new IntersectionObserver(
      ([entry]) => {
        setToolbarAway(!entry?.isIntersecting);
      },
      {
        root: scrollRoot instanceof Element ? scrollRoot : null,
        rootMargin: "0px 0px 0px 0px",
        threshold: 0,
      },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [nativeShell, actions, compactActions, title]);

  if (!nativeShell) {
    return (
      <header
        className={cn(
          "mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
          className,
        )}
      >
        <div className="min-w-0 flex-1">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="text-muted-foreground mt-1 text-sm">{description}</p> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </header>
    );
  }

  const showCompact = Boolean(toolbarAway && compactActions && compactActions.length > 0);

  const titleBar = (
    <header className="native-page-header">
      <div className="flex min-h-11 w-full items-center gap-2">
        <h1 className="text-foreground min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
          {title}
        </h1>
        {showCompact ? (
          <div
            className="flex shrink-0 items-center gap-0.5"
            role="toolbar"
            aria-label={`${title} actions`}
          >
            {compactActions!.map((action) => {
              const Icon = action.icon;
              const btnClass = "text-foreground h-9 w-9 shrink-0 touch-target rounded-full";
              if (action.href) {
                return (
                  <Button
                    key={action.key}
                    asChild
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={btnClass}
                    disabled={action.disabled}
                  >
                    <Link href={action.href} aria-label={action.label} title={action.label}>
                      <Icon className="h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                );
              }
              return (
                <Button
                  key={action.key}
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={btnClass}
                  aria-label={action.label}
                  title={action.label}
                  disabled={action.disabled}
                  onClick={action.onClick}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </Button>
              );
            })}
          </div>
        ) : null}
      </div>
    </header>
  );

  return (
    <div className={cn("mb-4", className)}>
      {headerHost ? createPortal(titleBar, headerHost) : null}

      {description || actions ? (
        <div ref={toolbarRef} className="native-page-toolbar space-y-2.5">
          {description ? (
            <p className="text-muted-foreground text-sm leading-snug">{description}</p>
          ) : null}
          {actions ? (
            <div className="flex w-full min-w-0 flex-nowrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : compactActions?.length ? (
        // Still observe something so compact icons can appear after user scrolls.
        <div ref={toolbarRef} className="h-px w-full" aria-hidden />
      ) : null}
    </div>
  );
}
