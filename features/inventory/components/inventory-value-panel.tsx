"use client";

import { FormEvent, useState } from "react";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useConnectivity } from "@/hooks/use-connectivity";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Grid } from "@/components/layout/primitives";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/currency";
import { findInventoryValueDays } from "@/convex/shared/inventoryValueSeries";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Basis = "cost" | "sell";

export function useInventoryValueSeries(
  range: { startDate: number; endDate: number } | null,
  branchId: Id<"branches"> | undefined,
  enabled: boolean,
) {
  const online = useConnectivity();
  const data = useAuthedQuery(
    api.reports.inventoryValue,
    enabled && online && range ? { ...range, branchId } : "skip",
  );
  return { online, data };
}

export function InventoryValuePanel({
  range,
  branchId,
  enabled,
}: {
  range: { startDate: number; endDate: number } | null;
  branchId: Id<"branches"> | undefined;
  enabled: boolean;
}) {
  const { online, data } = useInventoryValueSeries(range, branchId, enabled);
  const [amount, setAmount] = useState("");
  const [basis, setBasis] = useState<Basis>("cost");
  const [result, setResult] = useState<ReturnType<typeof findInventoryValueDays> | null>(null);
  const [searched, setSearched] = useState<number | null>(null);

  if (!enabled) return null;

  const showCost = data?.showCost !== false;
  const activeBasis: Basis = showCost ? basis : "sell";
  const latest = data?.points[data.points.length - 1];

  function onFind(event: FormEvent) {
    event.preventDefault();
    if (!data) return;
    const target = Number(amount);
    if (!Number.isFinite(target) || target < 0) return;
    const points = data.points.map((point) => ({
      date: point.date,
      cost: point.cost ?? 0,
      sell: point.sell,
    }));
    setSearched(target);
    setResult(findInventoryValueDays(points, target, showCost ? basis : "sell"));
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Inventory value</CardTitle>
        <CardDescription>
          Stock value at the start and end of this period, priced at today&apos;s cost and selling
          prices.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!online ? (
          <p className="text-muted-foreground text-sm">
            Connect to the cloud to load inventory value for this period.
          </p>
        ) : data === undefined ? (
          <LoadingState label="Loading inventory value…" />
        ) : data.points.length === 0 ? (
          <EmptyState title="No days in this range" />
        ) : (
          <>
            {data.partial ? (
              <p className="text-muted-foreground text-sm">
                This range has more stock movements than the report can replay. Earlier days may
                be short.
              </p>
            ) : null}
            <Grid cols={2}>
              <Bookend
                title={`Before · ${data.points[0]?.date ?? ""}`}
                cost={data.opening.cost}
                sell={data.opening.sell}
                showCost={showCost}
              />
              <Bookend
                title={`After · ${latest?.date ?? ""}`}
                cost={data.closing.cost}
                sell={data.closing.sell}
                showCost={showCost}
              />
            </Grid>
            <p className="text-muted-foreground text-sm">
              Change over this period
              {showCost
                ? ` · Cost ${signedMoney((data.closing.cost ?? 0) - (data.opening.cost ?? 0))}`
                : ""}
              {` · Selling ${signedMoney(data.closing.sell - data.opening.sell)}`}
            </p>
            <div className="h-52 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.points} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis hide width={36} fontSize={12} />
                  <Tooltip
                    formatter={(value, name) => [
                      formatCurrency(Number(value ?? 0)),
                      name === "cost" ? "Cost" : "Selling",
                    ]}
                  />
                  {showCost ? (
                    <Area
                      type="monotone"
                      dataKey="cost"
                      stroke="#0f766e"
                      fill="#0f766e"
                      fillOpacity={0.15}
                    />
                  ) : null}
                  <Area
                    type="monotone"
                    dataKey="sell"
                    stroke="#38bdf8"
                    fill="#38bdf8"
                    fillOpacity={0.12}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <form onSubmit={onFind} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="inventory-value-amount">Find when stock was worth</Label>
                <Input
                  id="inventory-value-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                />
              </div>
              {showCost ? (
                <div className="space-y-2">
                  <Label htmlFor="inventory-value-basis">Price</Label>
                  <Select value={basis} onValueChange={(value) => setBasis(value as Basis)}>
                    <SelectTrigger id="inventory-value-basis" className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cost">Cost</SelectItem>
                      <SelectItem value="sell">Selling</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <Button type="submit" variant="secondary" disabled={!amount.trim()}>
                Find
              </Button>
            </form>
            {result && searched !== null ? (
              <SearchResult result={result} basis={activeBasis} target={searched} />
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function signedMoney(amount: number) {
  const formatted = formatCurrency(amount);
  return amount > 0 ? `+${formatted}` : formatted;
}

function Bookend({
  title,
  cost,
  sell,
  showCost,
}: {
  title: string;
  cost: number | null;
  sell: number;
  showCost: boolean;
}) {
  return (
    <div className="border-border min-w-0 rounded-lg border px-3 py-2">
      <p className="text-muted-foreground text-xs">{title}</p>
      {showCost ? (
        <p className="mt-1 text-sm">
          <span className="text-muted-foreground">Cost </span>
          <span className="font-semibold">{formatCurrency(cost ?? 0)}</span>
        </p>
      ) : null}
      <p className="text-sm">
        <span className="text-muted-foreground">Selling </span>
        <span className="font-semibold">{formatCurrency(sell)}</span>
      </p>
    </div>
  );
}

function SearchResult({
  result,
  basis,
  target,
}: {
  result: ReturnType<typeof findInventoryValueDays>;
  basis: Basis;
  target: number;
}) {
  if (result.exact.length > 0) {
    return (
      <ul className="space-y-1 text-sm">
        {result.exact.map((point) => (
          <li key={point.date}>
            {point.date}: {formatCurrency(point[basis])}
          </li>
        ))}
      </ul>
    );
  }
  if (!result.closest) {
    return <p className="text-muted-foreground text-sm">No days to compare.</p>;
  }
  const value = result.closest[basis];
  return (
    <p className="text-sm">
      No day matches {formatCurrency(target)}. Closest is {result.closest.date} at{" "}
      {formatCurrency(value)}.
    </p>
  );
}
