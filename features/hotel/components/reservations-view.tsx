"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usePermissions } from "@/hooks/use-permissions";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useBusinessCapabilities } from "@/hooks/use-business-capabilities";
import { PageHeader } from "@/components/layout/primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { OfflineUnavailable } from "@/components/offline/offline-unavailable";
import { showError } from "@/lib/errors";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ReservationsView() {
  const online = useConnectivity();
  const { hasCapability } = useBusinessCapabilities();
  const canReservations = hasCapability("reservations");
  const { branchId } = usePermissions();

  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [roomId, setRoomId] = useState<string | undefined>(undefined);
  const [arrivalDate, setArrivalDate] = useState(todayIso());
  const [departureDate, setDepartureDate] = useState(plusDaysIso(1));
  const [guests, setGuests] = useState("1");

  const reservations = useQuery(
    api.hotel.listReservations,
    online && canReservations ? {} : "skip",
  );
  const rooms = useQuery(api.hotel.listRooms, online && canReservations ? {} : "skip");
  const customers = useQuery(api.customers.list, online && canReservations ? {} : "skip");

  const createReservation = useMutation(api.hotel.createReservation);
  const updateStatus = useMutation(api.hotel.updateReservationStatus);
  const checkIn = useMutation(api.hotel.checkIn);

  if (!online) {
    return <OfflineUnavailable title="Reservations need a connection" />;
  }
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
    try {
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

  async function onCheckIn(reservation: NonNullable<typeof reservations>[number]) {
    const targetRoom = reservation.roomId;
    if (!targetRoom) {
      toast.error("Assign a room before check-in");
      return;
    }
    try {
      await checkIn({
        roomId: targetRoom,
        customerId: reservation.customerId,
        reservationId: reservation._id,
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
        description="Book arrivals, confirm stays, and check guests into a room folio."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New reservation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Guest</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {(customers ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Room (optional)</Label>
            <Select
              value={roomId}
              onValueChange={(value) => setRoomId(value === "__none__" ? undefined : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any / assign later" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {(rooms ?? []).map((r) => (
                  <SelectItem key={r._id} value={r._id}>
                    {r.name}
                    {r.roomType ? ` · ${r.roomType}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void updateStatus({ reservationId: row._id, status: "cancelled" })
                          .then(() => toast.success("Cancelled"))
                          .catch((e) => showError(e, "Could not cancel"))
                      }
                    >
                      Cancel
                    </Button>
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
