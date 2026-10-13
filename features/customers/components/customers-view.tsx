"use client";

import { FormEvent, useState } from "react";
import { useMutation } from "convex/react";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { usePermissions } from "@/hooks/use-permissions";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useCustomerGroups, useCustomersList } from "@/hooks/use-offline-lists";
import { useBusinessCapabilities } from "@/hooks/use-business-capabilities";
import { PriceListsPanel } from "./price-lists-panel";
import { ListPagination } from "@/components/ui/list-pagination";
import { useClientPagedRows } from "@/hooks/use-ui";
import { Eye, Pencil, Plus, Users } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import {
  persistBusinessWrite,
  queuedSaveMessage,
  queueUpsertCustomer,
} from "@/lib/offline/replica-writes";

const NO_GROUP = "none";

export function CustomersView() {
  const { isAdmin, isManager } = usePermissions();
  const { hasCapability } = useBusinessCapabilities();
  const canSetTerms = isAdmin || isManager;
  const creditOn = hasCapability("customer_credit");
  const pricingOn = hasCapability("customer_pricing");
  const groups = useCustomerGroups(canSetTerms && pricingOn);
  const online = useConnectivity();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"customers"> | null>(null);
  const [detailId, setDetailId] = useState<Id<"customers"> | null>(null);

  const { customers } = useCustomersList({
    search,
    includeInactive: isAdmin,
  });
  const {
    paged: pageRows,
    page,
    setPage,
    pageSize,
    setPageSize,
    total,
  } = useClientPagedRows(customers, `${search}|${isAdmin}`);
  const history = useAuthedQuery(
    api.customers.purchaseHistory,
    online && detailId ? { customerId: detailId, limit: 20 } : "skip",
  );
  const detail = useAuthedQuery(api.customers.get, online && detailId ? { id: detailId } : "skip");

  const createCustomer = useMutation(api.customers.create);
  const updateCustomer = useMutation(api.customers.update);
  const archiveCustomer = useMutation(api.customers.archive);

  const [name, setName] = useState("");
  const [deactivateTarget, setDeactivateTarget] = useState<{
    id: Id<"customers">;
    name: string;
  } | null>(null);
  const [deactivatePending, setDeactivatePending] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [creditLimit, setCreditLimit] = useState("");
  const [groupId, setGroupId] = useState<string>(NO_GROUP);
  const [pending, setPending] = useState(false);

  function openCreate() {
    setEditingId(null);
    setName("");
    setPhone("");
    setEmail("");
    setNotes("");
    setStatus("active");
    setCreditLimit("");
    setGroupId(NO_GROUP);
    setFormOpen(true);
  }

  function openEdit(row: {
    id: Id<"customers">;
    name: string;
    phone: string | null;
    email: string | null;
    notes: string | null;
    status: "active" | "inactive";
    creditLimit?: number | null;
    customerGroupId?: string | null;
  }) {
    setEditingId(row.id);
    setName(row.name);
    setPhone(row.phone ?? "");
    setEmail(row.email ?? "");
    setNotes(row.notes ?? "");
    setStatus(row.status);
    setCreditLimit(row.creditLimit == null ? "" : String(row.creditLimit));
    setGroupId(row.customerGroupId ?? NO_GROUP);
    setFormOpen(true);
  }

  /** Terms are manager-only; cashiers never send them so an edit cannot clear them. */
  function customerTerms(): { creditLimit?: number | null; customerGroupId?: string | null } {
    if (!canSetTerms) return {};
    const terms: { creditLimit?: number | null; customerGroupId?: string | null } = {};
    if (creditOn) {
      const parsed = creditLimit.trim() === "" ? null : Number(creditLimit);
      if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
        throw new Error("Enter a credit limit of zero or more, or leave it blank for no limit");
      }
      terms.creditLimit = parsed;
    }
    if (pricingOn) terms.customerGroupId = groupId === NO_GROUP ? null : groupId;
    return terms;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const terms = customerTerms();
      const remoteTerms = {
        ...(terms.creditLimit !== undefined ? { creditLimit: terms.creditLimit } : {}),
        ...(terms.customerGroupId !== undefined
          ? { customerGroupId: terms.customerGroupId as Id<"customerGroups"> | null }
          : {}),
      };
      const kind = await persistBusinessWrite({
        online,
        remote: async () => {
          if (editingId) {
            await updateCustomer({
              id: editingId,
              name,
              phone: phone || undefined,
              email: email || undefined,
              notes: notes || undefined,
              status,
              ...remoteTerms,
            });
          } else {
            await createCustomer({
              name,
              phone: phone || undefined,
              email: email || undefined,
              notes: notes || undefined,
              ...remoteTerms,
            });
          }
        },
        local: () =>
          queueUpsertCustomer({
            serverId: editingId ? String(editingId) : undefined,
            name,
            phone: phone || undefined,
            email: email || undefined,
            notes: notes || undefined,
            status,
            ...terms,
          }),
      });
      toast.success(queuedSaveMessage(kind, editingId ? "Customer updated" : "Customer created"));
      setFormOpen(false);
    } catch (error) {
      showError(error, "Save failed");
    } finally {
      setPending(false);
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    setDeactivatePending(true);
    try {
      await archiveCustomer({ id: deactivateTarget.id });
      toast.success("Customer deactivated");
      setDeactivateTarget(null);
    } catch (error) {
      showError(error, "Deactivate failed");
    } finally {
      setDeactivatePending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Optional profiles for repeat buyers. Walk-in sales never require registration."
        compactActions={[{ key: "add", label: "Add Customer", icon: Plus, onClick: openCreate }]}
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        }
      />

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search customers…"
        className="max-w-md"
      />

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {customers === undefined ? (
            <div className="p-6">
              <LoadingState label="Loading customers…" />
            </div>
          ) : customers.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Users}
                title="No customers yet"
                description="Add wholesale or repeat customers. Cashier checkout stays Walk-in by default."
                action={
                  <Button type="button" onClick={openCreate}>
                    Add Customer
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Phone</th>
                      <th className="px-4 py-3 font-medium">Purchases</th>
                      <th className="px-4 py-3 font-medium">Last purchase</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pageRows ?? []).map((row) => (
                      <ClickableTableRow key={row.id} href={`/customers/${row.id}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium">{row.name}</p>
                          {row.email ? (
                            <p className="text-muted-foreground text-xs">{row.email}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">{row.phone ?? "—"}</td>
                        <td className="px-4 py-3">{row.purchaseCount}</td>
                        <td className="px-4 py-3">
                          {row.lastPurchaseAt ? (
                            <div>
                              <p>{formatCurrency(row.lastPurchaseTotal ?? 0)}</p>
                              <p className="text-muted-foreground text-xs">
                                {formatDateTime(row.lastPurchaseAt)}
                              </p>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={row.status === "active" ? "success" : "secondary"}>
                            {row.status === "active" ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button
                              asChild
                              size="icon"
                              variant="ghost"
                              aria-label="View customer details"
                            >
                              <Link href={`/customers/${row.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              aria-label="Edit customer"
                              onClick={() => openEdit(row)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {isAdmin && row.status === "active" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setDeactivateTarget({ id: row.id, name: row.name })}
                              >
                                Deactivate
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </ClickableTableRow>
                    ))}
                  </tbody>
                </table>
              </div>
              {total > 0 ? (
                <ListPagination
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              ) : null}
              <div className="space-y-3 p-3 md:hidden">
                {(pageRows ?? []).map((row) => (
                  <div key={row.id} className="border-border space-y-2 rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/customers/${row.id}`} className="font-medium hover:underline">
                        {row.name}
                      </Link>
                      <Badge variant={row.status === "active" ? "success" : "secondary"}>
                        {row.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">{row.phone ?? "No phone"}</p>
                    <p className="text-sm">{row.purchaseCount} purchases</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/customers/${row.id}`}>
                          <Eye className="h-4 w-4" />
                          View
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(row)}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {canSetTerms && pricingOn ? <PriceListsPanel /> : null}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit customer" : "Add customer"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="customer-name">Name</Label>
              <Input
                id="customer-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-phone">Phone</Label>
              <Input id="customer-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-email">Email</Label>
              <Input
                id="customer-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-notes">Notes</Label>
              <Textarea
                id="customer-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            {canSetTerms && creditOn ? (
              <div className="space-y-2">
                <Label htmlFor="customer-credit-limit">Credit limit (GHS)</Label>
                <Input
                  id="customer-credit-limit"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={creditLimit}
                  placeholder="No limit"
                  onChange={(e) => setCreditLimit(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  The most this customer can owe on account. Leave blank for no limit.
                </p>
              </div>
            ) : null}
            {canSetTerms && pricingOn ? (
              <div className="space-y-2">
                <Label>Price list group</Label>
                <Select value={groupId} onValueChange={setGroupId}>
                  <SelectTrigger aria-label="Price list group">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_GROUP}>Standard prices</SelectItem>
                    {(groups ?? [])
                      .filter((group) => group.status === "active")
                      .map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {editingId && isAdmin ? (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as "active" | "inactive")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{detail?.name ?? "Customer"}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            {detail ? (
              <Card>
                <CardContent className="space-y-1 p-4 text-sm">
                  <p>
                    <span className="text-muted-foreground">Phone: </span>
                    {detail.phone ?? "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Email: </span>
                    {detail.email ?? "—"}
                  </p>
                  {detail.notes ? (
                    <p>
                      <span className="text-muted-foreground">Notes: </span>
                      {detail.notes}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ) : (
              <LoadingState label="Loading…" />
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent purchases</CardTitle>
              </CardHeader>
              <CardContent>
                {history === undefined ? (
                  <LoadingState label="Loading history…" />
                ) : history.length === 0 ? (
                  <EmptyState title="No purchases yet" />
                ) : (
                  <ul className="space-y-3 text-sm">
                    {history.map((sale) => (
                      <li
                        key={sale.id}
                        className="border-border flex items-center justify-between rounded-lg border px-3 py-2"
                      >
                        <div>
                          <p className="font-medium">{sale.invoiceNumber}</p>
                          <p className="text-muted-foreground text-xs">
                            {formatDateTime(sale.completedAt)} · {sale.itemCount} items
                          </p>
                        </div>
                        <p className="font-semibold">{formatCurrency(sale.total)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="Deactivate customer?"
        description={
          deactivateTarget
            ? `“${deactivateTarget.name}” will be marked inactive and hidden from everyday sales search.`
            : ""
        }
        confirmLabel="Deactivate"
        pending={deactivatePending}
        onConfirm={confirmDeactivate}
      />
    </div>
  );
}
