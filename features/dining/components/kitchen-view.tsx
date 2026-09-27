"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useConnectivity } from "@/hooks/use-connectivity";
import { PageHeader } from "@/components/layout/primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { OfflineUnavailable } from "@/components/offline/offline-unavailable";
import { showError } from "@/lib/errors";
import { toast } from "sonner";

export function KitchenView() {
  const online = useConnectivity();
  const tickets = useQuery(api.dining.listKitchenTickets, online ? {} : "skip");
  const updateStatus = useMutation(api.dining.updateKitchenTicketStatus);

  if (!online) {
    return <OfflineUnavailable title="Kitchen needs a connection" />;
  }
  if (tickets === undefined) {
    return <LoadingState label="Loading kitchen…" />;
  }

  return (
    <div className="min-w-0 space-y-6" data-tour="page-content">
      <PageHeader title="Kitchen" description="Open tickets from the floor." />
      {tickets.length === 0 ? (
        <EmptyState title="No open tickets" description="Fired orders will appear here." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tickets.map((ticket) => (
            <Card key={ticket._id}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base">{ticket.tableName}</CardTitle>
                <Badge variant={ticket.status === "ready" ? "secondary" : "warning"}>
                  {ticket.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2 text-sm">
                  {ticket.lines.map((line) => (
                    <li key={line._id}>
                      <span className="font-medium">
                        {line.quantity}× {line.productName}
                      </span>
                      {line.modifiersLabel ? (
                        <p className="text-muted-foreground text-xs">{line.modifiersLabel}</p>
                      ) : null}
                      {line.note ? (
                        <p className="text-muted-foreground text-xs">Note: {line.note}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  {ticket.status === "open" ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        void updateStatus({ ticketId: ticket._id, status: "ready" })
                          .then(() => toast.success("Marked ready"))
                          .catch((e) => showError(e, "Could not update ticket"))
                      }
                    >
                      Ready
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void updateStatus({ ticketId: ticket._id, status: "done" })
                        .then(() => toast.success("Ticket done"))
                        .catch((e) => showError(e, "Could not update ticket"))
                    }
                  >
                    Done
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
