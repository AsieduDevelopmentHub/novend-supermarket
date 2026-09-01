"use client";

import { useState } from "react";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/primitives";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { ListPagination } from "@/components/ui/list-pagination";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { BranchFilter } from "@/components/filters/branch-filter";
import { CollapsibleFilters } from "@/components/filters/collapsible-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";
import { useClientPagedRows } from "@/hooks/use-ui";
import { useBranchesList, useReturnsList } from "@/hooks/use-offline-lists";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { Eye, Undo2 } from "lucide-react";

export function ReturnsView() {
  const { isAdmin, isCashier, branchId: myBranchId, branchName } = usePermissions();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | "full" | "partial">("all");
  const [branchFilter, setBranchFilter] = useState<Id<"branches"> | "all">("all");
  const branches = useBranchesList(false);
  const returns = useReturnsList({
    search,
    kind,
    branchId: isAdmin && branchFilter !== "all" ? branchFilter : undefined,
  });
  const filterKey = `${search}|${kind}|${branchFilter}`;
  const { page, setPage, pageSize, setPageSize, total, paged } = useClientPagedRows(
    returns,
    filterKey,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Returns"
        description={
          isCashier
            ? "Refunds on your orders."
            : "Every processed refund, linked to the original order."
        }
      />

      <div className="space-y-3">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search return, invoice, customer…"
          className="max-w-md"
        />
        <CollapsibleFilters
          activeCount={(kind !== "all" ? 1 : 0) + (isAdmin && branchFilter !== "all" ? 1 : 0)}
          onReset={() => {
            setKind("all");
            setBranchFilter("all");
            setPage(1);
          }}
        >
          <Select
            value={kind}
            onValueChange={(value) => {
              setKind(value as "all" | "full" | "partial");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="full">Full return</SelectItem>
              <SelectItem value="partial">Partial return</SelectItem>
            </SelectContent>
          </Select>
          {isAdmin ? (
            <BranchFilter
              branches={branches}
              value={branchFilter}
              onChange={(value) => {
                setBranchFilter(value);
                setPage(1);
              }}
              allowAll
              className="w-full sm:w-auto"
            />
          ) : branchName ? (
            <BranchFilter
              branches={undefined}
              value={myBranchId}
              onChange={() => undefined}
              lockedLabel={branchName}
              className="w-full sm:w-auto"
            />
          ) : null}
        </CollapsibleFilters>
      </div>

      {returns === undefined ? (
        <LoadingState label="Loading returns…" variant="table" />
      ) : returns.length === 0 ? (
        <EmptyState icon={Undo2} title="No returns yet" />
      ) : (
        <>
          <div className="hidden md:block">
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Return</th>
                      <th className="px-4 py-3 font-medium">Order</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Branch</th>
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="px-4 py-3 font-medium">Cashier</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Reason</th>
                      <th className="px-4 py-3 font-medium">Refund</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(paged ?? []).map((row) => (
                      <ClickableTableRow key={row.id} href={`/returns/${row.id}`}>
                        <td className="px-4 py-3 font-medium">{row.returnNumber}</td>
                        <td className="px-4 py-3">{row.invoiceNumber}</td>
                        <td className="px-4 py-3">{formatDateTime(row.completedAt)}</td>
                        <td className="px-4 py-3">{row.branchName ?? "—"}</td>
                        <td className="px-4 py-3">{row.customerName}</td>
                        <td className="px-4 py-3">{row.cashierName}</td>
                        <td className="px-4 py-3">
                          <Badge variant={row.kind === "full" ? "warning" : "secondary"}>
                            {row.kind === "full" ? "Full" : "Partial"}
                          </Badge>
                        </td>
                        <td className="max-w-[160px] truncate px-4 py-3">{row.reason}</td>
                        <td className="px-4 py-3 font-medium">
                          {formatCurrency(row.refundAmount)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="success">
                            {row.status === "completed" ? "Completed" : "Pending"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Button asChild size="icon" variant="ghost" aria-label="View return">
                            <Link href={`/returns/${row.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </td>
                      </ClickableTableRow>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3 md:hidden">
            {(paged ?? []).map((row) => (
              <Card key={row.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{row.returnNumber}</p>
                      <p className="text-muted-foreground text-xs">
                        {row.invoiceNumber} · {formatDateTime(row.completedAt)}
                      </p>
                    </div>
                    <Badge variant={row.kind === "full" ? "warning" : "secondary"}>
                      {row.kind === "full" ? "Full" : "Partial"}
                    </Badge>
                  </div>
                  <p className="text-sm">{row.customerName}</p>
                  <p className="text-muted-foreground text-xs">{row.reason}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span>{row.cashierName}</span>
                    <span className="font-semibold">{formatCurrency(row.refundAmount)}</span>
                  </div>
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link href={`/returns/${row.id}`}>View return</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
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
        </>
      )}
    </div>
  );
}
