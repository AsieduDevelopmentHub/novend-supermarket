"use client";

import { useState } from "react";
import { ChevronRight, LayoutGrid } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  SettingsSectionGroup,
  SettingsSectionIconMap,
  SettingsTab,
} from "./settings-section-groups";

type Props = {
  groups: SettingsSectionGroup[];
  activeTab: SettingsTab;
  icons: SettingsSectionIconMap;
  onSelect: (tab: SettingsTab) => void;
};

/** Grouped section picker for phones and narrow viewports — replaces the easy-to-miss dropdown. */
export function SettingsMobileSectionNav({ groups, activeTab, icons, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false);
  const sectionCount = groups.reduce((sum, group) => sum + group.items.length, 0);
  const activeSection =
    groups.flatMap((group) => group.items).find((item) => item.value === activeTab) ?? null;
  const ActiveIcon = icons[activeTab];

  if (!expanded) {
    return (
      <Card className="lg:hidden" data-tour="settings-sections">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="bg-accent text-accent-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <ActiveIcon className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Current section
            </p>
            <p className="truncate text-sm font-semibold">{activeSection?.long ?? "Profile"}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(true)}>
            <LayoutGrid className="mr-2 h-4 w-4" aria-hidden />
            All sections
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:hidden" data-tour="settings-sections">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Browse settings</CardTitle>
            <CardDescription>
              {sectionCount} sections — tap a row to open it below.
            </CardDescription>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded(false)}>
            Done
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="text-muted-foreground mb-2 px-1 text-xs font-semibold tracking-wider uppercase">
              {group.label}
            </p>
            <div className="border-border divide-border divide-y overflow-hidden rounded-lg border">
              {group.items.map((item) => {
                const Icon = icons[item.value];
                const active = activeTab === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      onSelect(item.value);
                      setExpanded(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-3 text-left text-sm font-medium transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted/80 bg-card text-foreground",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{item.long}</span>
                    {active ? (
                      <span className="text-primary text-xs font-semibold">Active</span>
                    ) : (
                      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
