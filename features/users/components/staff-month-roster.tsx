"use client";

import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { usePermissions } from "@/hooks/use-permissions";
import { useLicense } from "@/hooks/use-license";
import { useConnectivity } from "@/hooks/use-connectivity";
import { formatCurrency } from "@/lib/currency";
import { currentPayPeriodKey } from "@/convex/shared/payroll";
import { useStaffMonthRoster } from "@/features/users/hooks/use-staff-payroll";
import { useState } from "react";

export function StaffMonthRoster() {
  const { canManagePayroll } = usePermissions();
  const { capabilities } = useLicense();
  const online = useConnectivity();
  const [payPeriodKey, setPayPeriodKey] = useState(currentPayPeriodKey("monthly"));
  const enabled = canManagePayroll && capabilities.canManageStaffCompensation;
  const rows = useStaffMonthRoster(payPeriodKey, enabled);

  if (!enabled) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle className="text-base">Staff month</CardTitle>
          <CardDescription>
            Salary and commission for the period. Open a user to record payment.
            {!online ? " Showing offline data from this device." : ""}
          </CardDescription>
        </div>
        <div className="space-y-1">
          <Label htmlFor="staff-month" className="sr-only">
            Month
          </Label>
          <Input
            id="staff-month"
            type="month"
            value={payPeriodKey}
            onChange={(event) => setPayPeriodKey(event.target.value)}
            className="w-44"
          />
        </div>
      </CardHeader>
      <CardContent>
        {rows === undefined ? (
          <LoadingState label="Loading payroll…" />
        ) : (rows ?? []).length === 0 ? (
          <EmptyState
            title="No payroll this period"
            description="Set a salary or commission on a user profile first."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Employee</th>
                  <th className="py-2 font-medium">Salary</th>
                  <th className="py-2 font-medium">Commission</th>
                  <th className="py-2 font-medium">Staff cost</th>
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).map((row) => (
                  <tr key={row.profileId} className="border-border border-t">
                    <td className="py-2">
                      <Link
                        href={`/users/${row.profileId}`}
                        className="font-medium hover:underline"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="py-2">
                      {formatCurrency(row.salaryPaid)} / {formatCurrency(row.salaryDue)}{" "}
                      <Badge variant={row.salaryStatus === "paid" ? "success" : "secondary"}>
                        {row.salaryStatus}
                      </Badge>
                    </td>
                    <td className="py-2">
                      {formatCurrency(row.commissionPaid)} / {formatCurrency(row.commissionEarned)}
                    </td>
                    <td className="py-2 font-medium">{formatCurrency(row.totalStaffCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
