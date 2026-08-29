"use client";

import { useState } from "react";
import Link from "next/link";
import { FileDown, FileSpreadsheet, FileText, RefreshCw } from "lucide-react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/feedback/loading-state";
import { usePlatformMonitoringData } from "@/hooks/use-platform-offline-data";
import type { PlatformMonitoringRange } from "@/lib/offline/platform-cache";
import {
  downloadPlatformCsv,
  downloadPlatformExecutivePdf,
  downloadPlatformWorkbook,
} from "@/lib/export/platform";
import { showError } from "@/lib/errors";
import { toast } from "sonner";
import { useConnectivity } from "@/hooks/use-connectivity";

const RANGES: Array<{ id: PlatformMonitoringRange; label: string }> = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "12m", label: "12 months" },
  { id: "all", label: "All time" },
];

export function PlatformExportsView() {
  const online = useConnectivity();
  const [range, setRange] = useState<PlatformMonitoringRange>("30d");
  const [pending, setPending] = useState<string | null>(null);
  const { data, loading } = usePlatformMonitoringData(range);
  const recordExport = useMutation(api.telemetry.recordAdminExport);
  const seedBaselines = useAction(api.telemetry.seedDownloadBaselines);

  async function run(format: "pdf" | "xlsx" | "csv") {
    if (!data) return;
    setPending(format);
    try {
      if (format === "pdf") downloadPlatformExecutivePdf(data);
      else if (format === "xlsx") downloadPlatformWorkbook(data);
      else downloadPlatformCsv(data);
      if (online) await recordExport({ format, range });
      toast.success(`${format.toUpperCase()} platform report downloaded`);
    } catch (error) {
      showError(error, "Could not export the platform report");
    } finally {
      setPending(null);
    }
  }

  async function initializeBaselines() {
    if (!online) {
      toast.error("Connect to seed historical download totals");
      return;
    }
    setPending("baseline");
    try {
      const result = await seedBaselines({});
      toast.success(`Download baseline checked for ${result.examined} release assets`);
    } catch (error) {
      showError(error, "Could not import GitHub download totals");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform exports"
        description="Presentation-ready summaries and submission-ready analytics workbooks."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/platform">Back to monitoring</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1" aria-label="Report range">
        {RANGES.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={range === item.id ? "default" : "outline"}
            onClick={() => setRange(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {loading || !data ? (
        <LoadingState label="Preparing platform report…" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <ExportCard
            icon={FileText}
            title="Executive PDF"
            description="Branded KPI brief for presentations, leadership review, and stakeholder submission."
            detail="Includes engagement, revenue, runtime distribution, operational health, and tracking disclosures."
            button="Download PDF"
            pending={pending === "pdf"}
            onClick={() => void run("pdf")}
          />
          <ExportCard
            icon={FileSpreadsheet}
            title="Full analytics workbook"
            description="Multi-sheet Excel workbook for detailed review and formal submission."
            detail="Executive summary, trends, runtimes, feature adoption, releases, operations, and organizations."
            button="Download XLSX"
            pending={pending === "xlsx"}
            onClick={() => void run("xlsx")}
          />
          <ExportCard
            icon={FileDown}
            title="Executive CSV"
            description="Portable KPI dataset for spreadsheets, dashboards, and downstream analysis."
            detail="Formula-safe values with the selected reporting range and generated-at metadata."
            button="Download CSV"
            pending={pending === "csv"}
            onClick={() => void run("csv")}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4" />
            Historical download baseline
          </CardTitle>
          <CardDescription>
            Import each published GitHub asset&apos;s existing download total once. Daily Novend
            trends remain separate and begin when redirect telemetry is enabled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            disabled={!online || pending !== null}
            onClick={() => void initializeBaselines()}
          >
            {pending === "baseline" ? "Checking GitHub…" : "Import historical totals"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ExportCard({
  icon: Icon,
  title,
  description,
  detail,
  button,
  pending,
  onClick,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
  detail: string;
  button: string;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="bg-accent text-accent-foreground mb-2 flex h-10 w-10 items-center justify-center rounded-full">
          <Icon className="h-5 w-5" />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-5">
        <p className="text-muted-foreground text-sm">{detail}</p>
        <Button type="button" onClick={onClick} disabled={pending}>
          {pending ? "Preparing…" : button}
        </Button>
      </CardContent>
    </Card>
  );
}
