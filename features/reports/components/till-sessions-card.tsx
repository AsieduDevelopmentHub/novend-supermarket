"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import {
  listRecentTillSessions,
  listTillSessionsForUtcDay,
  type TillSessionSummary,
} from "@/lib/offline/till-sessions";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";

type Props =
  | { mode: "day"; date: string }
  | { mode: "recent"; limit?: number };

export function TillSessionsCard(props: Props) {
  const [rows, setRows] = useState<TillSessionSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    function load() {
      const promise =
        props.mode === "day"
          ? listTillSessionsForUtcDay(props.date)
          : listRecentTillSessions(props.limit ?? 20);
      void promise.then((list) => {
        if (!cancelled) setRows(list);
      });
    }
    load();
    const unsubscribe = subscribeReplicaChanged(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [props.mode, props.mode === "day" ? props.date : props.limit]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.mode === "day" ? "Till sessions" : "Recent till sessions"}</CardTitle>
      </CardHeader>
      <CardContent className="max-w-full min-w-0 overflow-x-auto p-0">
        {rows === null ? (
          <div className="p-6">
            <LoadingState label="Loading till sessions…" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No till sessions"
              description={
                props.mode === "day"
                  ? "No Start today / Close today sessions opened on this day."
                  : "Start today from Sales to open a till session on this device."
              }
            />
          </div>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Cashier</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Opened</th>
                <th className="px-4 py-3 font-medium">Closed</th>
                <th className="px-4 py-3 font-medium">Float</th>
                <th className="px-4 py-3 font-medium">Sales</th>
                <th className="px-4 py-3 font-medium">Gross</th>
                <th className="px-4 py-3 font-medium">Cash var.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-border border-t">
                  <td className="px-4 py-3 font-medium">{row.cashierName}</td>
                  <td className="px-4 py-3">
                    <Badge variant={row.status === "open" ? "warning" : "secondary"}>
                      {row.status === "open" ? "Open" : "Closed"}
                      {row.autoStarted ? " · auto" : ""}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{formatDateTime(row.openedAt)}</td>
                  <td className="px-4 py-3">
                    {row.closedAt ? formatDateTime(row.closedAt) : "—"}
                  </td>
                  <td className="px-4 py-3">{formatCurrency(row.openingFloat)}</td>
                  <td className="px-4 py-3">{row.saleCount ?? "—"}</td>
                  <td className="px-4 py-3">
                    {row.grossSales != null ? formatCurrency(row.grossSales) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {row.varianceCash != null ? formatCurrency(row.varianceCash) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
