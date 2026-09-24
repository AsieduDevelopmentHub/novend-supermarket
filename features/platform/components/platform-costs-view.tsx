"use client";

import { FormEvent, useState } from "react";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { PageHeader, Grid } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { useConnectivity } from "@/hooks/use-connectivity";
import { usePlatformOperatingCostsData } from "@/hooks/use-platform-offline-data";

const COST_CATEGORIES = [
  { value: "hosting", label: "Hosting" },
  { value: "convex", label: "Backend cloud" },
  { value: "vercel", label: "App hosting" },
  { value: "domains", label: "Domains" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "misc", label: "Miscellaneous" },
] as const;

type CostCategory = (typeof COST_CATEGORIES)[number]["value"];

function toDateInput(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fromDateInput(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function PlatformCostsView() {
  const online = useConnectivity();
  const {
    data: rows,
    loading,
    queueCreate,
    queueRemove,
    flushing,
  } = usePlatformOperatingCostsData();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<CostCategory>("hosting");
  const [occurredAt, setOccurredAt] = useState(() => toDateInput(Date.now()));
  const [description, setDescription] = useState("");

  if (loading || rows === null) {
    return <LoadingState label="Loading operating costs…" />;
  }

  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const byCategory = COST_CATEGORIES.map((item) => ({
    ...item,
    total: rows
      .filter((row) => row.category === item.value)
      .reduce((sum, row) => sum + row.amount, 0),
  })).filter((item) => item.total > 0);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const parsed = Number(amount);
    if (!(parsed > 0)) {
      toast.error("Enter a valid amount");
      return;
    }
    setPending(true);
    try {
      const result = await queueCreate({
        amount: parsed,
        category,
        occurredAt: fromDateInput(occurredAt),
        description: description.trim() || undefined,
      });
      toast.success(
        result.queued ? "Cost queued — will sync when you reconnect" : "Operating cost recorded",
      );
      setOpen(false);
      setAmount("");
      setDescription("");
      setCategory("hosting");
      setOccurredAt(toDateInput(Date.now()));
    } catch (error) {
      showError(error, "Could not save cost");
    } finally {
      setPending(false);
    }
  }

  async function onRemove(costId: string) {
    try {
      const result = await queueRemove(costId);
      toast.success(result.queued ? "Removal queued for sync" : "Cost removed");
    } catch (error) {
      showError(error, "Could not remove cost");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operating costs"
        description="Track Novend platform expenses so revenue analytics can show net profit."
        actions={
          <Button type="button" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Add cost
          </Button>
        }
      />

      {!online ? (
        <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 text-sm">
          Offline mode: new costs and removals are queued on this device and sync when you
          reconnect.
        </p>
      ) : flushing ? (
        <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 text-sm">
          Syncing queued cost changes…
        </p>
      ) : null}

      <Grid cols={4}>
        <Card className="border-l-primary border-l-[3px]">
          <CardContent className="p-5">
            <p className="text-muted-foreground text-sm">All-time costs</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(total)}</p>
          </CardContent>
        </Card>
        {byCategory.slice(0, 3).map((item) => (
          <Card key={item.value}>
            <CardContent className="p-5">
              <p className="text-muted-foreground text-sm">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold">{formatCurrency(item.total)}</p>
            </CardContent>
          </Card>
        ))}
      </Grid>

      <Card>
        <CardHeader>
          <CardTitle>Cost ledger</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Receipt}
                title="No operating costs yet"
                description="Record hosting, backend cloud, app hosting, domains, SMS, email, and other platform spend."
              />
            </div>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-border border-t">
                    <td className="px-4 py-3">{formatDateTime(row.occurredAt)}</td>
                    <td className="px-4 py-3 capitalize">{row.category}</td>
                    <td className="px-4 py-3">
                      <span>{row.description ?? "—"}</span>
                      {row.pending ? (
                        <Badge variant="outline" className="ml-2">
                          Pending sync
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void onRemove(row.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={(event) => void onCreate(event)}>
            <DialogHeader>
              <DialogTitle>Record operating cost</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="space-y-2">
                <Label htmlFor="cost-amount">Amount (GHS)</Label>
                <Input
                  id="cost-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost-category">Category</Label>
                <select
                  id="cost-category"
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as CostCategory)}
                >
                  {COST_CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost-date">Date</Label>
                <Input
                  id="cost-date"
                  type="date"
                  value={occurredAt}
                  onChange={(event) => setOccurredAt(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost-description">Description</Label>
                <Input
                  id="cost-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Optional note"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {online ? "Save" : "Queue offline"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
