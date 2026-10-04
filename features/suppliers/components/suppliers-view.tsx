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
import { getMirroredSupplier } from "@/lib/offline/mirror-queries";
import {
  persistBusinessWrite,
  queuedSaveMessage,
  queueUpsertSupplier,
} from "@/lib/offline/replica-writes";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
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
  const [selectedId, setSelectedId] = useState<Id<"suppliers"> | string | null>(null);
  const remoteDetail = useAuthedQuery(
    api.suppliers.get,
    online && selectedId && !String(selectedId).startsWith("local_")
      ? { id: selectedId as Id<"suppliers"> }
      : "skip",
  );
  const [localDetail, setLocalDetail] =
    useState<Awaited<ReturnType<typeof getMirroredSupplier>>>(null);
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void getMirroredSupplier(String(selectedId)).then((row) => {
      if (!cancelled) setLocalDetail(row);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);
  const detail = selectedId ? (remoteDetail ?? localDetail) : null;

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
        description="Companies you buy wholesale stock from."
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
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <Card>
          <CardContent className="overflow-x-auto p-0">
            {loading ? (
              <div className="p-6">
                <LoadingState label="Loading suppliers…" />
              </div>
            ) : suppliers.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={Truck} title="No suppliers yet" />
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Supplier</th>
                    <th className="px-4 py-3 font-medium">Contact</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((row) => (
                    <tr
                      key={row.id}
                      className="border-border hover:bg-muted/40 cursor-pointer border-t"
                      onClick={() => setSelectedId(row.id as Id<"suppliers">)}
                    >
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td className="px-4 py-3">{row.contactName ?? "—"}</td>
                      <td className="px-4 py-3">{row.phone ?? "—"}</td>
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
                          onClick={(event) => {
                            event.stopPropagation();
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
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 font-semibold">Purchase history</h2>
            {!detail ? (
              <p className="text-muted-foreground text-sm">Select a supplier to see purchases.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <p>
                  {detail.purchaseCount} purchases · {formatCurrency(detail.purchaseTotal)}
                </p>
                {detail.purchases.length === 0 ? (
                  <p className="text-muted-foreground">No purchases recorded.</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.purchases.map((row) => (
                      <li key={row.id} className="flex justify-between gap-2">
                        <span>
                          {row.reference}
                          {row.invoiceNumber ? ` · ${row.invoiceNumber}` : ""}
                        </span>
                        <span className="text-muted-foreground">
                          {formatCurrency(row.totalCost)} · {formatDateTime(row.purchasedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
