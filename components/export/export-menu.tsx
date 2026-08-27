"use client";

import { useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PlanCapabilities } from "@/lib/export/capabilities";
import { capabilityDeniedMessage } from "@/lib/export/capabilities";
import { runExport } from "@/lib/export/run";
import type { ExportFormat, ExportTable } from "@/lib/export/types";
import { showError } from "@/lib/errors";
import { toast } from "sonner";

const FORMATS: Array<{ id: ExportFormat; label: string }> = [
  { id: "csv", label: "CSV" },
  { id: "xlsx", label: "Excel (.xlsx)" },
  { id: "pdf", label: "PDF" },
  { id: "json", label: "JSON" },
];

export function ExportMenu({
  table,
  capabilities,
  planName,
  disabled,
  upgradeHref = "/settings?section=billing",
  onExported,
}: {
  table: ExportTable | null;
  capabilities: PlanCapabilities;
  planName: string;
  disabled?: boolean;
  upgradeHref?: string;
  onExported?: (format: ExportFormat, rows: number) => void;
}) {
  const [pending, setPending] = useState(false);

  async function onFormat(format: ExportFormat) {
    if (!table) return;
    setPending(true);
    try {
      const result = await runExport({ table, format, capabilities, planName });
      toast.success("Export downloaded");
      onExported?.(format, result.rows);
    } catch (error) {
      showError(error, "Export failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled || pending || !table}>
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {FORMATS.map((format) => {
          const allowed =
            format.id === "csv"
              ? capabilities.canExportCsv
              : format.id === "json"
                ? capabilities.canExportJson
                : format.id === "xlsx"
                  ? capabilities.canExportXlsx
                  : capabilities.canExportPdf;
          if (!allowed) {
            return (
              <DropdownMenuItem key={format.id} disabled className="flex-col items-start gap-1">
                <span>{format.label}</span>
                <span className="text-muted-foreground text-xs font-normal">
                  {capabilityDeniedMessage(
                    format.id === "xlsx"
                      ? "canExportXlsx"
                      : format.id === "pdf"
                        ? "canExportPdf"
                        : "canExportCsv",
                    planName,
                  )}
                </span>
              </DropdownMenuItem>
            );
          }
          return (
            <DropdownMenuItem key={format.id} onSelect={() => void onFormat(format.id)}>
              {format.label}
            </DropdownMenuItem>
          );
        })}
        {(!capabilities.canExportXlsx || !capabilities.canExportPdf) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={upgradeHref}>Upgrade plan</Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
