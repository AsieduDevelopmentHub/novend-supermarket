import { jsPDF } from "jspdf";
import { APP_BRAND } from "@/constants/app";
import { buildCsvText } from "./csv";
import { buildMultiSheetXlsxBytes } from "./xlsx";
import { bytesToBlob, downloadBlob } from "./download";
import type { ExportTable } from "./types";

export type PlatformReportData = {
  range: string;
  generatedAt: number;
  trackingStartedAt: number | null;
  kpis: {
    organizations: number;
    activeOrganizations: number;
    trialOrganizations: number;
    staffAccounts: number;
    dau: number;
    wau: number;
    mau: number;
    mrr: number;
    arr: number;
    grossRevenue: number;
    operatingCosts: number;
    downloads: number;
    activeDevices: number;
    churnRate: number;
    activationRate: number;
  };
  activationFunnel: Array<{ stage: string; count: number }>;
  runtimeCounts: Record<"web" | "pwa" | "electron" | "android" | "ios", number>;
  planDistribution: Array<{ planKey: string; name: string; count: number }>;
  featureAdoption: Array<{ feature: string; count: number }>;
  downloadAssets: Array<{ assetGroup: string; count: number }>;
  releaseAdoption: Array<{ version: string; downloads: number; activeDevices: number }>;
  series: Array<{
    day: string;
    activeUsers: number;
    downloads: number;
    errors: number;
    featureEvents: number;
  }>;
  operations: {
    storageBytes: number;
    backupCount: number;
    staleDevices: number;
    devicesSeenLast24h: number;
    pendingPayments: number;
    stalePendingPayments: number;
    failedPayments: number;
    clientErrors: number;
    syncFailures: number;
    imports: number;
    failedImports: number;
    exports: number;
  };
  comparisons: {
    organizationGrowth: number | null;
    revenue: number | null;
    downloads: number | null;
    clientErrors: number | null;
  };
  recentOrganizations: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    planKey: string;
    createdAt: number;
  }>;
};

function table(
  title: string,
  columns: ExportTable["columns"],
  rows: ExportTable["rows"],
  range: string,
): ExportTable {
  return {
    title,
    filenameKind: "platform",
    filenameSuffix: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    columns,
    rows,
    meta: { Range: range, Generated: new Date().toISOString() },
  };
}

export function platformReportTables(data: PlatformReportData) {
  const summary = table(
    "Executive Summary",
    [
      { key: "metric", header: "Metric" },
      { key: "value", header: "Value" },
    ],
    [
      { metric: "Organizations", value: data.kpis.organizations },
      { metric: "Active organizations", value: data.kpis.activeOrganizations },
      { metric: "Trial organizations", value: data.kpis.trialOrganizations },
      { metric: "Staff accounts", value: data.kpis.staffAccounts },
      { metric: "DAU", value: data.kpis.dau },
      { metric: "WAU", value: data.kpis.wau },
      { metric: "MAU", value: data.kpis.mau },
      { metric: "MRR (GHS)", value: data.kpis.mrr },
      { metric: "ARR (GHS)", value: data.kpis.arr },
      { metric: "Gross revenue (GHS)", value: data.kpis.grossRevenue },
      { metric: "Operating costs (GHS)", value: data.kpis.operatingCosts },
      { metric: "Lifetime downloads", value: data.kpis.downloads },
      { metric: "Active devices", value: data.kpis.activeDevices },
      { metric: "Activation rate", value: data.kpis.activationRate },
      { metric: "Subscription churn", value: data.kpis.churnRate },
    ],
    data.range,
  );
  const engagement = table(
    "Engagement Trends",
    [
      { key: "day", header: "Day" },
      { key: "activeUsers", header: "Active users" },
      { key: "downloads", header: "Downloads" },
      { key: "featureEvents", header: "Feature events" },
      { key: "errors", header: "Client errors" },
    ],
    data.series,
    data.range,
  );
  const runtimes = table(
    "Runtime Distribution",
    [
      { key: "runtime", header: "Runtime" },
      { key: "devices", header: "Active devices" },
    ],
    Object.entries(data.runtimeCounts).map(([runtime, devices]) => ({ runtime, devices })),
    data.range,
  );
  const adoption = table(
    "Feature Adoption",
    [
      { key: "feature", header: "Feature" },
      { key: "count", header: "Usage events" },
    ],
    data.featureAdoption,
    data.range,
  );
  const releases = table(
    "Release Adoption",
    [
      { key: "version", header: "Version" },
      { key: "downloads", header: "Downloads" },
      { key: "activeDevices", header: "Active devices" },
    ],
    data.releaseAdoption,
    data.range,
  );
  const organizations = table(
    "Recent Organizations",
    [
      { key: "name", header: "Organization" },
      { key: "slug", header: "Slug" },
      { key: "planKey", header: "Plan" },
      { key: "status", header: "Status" },
      { key: "createdAt", header: "Created" },
    ],
    data.recentOrganizations.map((organization) => ({
      ...organization,
      createdAt: new Date(organization.createdAt).toISOString(),
    })),
    data.range,
  );
  const operations = table(
    "Operations",
    [
      { key: "metric", header: "Metric" },
      { key: "value", header: "Value" },
    ],
    Object.entries(data.operations).map(([metric, value]) => ({ metric, value })),
    data.range,
  );
  return { summary, engagement, runtimes, adoption, releases, organizations, operations };
}

function reportFilename(range: string, extension: string) {
  const day = new Date().toISOString().slice(0, 10);
  return `${APP_BRAND}-Platform-Report-${range}-${day}.${extension}`;
}

export function downloadPlatformWorkbook(data: PlatformReportData) {
  const tables = platformReportTables(data);
  const bytes = buildMultiSheetXlsxBytes(
    Object.values(tables).map((reportTable) => ({
      name: reportTable.title,
      table: reportTable,
    })),
  );
  downloadBlob(
    reportFilename(data.range, "xlsx"),
    bytesToBlob(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
  );
}

export function downloadPlatformCsv(data: PlatformReportData) {
  const csv = buildCsvText(platformReportTables(data).summary);
  downloadBlob(reportFilename(data.range, "csv"), new Blob([csv], { type: "text/csv;charset=utf-8" }));
}

export function buildPlatformExecutivePdf(data: PlatformReportData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 42;
  const contentWidth = width - margin * 2;
  let y = 46;

  doc.setFillColor(15, 118, 110);
  doc.roundedRect(margin, y, contentWidth, 74, 10, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(`${APP_BRAND} Platform Executive Report`, margin + 18, y + 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `${data.range.toUpperCase()} · Generated ${new Date(data.generatedAt).toLocaleString("en-GH")}`,
    margin + 18,
    y + 50,
  );
  y += 96;

  const cards = [
    ["MRR", `GHS ${data.kpis.mrr.toLocaleString("en-GH")}`],
    ["Active organizations", data.kpis.activeOrganizations.toLocaleString("en-GH")],
    ["Monthly active users", data.kpis.mau.toLocaleString("en-GH")],
    ["Lifetime downloads", data.kpis.downloads.toLocaleString("en-GH")],
    ["Active devices", data.kpis.activeDevices.toLocaleString("en-GH")],
    ["Gross revenue", `GHS ${data.kpis.grossRevenue.toLocaleString("en-GH")}`],
  ];
  const cardWidth = (contentWidth - 20) / 3;
  cards.forEach(([label, value], index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = margin + column * (cardWidth + 10);
    const cardY = y + row * 68;
    doc.setFillColor(245, 248, 250);
    doc.roundedRect(x, cardY, cardWidth, 56, 7, 7, "F");
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(label, x + 10, cardY + 18);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(value, x + 10, cardY + 39);
  });
  y += 148;

  const sections: Array<[string, string[]]> = [
    [
      "Engagement",
      [
        `DAU ${data.kpis.dau.toLocaleString()} · WAU ${data.kpis.wau.toLocaleString()} · MAU ${data.kpis.mau.toLocaleString()}`,
        `Staff accounts ${data.kpis.staffAccounts.toLocaleString()} across ${data.kpis.organizations.toLocaleString()} organizations`,
        `Activation ${Math.round(data.kpis.activationRate * 100)}% · Churn ${Math.round(data.kpis.churnRate * 100)}%`,
      ],
    ],
    [
      "Runtime distribution",
      Object.entries(data.runtimeCounts).map(
        ([runtime, count]) => `${runtime}: ${count.toLocaleString()}`,
      ),
    ],
    [
      "Operational health",
      [
        `Client errors ${data.operations.clientErrors} · Sync failures ${data.operations.syncFailures}`,
        `Stale devices ${data.operations.staleDevices} · Failed payments ${data.operations.failedPayments}`,
        `Backups ${data.operations.backupCount} · Storage ${data.operations.storageBytes.toLocaleString()} bytes`,
      ],
    ],
    [
      "Top feature adoption",
      data.featureAdoption.slice(0, 6).map((row) => `${row.feature}: ${row.count.toLocaleString()}`),
    ],
  ];
  for (const [heading, lines] of sections) {
    if (y > height - 110) {
      doc.addPage();
      y = margin;
    }
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(heading, margin, y);
    y += 17;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    for (const line of lines.length ? lines : ["No data in this range."]) {
      doc.text(`• ${line}`, margin + 4, y);
      y += 14;
    }
    y += 10;
  }

  const disclosure = data.trackingStartedAt
    ? `Download totals include an imported GitHub baseline. Daily Novend trends are tracked from ${new Date(data.trackingStartedAt).toLocaleDateString("en-GH")}.`
    : "Download trend tracking has not yet been initialized.";
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(doc.splitTextToSize(disclosure, contentWidth), margin, height - 42);
  return doc.output("blob");
}

export function downloadPlatformExecutivePdf(data: PlatformReportData) {
  downloadBlob(reportFilename(data.range, "pdf"), buildPlatformExecutivePdf(data));
}
