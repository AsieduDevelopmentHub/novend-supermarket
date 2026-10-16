"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { usePermissions } from "@/hooks/use-permissions";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useSuppliersList } from "@/hooks/use-offline-lists";
import { getOfflineDb } from "@/lib/offline/db";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";
import { purchaseBalance } from "@/convex/shared/supplierFinance";
import {
  persistBusinessWrite,
  queuedSaveMessage,
  queueUpsertSupplier,
} from "@/lib/offline/replica-writes";
import { formatCurrency } from "@/lib/currency";
import { SINGLE_STORE } from "@/constants/app";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { Pencil, Plus, Truck } from "lucide-react";

export function SuppliersView() {
  const { canManageProducts } = usePermissions();
  const online = useConnectivity();
  const [search, setSearch] = useState("");
  const { suppliers, loading } = useSuppliersList({ search, includeInactive: true });
  const createSupplier = useMutation(api.suppliers.create);
  const updateSupplier = useMutation(api.suppliers.update);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"suppliers"> | null>(null);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [pending, setPending] = useState(false);
  const balances = useAuthedQuery(api.suppliers.balances, online ? {} : "skip");
  const [localOwed, setLocalOwed] = useState<Record<string, number>>({});
  useEffect(() => {
    let cancelled = false;
    async function loadOwed() {
      const db = await getOfflineDb();
      if (!db || cancelled) return;
      const purchases = await db.wholesalePurchases.toArray();
      const owed: Record<string, number> = {};
      for (const row of purchases) {
        if (row.status === "void") continue;
        owed[row.supplierId] = (owed[row.supplierId] ?? 0) + purchaseBalance(row);
      }
      if (!cancelled) setLocalOwed(owed);
    }
    void loadOwed();
    const unsubscribe = subscribeReplicaChanged(() => {
      void loadOwed();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);
  const owedById = new Map((balances ?? []).map((row) => [String(row.supplierId), row.owed]));

  if (!canManageProducts) {
    return (
      <EmptyState
        title="Access required"
        description="Supplier records are for managers and administrators."
      />
    );
  }

  function reset() {
    setEditingId(null);
    setName("");
    setContactName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setNotes("");
    setStatus("active");
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const fields = {
        name,
        contactName: contactName || undefined,
        phone: phone || undefined,
        email: email || undefined,
        address: address || undefined,
        notes: notes || undefined,
        status,
      };
      const kind = await persistBusinessWrite({
        online,
        remote: async () => {
          if (editingId) {
            await updateSupplier({ id: editingId, ...fields });
          } else {
            await createSupplier({
              name: fields.name,
              contactName: fields.contactName,
              phone: fields.phone,
              email: fields.email,
              address: fields.address,
              notes: fields.notes,
            });
          }
        },
        local: () =>
          queueUpsertSupplier({
            serverId: editingId ? String(editingId) : undefined,
            ...fields,
          }),
      });
      toast.success(queuedSaveMessage(kind, editingId ? "Supplier updated" : "Supplier added"));
      setOpen(false);
      reset();
    } catch (error) {
      showError(error, "Could not save supplier");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Vendors you buy from — contacts for restocking. Add stock in Inventory with reason “Supplier restock”."
        compactActions={[
          {
            key: "add",
            label: "Add supplier",
            icon: Plus,
            onClick: () => {
              reset();
              setOpen(true);
            },
          },
        ]}
        actions={
          <Button
            type="button"
            onClick={() => {
              reset();
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add supplier
          </Button>
        }
      />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search suppliers…"
        className="max-w-md"
      />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <div className="p-6">
              <LoadingState label="Loading suppliers…" />
            </div>
          ) : suppliers.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Truck}
                title="No suppliers yet"
                description="Add suppliers you buy from. Restock shelf stock from Inventory → Adjust."
              />
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Supplier</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  {!SINGLE_STORE ? (
                    <th className="px-4 py-3 font-medium">Owed</th>
                  ) : null}
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {suppliers.map((row) => (
                  <ClickableTableRow key={row.id} href={`/suppliers/${row.id}`}>
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3">{row.contactName ?? "—"}</td>
                    <td className="px-4 py-3">{row.phone ?? "—"}</td>
                    {!SINGLE_STORE ? (
                      <td className="px-4 py-3">
                        {formatCurrency(localOwed[row.id] ?? owedById.get(row.id) ?? 0)}
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <Badge variant={row.status === "active" ? "success" : "secondary"}>
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Edit ${row.name}`}
                        onClick={() => {
                          setEditingId(row.id as Id<"suppliers">);
                          setName(row.name);
                          setContactName(row.contactName ?? "");
                          setPhone(row.phone ?? "");
                          setEmail(row.email ?? "");
                          setAddress(row.address ?? "");
                          setNotes(row.notes ?? "");
                          setStatus(row.status);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </ClickableTableRow>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={(e) => void onSave(e)}>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit supplier" : "Add supplier"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="space-y-2">
                <Label>Company / name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Contact person</Label>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
