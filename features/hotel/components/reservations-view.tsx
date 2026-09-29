"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usePermissions } from "@/hooks/use-permissions";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useBusinessCapabilities } from "@/hooks/use-business-capabilities";
import { useCustomersList } from "@/hooks/use-offline-lists";
import { PageHeader } from "@/components/layout/primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { showError } from "@/lib/errors";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  listMirroredHotelReservations,
  listMirroredHotelRooms,
} from "@/lib/offline/mirror-queries";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";
import {
  offlineCreateReservation,
  offlineHotelCheckIn,
} from "@/lib/offline/hospitality-actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type ReservationRow = {
  _id: string;
  roomId?: string | null;
  customerId: string;
  customerName: string;
  roomName?: string | null;
  arrivalDate: string;
  departureDate: string;
  status: string;
};

export function ReservationsView() {
  const online = useConnectivity();
  const { hasCapability } = useBusinessCapabilities();
  const canReservations = hasCapability("reservations");
  const { branchId, userId } = usePermissions();

  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [roomId, setRoomId] = useState<string | undefined>(undefined);
  const [arrivalDate, setArrivalDate] = useState(todayIso());
  const [departureDate, setDepartureDate] = useState(plusDaysIso(1));
  const [guests, setGuests] = useState("1");
  const [localReservations, setLocalReservations] = useState<
    Awaited<ReturnType<typeof listMirroredHotelReservations>>
  >(null);
  const [localRooms, setLocalRooms] = useState<
    Awaited<ReturnType<typeof listMirroredHotelRooms>>
  >(null);

  const remoteReservations = useQuery(
    api.hotel.listReservations,
    online && canReservations ? {} : "skip",
  );
  const remoteRooms = useQuery(api.hotel.listRooms, online && canReservations ? {} : "skip");
  const { customers: customerRows } = useCustomersList({
    search: "",
    includeInactive: false,
  });
  const customers = customerRows ?? [];

  const createReservation = useMutation(api.hotel.createReservation);
  const updateStatus = useMutation(api.hotel.updateReservationStatus);
  const checkIn = useMutation(api.hotel.checkIn);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void Promise.all([
        listMirroredHotelReservations(branchId ?? undefined),
        listMirroredHotelRooms(branchId ?? undefined),
      ]).then(([reservationRows, roomRows]) => {
        if (cancelled) return;
        setLocalReservations(reservationRows);
        setLocalRooms(roomRows);
      });
    };
    load();
    return subscribeReplicaChanged(load);
  }, [branchId, remoteReservations, remoteRooms]);

  const reservations: ReservationRow[] | undefined =
    online && remoteReservations !== undefined
      ? remoteReservations.map((r) => ({
          _id: String(r._id),
          roomId: r.roomId ? String(r.roomId) : null,
          customerId: String(r.customerId),
          customerName: r.customerName,
          roomName: r.roomName,
          arrivalDate: r.arrivalDate,
          departureDate: r.departureDate,
          status: r.status,
        }))
      : localReservations === null
        ? undefined
        : localReservations.map((r) => ({
            _id: r.id,
            roomId: r.roomId,
            customerId: r.customerId,
            customerName: r.customerName,
            roomName: r.roomName,
            arrivalDate: r.arrivalDate,
            departureDate: r.departureDate,
            status: r.status,
          }));

  const rooms =
    online && remoteRooms !== undefined
      ? remoteRooms.map((r) => ({
          _id: String(r._id),
          name: r.name,
          roomType: r.roomType,
        }))
      : (localRooms ?? []).map((r) => ({
          _id: r.id,
          name: r.name,
          roomType: r.roomType,
        }));

  if (!canReservations) {
    return (
      <EmptyState
        title="Reservations not enabled"
        description="Turn on Reservations in Settings → Business type, or apply the Hotel pack."
      />
    );
  }
  if (reservations === undefined) {
    return <LoadingState label="Loading reservations…" />;
  }

  async function onCreate() {
    if (!branchId || !customerId) return;
    const customer = customers.find((c) => String(c.id) === customerId);
    const room = roomId ? rooms.find((r) => r._id === roomId) : undefined;
    try {
      if (!online) {
        if (!customer) {
          toast.error("Customer not in local cache");
          return;
        }
        await offlineCreateReservation({
          branchId,
          customerId,
          customerName: customer.name,
          roomId,
          roomName: room?.name,
          arrivalDate,
          departureDate,
          guests: Number(guests) || 1,
          status: "confirmed",
        });
        toast.success("Reservation queued — pending sync");
        setCustomerId(undefined);
        return;
      }
      await createReservation({
        branchId: branchId as Id<"branches">,
        customerId: customerId as Id<"customers">,
        roomId: roomId ? (roomId as Id<"hotelRooms">) : undefined,
        arrivalDate,
        departureDate,
        guests: Number(guests) || 1,
        status: "confirmed",
      });
      toast.success("Reservation created");
      setCustomerId(undefined);
    } catch (error) {
      showError(error, "Could not create reservation");
    }
  }

  async function onCheckIn(reservation: ReservationRow) {
    const targetRoom = reservation.roomId;
    if (!targetRoom) {
      toast.error("Assign a room before check-in");
      return;
    }
    try {
      if (!online) {
        if (!branchId || !userId) {
          toast.error("Missing branch or user for offline check-in");
          return;
        }
        await offlineHotelCheckIn({
          roomId: targetRoom,
          roomName: reservation.roomName ?? "Room",
          branchId,
          customerId: reservation.customerId,
          customerName: reservation.customerName,
          reservationId: reservation._id,
          checkedInBy: userId,
        });
        toast.success("Check-in queued — pending sync");
        return;
      }
      await checkIn({
        roomId: targetRoom as Id<"hotelRooms">,
        customerId: reservation.customerId as Id<"customers">,
        reservationId: reservation._id as Id<"hotelReservations">,
      });
      toast.success("Checked in — open folio on Rooms");
    } catch (error) {
      showError(error, "Could not check in");
    }
  }

  return (
    <div className="min-w-0 space-y-6" data-tour="page-content">
      <PageHeader
        title="Reservations"
        description={
          online
            ? "Book arrivals, confirm stays, and check guests into a room folio."
            : "Cached reservations — creates and check-ins queue for sync."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New reservation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Guest</Label>
            <SearchableSelect
              options={customers.map((c) => ({
                value: String(c.id),
                label: c.name,
                keywords: `${c.name} ${c.phone ?? ""}`,
              }))}
              value={customerId}
              onValueChange={setCustomerId}
              placeholder="Select customer"
              searchPlaceholder="Search guests…"
              emptyMessage="No customers found."
            />
          </div>
          <div className="space-y-1">
            <Label>Room (optional)</Label>
            <SearchableSelect
              options={[
                { value: "__none__", label: "Unassigned" },
                ...rooms.map((r) => ({
                  value: r._id,
                  label: r.roomType ? `${r.name} · ${r.roomType}` : r.name,
                  keywords: `${r.name} ${r.roomType ?? ""}`,
                })),
              ]}
              value={roomId ?? "__none__"}
              onValueChange={(value) => setRoomId(value === "__none__" ? undefined : value)}
              placeholder="Any / assign later"
              searchPlaceholder="Search rooms…"
              emptyMessage="No rooms found."
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="guests">Guests</Label>
            <Input
              id="guests"
              type="number"
              min={1}
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="arrival">Arrival</Label>
            <Input
              id="arrival"
              type="date"
              value={arrivalDate}
              onChange={(e) => setArrivalDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="departure">Departure</Label>
            <Input
              id="departure"
              type="date"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="button" disabled={!customerId || !branchId} onClick={() => void onCreate()}>
              Create reservation
            </Button>
          </div>
        </CardContent>
      </Card>

      {reservations.length === 0 ? (
        <EmptyState title="No upcoming reservations" description="Create one above." />
      ) : (
        <ul className="space-y-2">
          {reservations.map((row) => (
            <li
              key={row._id}
              className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium">{row.customerName}</p>
                <p className="text-muted-foreground text-sm">
                  {row.arrivalDate} → {row.departureDate}
                  {row.roomName ? ` · ${row.roomName}` : " · Room TBD"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={row.status === "confirmed" ? "default" : "outline"}>
                  {row.status.replace("_", " ")}
                </Badge>
                {row.status === "booked" || row.status === "confirmed" ? (
                  <>
                    {online ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void updateStatus({
                            reservationId: row._id as Id<"hotelReservations">,
                            status: "cancelled",
                          })
                            .then(() => toast.success("Cancelled"))
                            .catch((e) => showError(e, "Could not cancel"))
                        }
                      >
                        Cancel
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" onClick={() => void onCheckIn(row)}>
                      Check in
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
