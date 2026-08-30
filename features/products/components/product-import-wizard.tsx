"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { remainingProductCreates } from "@/lib/export/capabilities";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useLicense } from "@/hooks/use-license";
import { usePermissions } from "@/hooks/use-permissions";
import { useBranchesList, useProductsList } from "@/hooks/use-offline-lists";
import { parseImportFile } from "@/lib/import/parse-file";
import { sheetToObjects, type TabularSheet } from "@/lib/import/parse-delimited";
import {
  mappingFromSuggestions,
  suggestColumnMapping,
  unmappedRequiredFields,
  type ColumnMapping,
} from "@/lib/import/mapping";
import { PRODUCT_IMPORT_FIELDS, type ProductImportFieldKey } from "@/lib/import/product-fields";
import { prepareProductImport } from "@/lib/import/validate-products";
import { applyProductImport } from "@/lib/import/apply-products";
import { downloadProductImportTemplate } from "@/lib/import/template";
import { loadLocalMappings, saveLocalMapping } from "@/lib/import/mapping-storage";
import { buildCsvText } from "@/lib/export/csv";
import { downloadBlob } from "@/lib/export/download";
import { brandedDocumentName } from "@/lib/export-filenames";
import { showError } from "@/lib/errors";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/date";

const STEPS = ["Upload", "Map columns", "Preview", "Import", "Results"] as const;
type Step = (typeof STEPS)[number];

export function ProductImportWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const online = useConnectivity();
  const { capabilities, planName, limits, organizationId, access } = useLicense();
  const { isAdmin, branchId: myBranchId, canViewCost } = usePermissions();
  const { products } = useProductsList({
    search: "",
    includeInactive: true,
    canViewCost,
  });
  const catalog = products ?? [];
  const branches = useBranchesList(false, isAdmin) ?? [];
  const usage = useQuery(
    api.billing.usageSnapshot,
    online ? {} : "skip",
  );
  const remoteJobs = useQuery(api.imports.listJobs, online ? {} : "skip");
  const remoteMappings = useQuery(api.imports.listMappings, online ? {} : "skip");
  const recordJob = useMutation(api.imports.recordJob);
  const saveRemoteMapping = useMutation(api.imports.saveMapping);

  const [step, setStep] = useState<Step>("Upload");
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<TabularSheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [mappingName, setMappingName] = useState("Default");
  const [branchId, setBranchId] = useState<string>(myBranchId ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    failed: Array<{ rowNumber: number; sku: string; message: string }>;
  } | null>(null);

  const usedProducts =
    usage?.usage.find((row) => row.resource === "products")?.used ?? catalog.length;
  const remainingCreates = remainingProductCreates(usedProducts, limits.products);
  const localMappings = organizationId ? loadLocalMappings(organizationId) : [];

  const records = useMemo(() => (sheet ? sheetToObjects(sheet) : []), [sheet]);
  const preview = useMemo(() => {
    if (!sheet) {
      return null;
    }
    return prepareProductImport({
      records,
      mapping,
      existing: catalog.map((p) => ({ id: p.id, sku: p.sku, barcode: p.barcode })),
      maxRows: capabilities.maxImportRows,
      remainingCreates,
    });
  }, [sheet, records, mapping, catalog, capabilities.maxImportRows, remainingCreates]);

  const missingRequired = unmappedRequiredFields(mapping);
  const stepIndex = STEPS.indexOf(step);

  function reset() {
    setStep("Upload");
    setFileName("");
    setSheet(null);
    setMapping({});
    setResult(null);
    setBusy(false);
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const parsed = await parseImportFile(file);
      if (parsed.headers.length === 0) {
        throw new Error("No header row found. Download the Novend template and try again.");
      }
      if (parsed.rows.length > capabilities.maxImportRows) {
        throw new Error(
          `This file has ${parsed.rows.length} rows. The limit on ${planName} is ${capabilities.maxImportRows}.`,
        );
      }
      setFileName(file.name);
      setSheet(parsed);
      setMapping(mappingFromSuggestions(suggestColumnMapping(parsed.headers)));
      setStep("Map columns");
    } catch (error) {
      showError(error, "Could not read that file");
    } finally {
      setBusy(false);
    }
  }

  function applySavedMapping(json: string) {
    try {
      const parsed = JSON.parse(json) as ColumnMapping;
      setMapping((current) => {
        const next = { ...current };
        for (const header of Object.keys(next)) {
          if (parsed[header] !== undefined) next[header] = parsed[header];
        }
        return next;
      });
      toast.success("Mapping applied");
    } catch {
      toast.error("That mapping template could not be read");
    }
  }

  async function confirmImport() {
    if (!preview || !access.canWrite) return;
    const valid = preview.rows.filter((row) => row.action === "create" || row.action === "update");
    if (valid.length === 0) {
      toast.error("Nothing to import. Fix the mapping or the file.");
      return;
    }
    const targetBranch = isAdmin ? branchId : (myBranchId ?? "");
    if (!targetBranch) {
      toast.error("Choose a branch for opening stock on new products.");
      return;
    }
    setStep("Import");
    setBusy(true);
    try {
      const applied = await applyProductImport({
        rows: valid,
        branchId: targetBranch,
        online,
      });
      setResult(applied);
      if (online) {
        try {
          await recordJob({
            fileName,
            status: applied.failed.length > 0 && applied.created + applied.updated === 0
              ? "failed"
              : "completed",
            createdCount: applied.created,
            updatedCount: applied.updated,
            skippedCount: preview.skipCount,
            failedCount: applied.failed.length + preview.invalidCount,
            errorSummary:
              applied.failed[0]?.message ??
              (preview.issues[0] ? preview.issues[0].message : undefined),
          });
        } catch {
          /* history is best-effort while online */
        }
      }
      setStep("Results");
    } catch (error) {
      showError(error, "Import failed");
      setStep("Preview");
    } finally {
      setBusy(false);
    }
  }

  async function downloadIssues() {
    if (!preview) return;
    const table = {
      title: "Import issues",
      filenameKind: "Product-Import-Issues",
      columns: [
        { key: "rowNumber", header: "Row" },
        { key: "field", header: "Field" },
        { key: "message", header: "Message" },
      ],
      rows: preview.issues.map((issue) => ({
        rowNumber: issue.rowNumber || "",
        field: issue.field ?? "",
        message: issue.message,
      })),
    };
    await downloadBlob(
      brandedDocumentName("Product-Import-Issues", undefined, "csv"),
      new Blob([buildCsvText(table)], { type: "text/csv;charset=utf-8" }),
    );
  }

  const productUsage = usage?.usage.find((row) => row.resource === "products");
  const atProductCap = productUsage?.level === "full";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="w-[min(100%-1.5rem,52rem)] max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import products</DialogTitle>
          <DialogDescription>
            Upload a spreadsheet, map columns to Novend fields, then confirm what will change.
          </DialogDescription>
        </DialogHeader>

        <ol className="flex flex-wrap gap-2 text-xs">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className={
                index <= stepIndex ? "text-foreground font-medium" : "text-muted-foreground"
              }
            >
              {index + 1}. {label}
            </li>
          ))}
        </ol>
        <Progress value={((stepIndex + 1) / STEPS.length) * 100} />

        {atProductCap ? (
          <p className="text-warning text-sm">
            {planName} product limit: {productUsage?.used} / {productUsage?.limit}. Import cannot
            create new SKUs until you upgrade or archive products.
          </p>
        ) : remainingCreates !== null ? (
          <p className="text-muted-foreground text-sm">
            {planName}: {usedProducts} / {limits.products} products. {remainingCreates} new SKUs
            can still be imported.
          </p>
        ) : null}

        {!capabilities.canImportProducts ? (
          <p className="text-sm">Product import is not available on {planName}.</p>
        ) : null}

        {step === "Upload" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void downloadProductImportTemplate("csv")}
              >
                Download CSV template
              </Button>
              {capabilities.canExportXlsx ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void downloadProductImportTemplate("xlsx")}
                >
                  Download Excel template
                </Button>
              ) : null}
            </div>
            <Label htmlFor="product-import-file">Spreadsheet</Label>
            <Input
              id="product-import-file"
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.xls,.xml"
              disabled={busy || !capabilities.canImportProducts}
              onChange={(event) => void onFile(event.target.files?.[0] ?? null)}
            />
            <p className="text-muted-foreground text-xs">
              CSV or Excel, up to 5 MB and {capabilities.maxImportRows.toLocaleString()} rows.
              Quantity is opening stock for new products only.
            </p>
            {isAdmin && branches.length > 0 ? (
              <div className="space-y-1">
                <Label>Opening stock branch</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {remoteJobs && remoteJobs.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-medium">Recent imports</p>
                <ul className="text-muted-foreground max-h-32 space-y-1 overflow-auto text-xs">
                  {remoteJobs.slice(0, 8).map((job) => (
                    <li key={job.id}>
                      {job.fileName} · {job.status} · {formatDateTime(job.createdAt)} · +
                      {job.createdCount} / ~{job.updatedCount}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === "Map columns" && sheet ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[10rem] flex-1 space-y-1">
                <Label htmlFor="mapping-name">Save mapping as</Label>
                <Input
                  id="mapping-name"
                  value={mappingName}
                  onChange={(event) => setMappingName(event.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (organizationId) {
                    saveLocalMapping(organizationId, mappingName, mapping);
                  }
                  if (online) {
                    void saveRemoteMapping({
                      name: mappingName,
                      mappingJson: JSON.stringify(mapping),
                    }).catch((error) => showError(error, "Could not save mapping"));
                  }
                  toast.success("Mapping saved for the next import");
                }}
              >
                Save mapping
              </Button>
              {localMappings.length > 0 || (remoteMappings && remoteMappings.length > 0) ? (
                <Select onValueChange={applySavedMapping}>
                  <SelectTrigger className="w-[12rem]">
                    <SelectValue placeholder="Reuse mapping" />
                  </SelectTrigger>
                  <SelectContent>
                    {localMappings.map((row) => (
                      <SelectItem key={`local-${row.name}`} value={JSON.stringify(row.mapping)}>
                        {row.name} (this device)
                      </SelectItem>
                    ))}
                    {remoteMappings?.map((row) => (
                      <SelectItem key={row.id} value={row.mappingJson}>
                        {row.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-left">
                    <th className="px-3 py-2 font-medium">Your column</th>
                    <th className="px-3 py-2 font-medium">Novend field</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.headers.map((header) => (
                    <tr key={header} className="border-t">
                      <td className="px-3 py-2">{header || "(empty)"}</td>
                      <td className="px-3 py-2">
                        <Select
                          value={mapping[header] ?? "skip"}
                          onValueChange={(value) =>
                            setMapping((current) => ({
                              ...current,
                              [header]:
                                value === "skip" ? null : (value as ProductImportFieldKey),
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="skip">Skip</SelectItem>
                            {PRODUCT_IMPORT_FIELDS.map((field) => (
                              <SelectItem key={field.key} value={field.key}>
                                {field.label}
                                {field.required ? " *" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {missingRequired.length > 0 ? (
              <p className="text-warning text-sm">
                Map required fields:{" "}
                {missingRequired
                  .map((key) => PRODUCT_IMPORT_FIELDS.find((f) => f.key === key)?.label)
                  .join(", ")}
              </p>
            ) : null}
          </div>
        ) : null}

        {step === "Preview" && preview ? (
          <div className="space-y-3">
            <p className="text-sm">
              {preview.createCount} will be created, {preview.updateCount} updated
              {preview.invalidCount ? `, ${preview.invalidCount} need fixes` : ""}. Quantity on
              existing SKUs is not changed — use Inventory for that.
            </p>
            {preview.rows.some((row) => row.quantityIgnoredOnUpdate) ? (
              <p className="text-muted-foreground text-xs">
                Opening quantity is ignored for products that already exist.
              </p>
            ) : null}
            {preview.issues.length > 0 ? (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">Validation issues</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => void downloadIssues()}>
                    Download issues
                  </Button>
                </div>
                <ul className="max-h-32 overflow-auto text-xs">
                  {preview.issues.slice(0, 40).map((issue, index) => (
                    <li key={`${issue.rowNumber}-${index}`}>
                      Row {issue.rowNumber || "—"}: {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="max-h-48 overflow-auto rounded-md border text-xs">
              <table className="w-full">
                <thead>
                  <tr className="text-muted-foreground text-left">
                    <th className="px-2 py-1">Row</th>
                    <th className="px-2 py-1">Action</th>
                    <th className="px-2 py-1">SKU</th>
                    <th className="px-2 py-1">Name</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 50).map((row) => (
                    <tr key={`${row.rowNumber}-${row.sku}`} className="border-t">
                      <td className="px-2 py-1">{row.rowNumber}</td>
                      <td className="px-2 py-1">{row.action}</td>
                      <td className="px-2 py-1">{row.sku}</td>
                      <td className="px-2 py-1">{row.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {step === "Import" ? (
          <p className="text-sm">Saving products on this device{online ? " and syncing" : ""}…</p>
        ) : null}

        {step === "Results" && result ? (
          <div className="space-y-2 text-sm">
            <p>
              Created {result.created}. Updated {result.updated}. Failed {result.failed.length}.
            </p>
            {!online ? (
              <p className="text-muted-foreground text-xs">
                Saved locally. History is recorded when this device is back online.
              </p>
            ) : null}
            {result.failed.length > 0 ? (
              <ul className="max-h-40 overflow-auto text-xs">
                {result.failed.map((row) => (
                  <li key={`${row.rowNumber}-${row.sku}`}>
                    Row {row.rowNumber} ({row.sku}): {row.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p>All mapped rows were saved.</p>
            )}
          </div>
        ) : null}

        <DialogFooter>
          {step === "Map columns" ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep("Upload")}>
                Back
              </Button>
              <Button
                type="button"
                disabled={missingRequired.length > 0}
                onClick={() => setStep("Preview")}
              >
                Preview
              </Button>
            </>
          ) : null}
          {step === "Preview" ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep("Map columns")}>
                Back
              </Button>
              <Button
                type="button"
                disabled={busy || !preview || preview.createCount + preview.updateCount === 0}
                onClick={() => void confirmImport()}
              >
                Confirm import
              </Button>
            </>
          ) : null}
          {step === "Results" ? (
            <Button
              type="button"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Done
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
