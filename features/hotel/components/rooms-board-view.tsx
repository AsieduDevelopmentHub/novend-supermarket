"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usePermissions } from "@/hooks/use-permissions";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useBusinessCapabilities } from "@/hooks/use-business-capabilities";
import { useCustomersList, useProductsList } from "@/hooks/use-offline-lists";
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

type RoomStatus = "available" | "occupied" | "dirty" | "maintenance" | "inactive";

function roomTone(status: RoomStatus) {
  switch (status) {
    case "occupied":
      return "border-primary/50 bg-primary/10";
    case "dirty":
      return "border-border bg-muted/60";
    case "maintenance":
      return "border-border bg-muted opacity-80";
    default:
      return "border-border bg-card hover:border-primary/40";
  }
}

export function RoomsBoardView() {
  const online = useConnectivity();
  const { hasCapability } = useBusinessCapabilities();
  const canRooms = hasCapability("rooms_folio");
  const { branchId, isAdmin, isManager } = usePermissions();
  const [selectedStayId, setSelectedStayId] = useState<Id<"hotelStays"> | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<Id<"hotelRooms"> | null>(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomType, setNewRoomType] = useState("");
  const [newRoomProductId, setNewRoomProductId] = useState<string | undefined>(undefined);
  const [checkInCustomerId, setCheckInCustomerId] = useState<string | undefined>(undefined);
  const [chargeProductId, setChargeProductId] = useState<string | undefined>(undefined);
  const [chargeQty, setChargeQty] = useState("1");
  const [paying, setPaying] = useState(false);

  const rooms = useQuery(api.hotel.listRooms, online && canRooms ? {} : "skip");
  const openStays = useQuery(api.hotel.listOpenStays, online && canRooms ? {} : "skip");
  const stay = useQuery(
    api.hotel.getStay,
    online && canRooms && selectedStayId ? { stayId: selectedStayId } : "skip",
  );
  // Dexie-first — avoid live customers.list / listProducts org `.collect()`.
  const { customers: customerRows } = useCustomersList({
    search: "",
    includeInactive: false,
  });
  const customers = customerRows ?? [];
  const { products: productRows } = useProductsList({
    search: "",
    includeInactive: false,
    canViewCost: false,
    branchId: branchId ?? undefined,
  });
  const products = { items: productRows };

  const upsertRoom = useMutation(api.hotel.upsertRoom);
  const setRoomStatus = useMutation(api.hotel.setRoomStatus);
  const checkIn = useMutation(api.hotel.checkIn);
  const addCharge = useMutation(api.hotel.addFolioCharge);
  const voidCharge = useMutation(api.hotel.voidFolioCharge);
  const postNight = useMutation(api.hotel.postRoomNight);
  const checkoutPay = useMutation(api.hotel.checkoutPay);

  if (!online) {
    return <OfflineUnavailable title="Rooms need a connection" />;
  }
  if (!canRooms) {
    return (
      <EmptyState
        title="Rooms not enabled"
        description="Turn on Rooms & folio in Settings → Business type, or apply the Hotel pack."
      />
    );
  }
  if (rooms === undefined || openStays === undefined) {
    return <LoadingState label="Loading rooms…" />;
  }

  const stayByRoom = new Map(openStays.map((s) => [String(s.roomId), s]));

  async function onAddRoom() {
    if (!branchId || !newRoomName.trim()) return;
    try {
      await upsertRoom({
        branchId: branchId as Id<"branches">,
        name: newRoomName.trim(),
        roomType: newRoomType.trim() || undefined,
        defaultProductId: newRoomProductId
          ? (newRoomProductId as Id<"products">)
          : undefined,
      });
      setNewRoomName("");
      setNewRoomType("");
      setNewRoomProductId(undefined);
      toast.success("Room added");
    } catch (error) {
      showError(error, "Could not add room");
    }
  }

  async function onSelectRoom(roomId: Id<"hotelRooms">) {
    setSelectedRoomId(roomId);
    const open = stayByRoom.get(String(roomId));
    setSelectedStayId(open?._id ?? null);
  }

  async function onCheckIn() {
    if (!selectedRoomId || !checkInCustomerId) return;
    try {
      const result = await checkIn({
        roomId: selectedRoomId,
        customerId: checkInCustomerId as Id<"customers">,
      });
      setSelectedStayId(result.stayId);
      setCheckInCustomerId(undefined);
      toast.success("Checked in");
    } catch (error) {
      showError(error, "Could not check in");
    }
  }

  async function onAddCharge() {
    if (!selectedStayId || !chargeProductId) return;
    try {
      await addCharge({
        stayId: selectedStayId,
        kind: "product",
        productId: chargeProductId as Id<"products">,
        quantity: Number(chargeQty) || 1,
      });
      toast.success("Charge added");
    } catch (error) {
      showError(error, "Could not add charge");
    }
  }

  async function onCheckout(method: "cash" | "card" | "mobile_money") {
    if (!selectedStayId) return;
    setPaying(true);
    try {
      const result = await checkoutPay({ stayId: selectedStayId, paymentMethod: method });
      toast.success(`Checked out — ${result.invoiceNumber}`);
      setSelectedStayId(null);
      setSelectedRoomId(null);
    } catch (error) {
      showError(error, "Could not checkout");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="min-w-0 space-y-6" data-tour="page-content">
      <PageHeader
        title="Rooms"
        description="Board status, check guests in, post folio charges, then checkout to a sale."
      />

      {(isAdmin || isManager) && branchId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add room</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <div className="min-w-[140px] flex-1 space-y-1">
              <Label htmlFor="room-name">Name / number</Label>
              <Input
                id="room-name"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="101"
              />
            </div>
            <div className="min-w-[140px] flex-1 space-y-1">
              <Label htmlFor="room-type">Type</Label>
              <Input
                id="room-type"
                value={newRoomType}
                onChange={(e) => setNewRoomType(e.target.value)}
                placeholder="Standard"
              />
            </div>
            <div className="min-w-[160px] flex-1 space-y-1">
              <Label>Nightly rate product</Label>
              <Select value={newRoomProductId} onValueChange={setNewRoomProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
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
            <Button type="button" onClick={() => void onAddRoom()} disabled={!newRoomName.trim()}>
              Add
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {rooms.length === 0 ? (
        <EmptyState title="No rooms yet" description="Add a room to start the board." />
      ) : (
        <Grid cols={rooms.length > 4 ? 4 : 3}>
          {rooms.map((room) => {
            const open = stayByRoom.get(String(room._id));
            const selected = selectedRoomId === room._id;
            return (
              <button
                key={room._id}
                type="button"
                onClick={() => void onSelectRoom(room._id)}
                className={cn(
                  "rounded-xl border p-4 text-left transition",
                  roomTone(room.status),
                  selected ? "ring-primary ring-2" : null,
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{room.name}</p>
                  <Badge variant={room.status === "occupied" ? "default" : "outline"}>
                    {room.status}
                  </Badge>
                </div>
                {room.roomType ? (
                  <p className="text-muted-foreground mt-1 text-xs">{room.roomType}</p>
                ) : null}
                {open ? (
                  <p className="text-muted-foreground mt-2 truncate text-xs">{open.customerName}</p>
                ) : null}
              </button>
            );
          })}
        </Grid>
      )}

      {selectedRoomId ? (
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          {!selectedStayId ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Check in</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label>Guest (customer)</Label>
                  <Select value={checkInCustomerId} onValueChange={setCheckInCustomerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select guest" />
                    </SelectTrigger>
                    <SelectContent>
                      {(customers ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                          {c.phone ? ` · ${c.phone}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  className="w-full"
                  disabled={!checkInCustomerId}
                  onClick={() => void onCheckIn()}
                >
                  Check in walk-in
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void setRoomStatus({ roomId: selectedRoomId, status: "available" })
                        .then(() => toast.success("Marked available"))
                        .catch((e) => showError(e, "Could not update room"))
                    }
                  >
                    Available
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void setRoomStatus({ roomId: selectedRoomId, status: "dirty" })
                        .then(() => toast.success("Marked dirty"))
                        .catch((e) => showError(e, "Could not update room"))
                    }
                  >
                    Dirty
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void setRoomStatus({ roomId: selectedRoomId, status: "maintenance" })
                        .then(() => toast.success("Marked maintenance"))
                        .catch((e) => showError(e, "Could not update room"))
                    }
                  >
                    Maintenance
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : stay ? (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div>
                    <CardTitle>{stay.roomName}</CardTitle>
                    <p className="text-muted-foreground text-sm">{stay.customerName}</p>
                  </div>
                  <Badge variant="secondary">{formatCurrency(stay.folioTotal)}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  {stay.charges.filter((c) => c.status === "open").length === 0 ? (
                    <EmptyState
                      title="Empty folio"
                      description="Post a room night or add a product charge."
                    />
                  ) : (
                    <ul className="space-y-2">
                      {stay.charges
                        .filter((c) => c.status === "open")
                        .map((charge) => (
                          <li
                            key={charge._id}
                            className="border-border flex items-start justify-between gap-2 rounded-lg border px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {charge.quantity}× {charge.description}
                              </p>
                              <Badge variant="outline" className="mt-1 text-[10px]">
                                {charge.kind}
                              </Badge>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className="text-sm tabular-nums">
                                {formatCurrency(charge.lineTotal)}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  void voidCharge({ chargeId: charge._id }).catch((e) =>
                                    showError(e, "Could not void charge"),
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
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        void postNight({ stayId: stay._id })
                          .then(() => toast.success("Room night posted"))
                          .catch((e) => showError(e, "Could not post night"))
                      }
                    >
                      Post night
                    </Button>
                    <Button
                      type="button"
                      disabled={paying || stay.folioTotal <= 0}
                      onClick={() => void onCheckout("cash")}
                    >
                      Pay cash
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={paying || stay.folioTotal <= 0}
                      onClick={() => void onCheckout("mobile_money")}
                    >
                      Pay MoMo
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add charge</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label>Product</Label>
                    <Select value={chargeProductId} onValueChange={setChargeProductId}>
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
                    <Label htmlFor="charge-qty">Quantity</Label>
                    <Input
                      id="charge-qty"
                      type="number"
                      min={1}
                      value={chargeQty}
                      onChange={(e) => setChargeQty(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    className="w-full"
                    disabled={!chargeProductId}
                    onClick={() => void onAddCharge()}
                  >
                    Add to folio
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : (
            <LoadingState label="Loading folio…" />
          )}
        </div>
      ) : null}
    </div>
  );
}
