"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usePermissions } from "@/hooks/use-permissions";
import { useConnectivity } from "@/hooks/use-connectivity";
import { PageHeader, Grid } from "@/components/layout/primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { OfflineUnavailable } from "@/components/offline/offline-unavailable";
import { formatCurrency } from "@/lib/currency";
import { showError } from "@/lib/errors";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function DiningFloorView() {
  const online = useConnectivity();
  const { branchId, isAdmin, isManager } = usePermissions();
  const [selectedSessionId, setSelectedSessionId] = useState<Id<"diningSessions"> | null>(null);
  const [newTableName, setNewTableName] = useState("");
  const [productId, setProductId] = useState<string>("");
  const [qty, setQty] = useState("1");
  const [paying, setPaying] = useState(false);

  const tables = useQuery(api.dining.listTables, online ? {} : "skip");
  const sessions = useQuery(api.dining.listOpenSessions, online ? {} : "skip");
  const session = useQuery(
    api.dining.getSession,
    online && selectedSessionId ? { sessionId: selectedSessionId } : "skip",
  );
  const products = useQuery(api.products.listProducts, online ? {} : "skip");
  const modifierGroups = useQuery(
    api.dining.listModifierGroupsForProduct,
    online && productId ? { productId: productId as Id<"products"> } : "skip",
  );

  const upsertTable = useMutation(api.dining.upsertTable);
  const openSession = useMutation(api.dining.openSession);
  const addItem = useMutation(api.dining.addSessionItem);
  const voidItem = useMutation(api.dining.voidSessionItem);
  const fireTicket = useMutation(api.dining.fireKitchenTicket);
  const paySession = useMutation(api.dining.paySession);

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  const sessionByTable = useMemo(() => {
    const map = new Map<string, Id<"diningSessions">>();
    for (const s of sessions ?? []) {
      map.set(String(s.tableId), s._id);
    }
    return map;
  }, [sessions]);

  if (!online) {
    return <OfflineUnavailable title="Floor needs a connection" />;
  }

  if (tables === undefined || sessions === undefined) {
    return <LoadingState label="Loading floor…" />;
  }

  async function onCreateTable() {
    if (!branchId || !newTableName.trim()) return;
    try {
      await upsertTable({
        branchId: branchId as Id<"branches">,
        name: newTableName.trim(),
      });
      setNewTableName("");
      toast.success("Table added");
    } catch (error) {
      showError(error, "Could not add table");
    }
  }

  async function onOpenOrSelect(tableId: Id<"diningTables">) {
    const existing = sessionByTable.get(String(tableId));
    if (existing) {
      setSelectedSessionId(existing);
      return;
    }
    try {
      const result = await openSession({ tableId });
      setSelectedSessionId(result.sessionId);
    } catch (error) {
      showError(error, "Could not open check");
    }
  }

  async function onAddItem() {
    if (!selectedSessionId || !productId) return;
    const optionIds = Object.values(selectedOptions).filter(Boolean) as Id<"modifierOptions">[];
    try {
      await addItem({
        sessionId: selectedSessionId,
        productId: productId as Id<"products">,
        quantity: Number(qty) || 1,
        optionIds: optionIds.length ? optionIds : undefined,
      });
      setSelectedOptions({});
      toast.success("Added to check");
    } catch (error) {
      showError(error, "Could not add item");
    }
  }

  async function onFire() {
    if (!selectedSessionId) return;
    try {
      await fireTicket({ sessionId: selectedSessionId });
      toast.success("Sent to kitchen");
    } catch (error) {
      showError(error, "Could not fire ticket");
    }
  }

  async function onPay(method: "cash" | "card" | "mobile_money") {
    if (!selectedSessionId) return;
    setPaying(true);
    try {
      const result = await paySession({
        sessionId: selectedSessionId,
        paymentMethod: method,
      });
      toast.success(`Paid — ${result.invoiceNumber}`);
      setSelectedSessionId(null);
    } catch (error) {
      showError(error, "Could not complete payment");
    } finally {
      setPaying(false);
    }
  }

  const checkTotal = session?.items.reduce((sum, i) => sum + i.lineTotal, 0) ?? 0;

  return (
    <div className="min-w-0 space-y-6" data-tour="page-content">
      <PageHeader
        title="Floor"
        description="Open checks by table, send to kitchen, then pay."
      />

      {(isAdmin || isManager) && branchId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add table</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <div className="min-w-[160px] flex-1 space-y-1">
              <Label htmlFor="table-name">Name</Label>
              <Input
                id="table-name"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                placeholder="Table 1"
              />
            </div>
            <Button type="button" onClick={() => void onCreateTable()} disabled={!newTableName.trim()}>
              Add
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Grid cols={tables.length > 4 ? 4 : 3}>
        {tables.length === 0 ? (
          <EmptyState title="No tables yet" description="Add a table to start taking orders." />
        ) : (
          tables.map((table) => {
            const openId = sessionByTable.get(String(table._id));
            const selected = openId && openId === selectedSessionId;
            return (
              <button
                key={table._id}
                type="button"
                onClick={() => void onOpenOrSelect(table._id)}
                className={cn(
                  "border-border hover:border-primary rounded-xl border p-4 text-left transition",
                  openId ? "bg-primary/5" : "bg-card",
                  selected ? "ring-primary ring-2" : null,
                )}
              >
                <p className="font-semibold">{table.name}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {openId ? "Open check" : "Available"}
                </p>
              </button>
            );
          })
        )}
      </Grid>

      {selectedSessionId && session ? (
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>{session.tableName}</CardTitle>
              <Badge variant="secondary">{session.items.length} lines</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {session.items.length === 0 ? (
                <EmptyState title="Empty check" description="Add menu items below." />
              ) : (
                <ul className="space-y-2">
                  {session.items.map((item) => (
                    <li
                      key={item._id}
                      className="border-border flex items-start justify-between gap-2 rounded-lg border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {item.quantity}× {item.productName}
                        </p>
                        {item.modifiers.length > 0 ? (
                          <p className="text-muted-foreground text-xs">
                            {item.modifiers.map((m) => m.optionName).join(", ")}
                          </p>
                        ) : null}
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          {item.kitchenStatus}
                        </Badge>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm tabular-nums">
                          {formatCurrency(item.lineTotal)}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            void voidItem({ itemId: item._id }).catch((e) =>
                              showError(e, "Could not void line"),
                            )
                          }
                        >
                          Void
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <p className="font-semibold tabular-nums">{formatCurrency(checkTotal)}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => void onFire()}>
                    Send kitchen
                  </Button>
                  <Button type="button" disabled={paying || checkTotal <= 0} onClick={() => void onPay("cash")}>
                    Pay cash
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={paying || checkTotal <= 0}
                    onClick={() => void onPay("mobile_money")}
                  >
                    Pay MoMo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add item</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Product</Label>
                <Select
                  value={productId}
                  onValueChange={(value) => {
                    setProductId(value);
                    setSelectedOptions({});
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose product" />
                  </SelectTrigger>
                  <SelectContent>
                    {(products?.items ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="qty">Quantity</Label>
                <Input
                  id="qty"
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </div>
              {(modifierGroups ?? []).map((group) => (
                <div key={group._id} className="space-y-1">
                  <Label>
                    {group.name}
                    {group.required ? " *" : ""}
                  </Label>
                  <Select
                    value={selectedOptions[group._id] ?? ""}
                    onValueChange={(value) =>
                      setSelectedOptions((prev) => ({ ...prev, [group._id]: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose" />
                    </SelectTrigger>
                    <SelectContent>
                      {group.options.map((opt) => (
                        <SelectItem key={opt._id} value={opt._id}>
                          {opt.name}
                          {opt.priceDelta
                            ? ` (${opt.priceDelta > 0 ? "+" : ""}${formatCurrency(opt.priceDelta)})`
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <Button type="button" className="w-full" onClick={() => void onAddItem()} disabled={!productId}>
                Add to check
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
