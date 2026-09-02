"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { currentPayPeriodKey } from "@/convex/shared/payroll";
import { useConnectivity } from "@/hooks/use-connectivity";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";
import {
  buildLocalStaffMonthRecord,
  buildLocalStaffMonthRoster,
  buildLocalStaffPerformance,
  getLocalStaffCompensation,
} from "@/lib/offline/staff-performance";

function useLocalLoader<T>(loader: () => Promise<T | null>, deps: unknown[]) {
  const [value, setValue] = useState<T | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      void loader().then((next) => {
        if (!cancelled) setValue(next);
      });
    };
    run();
    const unsubscribe = subscribeReplicaChanged(() => run());
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loader identity follows deps
  }, deps);
  return value;
}

export function useStaffPerformance(args: {
  profileId: Id<"profiles">;
  userId: string;
  startDate?: number;
  endDate?: number;
  enabled: boolean;
}) {
  const online = useConnectivity();
  const remote = useQuery(
    api.payroll.performance,
    online && args.enabled && args.startDate !== undefined && args.endDate !== undefined
      ? {
          profileId: args.profileId,
          startDate: args.startDate,
          endDate: args.endDate,
        }
      : "skip",
  );
  const local = useLocalLoader(
    () =>
      args.enabled && args.startDate !== undefined && args.endDate !== undefined
        ? buildLocalStaffPerformance({
            profileId: args.profileId,
            userId: args.userId,
            startDate: args.startDate,
            endDate: args.endDate,
          })
        : Promise.resolve(null),
    [args.profileId, args.userId, args.startDate, args.endDate, args.enabled],
  );
  if (!args.enabled) return undefined;
  return remote !== undefined ? remote : local;
}

export function useStaffCompensation(profileId: Id<"profiles">, enabled: boolean) {
  const online = useConnectivity();
  const remote = useQuery(api.payroll.getCompensation, online && enabled ? { profileId } : "skip");
  const local = useLocalLoader(async () => {
    if (!enabled) return null;
    const row = await getLocalStaffCompensation(profileId);
    const salaryFrequency = row?.salaryFrequency ?? "monthly";
    return {
      profileId,
      salaryAmount: row?.salaryAmount ?? null,
      salaryFrequency,
      commissionRate: row?.commissionRate ?? null,
      commissionBasis: row?.commissionBasis ?? ("net" as const),
      currentPeriodKey: currentPayPeriodKey(salaryFrequency),
    };
  }, [profileId, enabled]);
  if (!enabled) return undefined;
  return remote !== undefined ? remote : local;
}

export function useStaffMonthRecord(args: {
  profileId: Id<"profiles">;
  userId: string;
  userName: string;
  payPeriodKey: string;
  enabled: boolean;
}) {
  const online = useConnectivity();
  const remote = useQuery(
    api.payroll.monthRecord,
    online && args.enabled
      ? { profileId: args.profileId, payPeriodKey: args.payPeriodKey }
      : "skip",
  );
  const local = useLocalLoader(
    () =>
      args.enabled
        ? buildLocalStaffMonthRecord({
            profileId: args.profileId,
            userId: args.userId,
            userName: args.userName,
            payPeriodKey: args.payPeriodKey,
          })
        : Promise.resolve(null),
    [args.profileId, args.userId, args.userName, args.payPeriodKey, args.enabled],
  );
  if (!args.enabled) return undefined;
  return remote !== undefined ? remote : local;
}

export function useStaffMonthRoster(payPeriodKey: string, enabled: boolean) {
  const online = useConnectivity();
  const remote = useQuery(
    api.payroll.monthRoster,
    online && enabled && payPeriodKey ? { payPeriodKey } : "skip",
  );
  const local = useLocalLoader(
    () =>
      enabled && payPeriodKey ? buildLocalStaffMonthRoster(payPeriodKey) : Promise.resolve([]),
    [payPeriodKey, enabled],
  );
  if (!enabled) return undefined;
  return remote !== undefined ? remote : local;
}
