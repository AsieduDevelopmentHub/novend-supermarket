"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usePermissions, useCurrentUser } from "@/hooks/use-permissions";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useBusinessCapabilities } from "@/hooks/use-business-capabilities";
import { useBusinessTerms } from "@/hooks/use-business-terms";
import { floorViewCopy } from "@/convex/shared/businessTerms";
import { useProductsList } from "@/hooks/use-offline-lists";
import { PageHeader, Grid } from "@/components/layout/primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatCurrency } from "@/lib/currency";
import { showError } from "@/lib/errors";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getMirroredDiningSession,
  listMirroredDiningTables,
  listMirroredOpenDiningSessions,
} from "@/lib/offline/mirror-queries";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";
import { pickLiveListWhenOnline } from "@/lib/offline/list-preference";
import {
  offlineAddDiningSessionItem,
  offlineFireKitchenTicket,
  offlineOpenDiningSession,
  offlinePayDiningSession,
} from "@/lib/offline/hospitality-actions";

export function DiningFloorView() {
  const online = useConnectivity();
  const { hasCapability } = useBusinessCapabilities();
  const { terms } = useBusinessTerms();
  const floorCopy = floorViewCopy(terms);
  const canFloor = hasCapability("tables_orders");
  const { branchId, isAdmin, isManager, userId } = usePermissions();
  const { user } = useCurrentUser();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [newTableName, setNewTableName] = useState("");
  const [createBranchId, setCreateBranchId] = useState<string | undefined>(undefined);
  const [productId, setProductId] = useState<string | undefined>(undefined);
  const [qty, setQty] = useState("1");
  const [paying, setPaying] = useState(false);
  const [localTables, setLocalTables] = useState<
    Awaited<ReturnType<typeof listMirroredDiningTables>>
  >(null);
  const [localSessions, setLocalSessions] = useState<
    Awaited<ReturnType<typeof listMirroredOpenDiningSessions>>
  >(null);
  const [localSessionDetail, setLocalSessionDetail] = useState<
    Awaited<ReturnType<typeof getMirroredDiningSession>>
  >(null);

  const remoteTables = useAuthedQuery(api.dining.listTables, online && canFloor ? {} : "skip");
  const remoteSessions = useAuthedQuery(
    api.dining.listOpenSessions,
    online && canFloor ? {} : "skip",
  );
  const remoteSession = useAuthedQuery(
    api.dining.getSession,
    online && canFloor && selectedSessionId && !selectedSessionId.startsWith("local_")
      ? { sessionId: selectedSessionId as Id<"diningSessions"> }
      : "skip",
  );
  const { products: productRows } = useProductsList({
    search: "",
    includeInactive: false,
    canViewCost: false,
    branchId: branchId ?? undefined,
  });
  const products = { items: productRows };
  const branches = useAuthedQuery(
    api.branches.list,
    online && canFloor && (isAdmin || isManager) ? {} : "skip",
  );
  const modifierGroups = useAuthedQuery(
    api.dining.listModifierGroupsForProduct,
    online && canFloor && productId ? { productId: productId as Id<"products"> } : "skip",
  );

  const upsertTable = useMutation(api.dining.upsertTable);
  const openSession = useMutation(api.dining.openSession);
  const addItem = useMutation(api.dining.addSessionItem);
  const voidItem = useMutation(api.dining.voidSessionItem);
  const fireTicket = useMutation(api.dining.fireKitchenTicket);
  const paySession = useMutation(api.dining.paySession);

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void Promise.all([
        listMirroredDiningTables(isAdmin ? undefined : (branchId ?? undefined)),
        listMirroredOpenDiningSessions(isAdmin ? undefined : (branchId ?? undefined)),
      ]).then(([tablesRows, sessionRows]) => {
        if (cancelled) return;
        setLocalTables(tablesRows);
        setLocalSessions(sessionRows);
      });
    };
    load();
    return subscribeReplicaChanged(load);
  }, [branchId, isAdmin, remoteTables, remoteSessions]);

  useEffect(() => {
    if (!selectedSessionId) {
      setLocalSessionDetail(null);
      return;
    }
    let cancelled = false;
    const load = () => {
      void getMirroredDiningSession(selectedSessionId).then((detail) => {
        if (!cancelled) setLocalSessionDetail(detail);
      });
    };
    load();
    return subscribeReplicaChanged(load);
  }, [selectedSessionId, remoteSession]);

  const tables = pickLiveListWhenOnline({
    local: localTables ?? undefined,
    remote: remoteTables?.map((t) => ({
      id: String(t._id),
      branchId: String(t.branchId),
      name: t.name,
      code: t.code ?? null,
      seats: t.seats ?? null,
      status: t.status,
      sortOrder: t.sortOrder ?? null,
    })),
    online,
  });

  const sessions = pickLiveListWhenOnline({
    local: localSessions?.map((s) => ({
      _id: s.id,
      tableId: s.tableId,
      branchId: s.branchId,
      status: s.status,
      openedAt: s.openedAt,
    })),
    remote: remoteSessions?.map((s) => ({
      _id: String(s._id),
      tableId: String(s.tableId),
      branchId: String(s.branchId),
      status: s.status,
      openedAt: s.openedAt,
    })),
    online,
  });

  const session = useMemo(() => {
    if (online && remoteSession && selectedSessionId && !selectedSessionId.startsWith("local_")) {
      return remoteSession;
    }
    if (!localSessionDetail) return undefined;
    return {
      tableName: localSessionDetail.tableName,
      items: localSessionDetail.items.map((i) => ({
        _id: i.id,
        productName: i.productName,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
        kitchenStatus: i.kitchenStatus,
      })),
    };
  }, [online, remoteSession, localSessionDetail, selectedSessionId]);

  const sessionByTable = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions ?? []) {
      map.set(String(s.tableId), String(s._id));
    }
    return map;
  }, [sessions]);

  if (!canFloor) {
    return (
      <EmptyState
        title={`${floorCopy.title} not enabled`}
        description="Turn on Tables & open checks in Settings → Selling options, or apply the Restaurant / Bar pack."
      />
    );
  }

  if (tables === undefined || tables === null || sessions === undefined || sessions === null) {
    return <LoadingState label={`Loading ${floorCopy.title.toLowerCase()}…`} />;
  }

  const floorTables = tables;

  async function onCreateTable() {
    if (!online) {
      toast.error("Adding tables requires a connection");
      return;
    }
    if (!newTableName.trim()) return;
    const resolvedBranch =
      createBranchId ?? branchId ?? branches?.find((b) => b.status === "active")?.id ?? undefined;
    try {
      await upsertTable({
        branchId: resolvedBranch ? (resolvedBranch as Id<"branches">) : undefined,
        name: newTableName.trim(),
      });
      setNewTableName("");
      toast.success("Table added");
    } catch (error) {
      showError(error, "Could not add table");
    }
  }

  async function onOpenOrSelect(tableId: string, tableName: string) {
    const existing = sessionByTable.get(String(tableId));
    if (existing) {
      setSelectedSessionId(existing);
      return;
    }
    try {
      if (!online) {
        if (!branchId || !userId) {
          toast.error("Missing branch or user for offline check");
          return;
        }
        const result = await offlineOpenDiningSession({
          tableId,
          tableName,
          branchId,
          openedBy: userId,
          openedByName: user?.name,
        });
        setSelectedSessionId(result.sessionId);
        toast.success("Check opened — pending sync");
        return;
      }
      const result = await openSession({ tableId: tableId as Id<"diningTables"> });
      setSelectedSessionId(String(result.sessionId));
    } catch (error) {
      showError(error, "Could not open check");
    }
  }

  async function onAddItem() {
    if (!selectedSessionId || !productId) return;
    const optionIds = Object.values(selectedOptions).filter(Boolean) as Id<"modifierOptions">[];
    const product = products.items?.find((p) => String(p.id) === productId);
    try {
      if (!online) {
        if (optionIds.length > 0) {
          toast.error("Modifiers require a connection offline");
          return;
        }
        if (!product) {
          toast.error("Product not in local catalogue");
          return;
        }
        await offlineAddDiningSessionItem({
          sessionId: selectedSessionId,
          productId,
          productName: product.name,
          quantity: Number(qty) || 1,
          unitPrice: product.sellingPrice,
        });
        setSelectedOptions({});
        toast.success("Added — pending sync");
        return;
      }
      await addItem({
        sessionId: selectedSessionId as Id<"diningSessions">,
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
      if (!online) {
        const tableName =
          session?.tableName ||
          floorTables.find((t) => sessionByTable.get(t.id) === selectedSessionId)?.name ||
          "Table";
        await offlineFireKitchenTicket({
          sessionId: selectedSessionId,
          tableName,
          branchId: branchId ?? floorTables[0]?.branchId ?? "",
        });
        toast.success("Sent to kitchen — pending sync");
        return;
      }
      await fireTicket({ sessionId: selectedSessionId as Id<"diningSessions"> });
      toast.success("Sent to kitchen");
    } catch (error) {
      showError(error, "Could not fire ticket");
    }
  }

  async function onPay(method: "cash" | "card" | "mobile_money") {
    if (!selectedSessionId) return;
    setPaying(true);
    try {
      if (!online) {
        await offlinePayDiningSession({
          sessionId: selectedSessionId,
          paymentMethod: method,
        });
        toast.success("Payment queued — pending sync");
        setSelectedSessionId(null);
        return;
      }
      const result = await paySession({
        sessionId: selectedSessionId as Id<"diningSessions">,
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
        title={floorCopy.title}
        description={
          online
            ? floorCopy.description
            : `${floorCopy.description} Showing cached open checks — sync when back online.`
        }
      />

      {isAdmin || isManager ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add table</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            {isAdmin && (branches?.length ?? 0) > 1 ? (
              <div className="min-w-[160px] flex-1 space-y-1">
                <Label>Branch</Label>
                <SearchableSelect
                  value={createBranchId ?? branchId ?? undefined}
                  onValueChange={setCreateBranchId}
                  options={(branches ?? [])
                    .filter((b) => b.status === "active")
                    .map((b) => ({
                      value: b.id,
                      label: b.name,
                    }))}
                  placeholder="Choose branch"
                  searchPlaceholder="Search branches"
                />
              </div>
            ) : null}
            <div className="min-w-[160px] flex-1 space-y-1">
              <Label>Name</Label>
              <Input
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                placeholder="Table 1"
              />
            </div>
            <Button type="button" onClick={() => void onCreateTable()} disabled={!online}>
              Add
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Grid className="gap-4 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {floorTables.length === 0 ? (
            <EmptyState title="No tables yet" description="Add a table to open a check." />
          ) : (
            floorTables.map((table) => {
              const openId = sessionByTable.get(table.id);
              return (
                <button
                  key={table.id}
                  type="button"
                  className={cn(
                    "border-border rounded-xl border p-4 text-left transition",
                    openId ? "border-primary/50 bg-primary/10" : "bg-card hover:border-primary/40",
                    selectedSessionId === openId && "ring-primary ring-2",
                  )}
                  onClick={() => void onOpenOrSelect(table.id, table.name)}
                >
                  <p className="font-semibold">{table.name}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {openId ? "Open check" : "Available"}
                  </p>
                </button>
              );
            })
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {session ? `Check · ${session.tableName}` : "Check"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedSessionId ? (
              <p className="text-muted-foreground text-sm">
                Select a table to open or resume a check.
              </p>
            ) : !session ? (
              <LoadingState label="Loading check…" />
            ) : (
              <>
                <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                  {session.items.map((item) => (
                    <li key={String(item._id)} className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {item.quantity}× {item.productName}
                        </p>
                        <p className="text-muted-foreground text-xs capitalize">
                          {item.kitchenStatus}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>{formatCurrency(item.lineTotal)}</span>
                        {online ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void voidItem({ itemId: item._id as Id<"diningSessionItems"> })
                                .then(() => toast.success("Voided"))
                                .catch((e) => showError(e, "Could not void"))
                            }
                          >
                            Void
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="font-semibold">Total {formatCurrency(checkTotal)}</p>
                <div className="space-y-2">
                  <SearchableSelect
                    value={productId}
                    onValueChange={setProductId}
                    options={(products.items ?? []).map((p) => ({
                      value: String(p.id),
                      label: p.name,
                    }))}
                    placeholder="Add item…"
                    searchPlaceholder="Search products"
                  />
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      className="w-20"
                    />
                    <Button type="button" onClick={() => void onAddItem()}>
                      Add
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => void onFire()}>
                      Fire
                    </Button>
                  </div>
                  {online && modifierGroups && modifierGroups.length > 0 ? (
                    <div className="space-y-2">
                      {modifierGroups.map((group) => (
                        <div key={group._id} className="space-y-1">
                          <Label>{group.name}</Label>
                          <Select
                            value={selectedOptions[group._id] ?? ""}
                            onValueChange={(value) =>
                              setSelectedOptions((prev) => ({ ...prev, [group._id]: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choose…" />
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
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={paying} onClick={() => void onPay("cash")}>
                    Cash
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={paying}
                    onClick={() => void onPay("card")}
                  >
                    Card
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={paying}
                    onClick={() => void onPay("mobile_money")}
                  >
                    Mobile money
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </Grid>
    </div>
  );
}
