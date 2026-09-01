"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import type { OrgImportExportSnapshot } from "@/convex/shared/importExportSnapshot";

function formatCap(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Unlimited";
  return formatNumber(value);
}

function formatOverrideValue(value: number | null | undefined): string {
  if (value === undefined) return "Plan default";
  if (value === null) return "Unlimited";
  return formatNumber(value);
}

export function PlatformImportExportCard({
  snapshot,
}: {
  snapshot: OrgImportExportSnapshot | null | undefined;
}) {
  if (!snapshot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Import & export</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Import and export entitlements are not in this cached snapshot. Reconnect to load this
            organization’s limits and activity.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { capabilities } = snapshot;
  const formats = [
    capabilities.canExportCsv ? "CSV" : null,
    capabilities.canExportJson ? "JSON" : null,
    capabilities.canExportXlsx ? "Excel" : null,
    capabilities.canExportPdf ? "PDF" : null,
  ].filter((value): value is string => value !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Import & export
          {snapshot.productLimitOverridden ? (
            <Badge variant="outline">Product limit overridden</Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground text-xs">Import row cap</dt>
            <dd className="mt-1 font-medium">{formatNumber(snapshot.maxImportRows)} per file</dd>
            <p className="text-muted-foreground mt-1 text-xs">
              Follows the product limit
              {snapshot.productLimitOverridden ? " (including this org’s override)" : ""}, never
              above 10,000.
            </p>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Products used</dt>
            <dd className="mt-1 font-medium">
              {formatNumber(snapshot.productsUsed)} / {formatCap(snapshot.productLimit)}
            </dd>
            <p className="text-muted-foreground mt-1 text-xs">
              {snapshot.remainingProductCreates === null
                ? "Creates are not capped; each import file still uses the row cap above."
                : `${formatNumber(snapshot.remainingProductCreates)} new products can still be created (import or otherwise).`}
            </p>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Export formats</dt>
            <dd className="mt-1 font-medium">{formats.join(" · ")}</dd>
            <p className="text-muted-foreground mt-1 text-xs">
              {capabilities.canExportXlsx
                ? "Excel and PDF follow this organization’s plan (Pro and above)."
                : "Excel and PDF require Pro or above. Changing the product override does not unlock them."}
            </p>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Recorded activity</dt>
            <dd className="mt-1 font-medium">
              {formatNumber(snapshot.importJobs)} imports · {formatNumber(snapshot.exportEvents)}{" "}
              exports
            </dd>
            <p className="text-muted-foreground mt-1 text-xs">
              Counts and filenames only. Spreadsheet contents are not stored.
            </p>
          </div>
        </dl>

        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Failed imports" value={formatNumber(snapshot.failedImports)} />
          <Stat label="Created via import" value={formatNumber(snapshot.createdViaImport)} />
          <Stat label="Updated via import" value={formatNumber(snapshot.updatedViaImport)} />
          <Stat
            label="Exports by format"
            value={`CSV ${snapshot.exportsByFormat.csv} · XLSX ${snapshot.exportsByFormat.xlsx} · PDF ${snapshot.exportsByFormat.pdf} · JSON ${snapshot.exportsByFormat.json}`}
          />
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-xs">Last import</p>
            <p className="mt-1 font-medium">
              {snapshot.lastImportAt ? formatDateTime(snapshot.lastImportAt) : "None yet"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Last export</p>
            <p className="mt-1 font-medium">
              {snapshot.lastExportAt ? formatDateTime(snapshot.lastExportAt) : "None yet"}
            </p>
          </div>
        </div>

        {snapshot.limitChanges.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Recent limit overrides</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">When</th>
                    <th className="pb-2 font-medium">Products</th>
                    <th className="pb-2 font-medium">Users</th>
                    <th className="pb-2 font-medium">Branches</th>
                    <th className="pb-2 font-medium">Devices</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.limitChanges.map((change) => (
                    <tr key={change.createdAt} className="border-border border-t">
                      <td className="py-2">{formatDateTime(change.createdAt)}</td>
                      <td className="py-2">{formatOverrideValue(change.products)}</td>
                      <td className="py-2">{formatOverrideValue(change.users)}</td>
                      <td className="py-2">{formatOverrideValue(change.branches)}</td>
                      <td className="py-2">{formatOverrideValue(change.devices)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground text-xs">
              Product column is the import row cap source after that save. Missing keys were left at
              the plan default.
            </p>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <ActivityTable
            title="Recent imports"
            empty="No product imports recorded."
            headers={["File", "Status", "Created / updated", "When"]}
            rows={snapshot.recentJobs.map((job) => [
              job.fileName,
              job.status,
              `${formatNumber(job.createdCount)} / ${formatNumber(job.updatedCount)}`,
              formatDateTime(job.createdAt),
            ])}
          />
          <ActivityTable
            title="Recent exports"
            empty="No exports recorded."
            headers={["Kind", "Format", "Rows", "When"]}
            rows={snapshot.recentExports.map((event) => [
              event.kind,
              event.format.toUpperCase(),
              formatNumber(event.rowCount),
              formatDateTime(event.createdAt),
            ])}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 font-medium break-words">{value}</p>
    </div>
  );
}

function ActivityTable({
  title,
  empty,
  headers,
  rows,
}: {
  title: string;
  empty: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                {headers.map((header) => (
                  <th key={header} className="pb-2 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row[0]}-${row[3]}-${index}`} className="border-border border-t">
                  {row.map((cell, cellIndex) => (
                    <td key={headers[cellIndex]} className="py-2">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
