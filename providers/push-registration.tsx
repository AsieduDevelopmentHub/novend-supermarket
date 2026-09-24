"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { Hardware, isElectron } from "@novend/hardware";
import { api } from "@/convex/_generated/api";
import { useConnectivity } from "@/hooks/use-connectivity";

/**
 * Registers this device for remote push when the user is signed in and online.
 * Electron also consumes the short-lived outbox for foreground notifications.
 */
export function PushRegistrationHost() {
  const { isAuthenticated } = useConvexAuth();
  const online = useConnectivity();
  const registerDevice = useMutation(api.pushNotifications.registerDevice);
  const ackOutbox = useMutation(api.pushNotifications.ackOutbox);
  const outbox = useQuery(
    api.pushNotifications.listMyOutbox,
    isAuthenticated && online && isElectron() ? { limit: 10 } : "skip",
  );
  const registering = useRef(false);
  const acked = useRef(new Set<string>());

  useEffect(() => {
    if (!isAuthenticated || !online || registering.current) return;
    registering.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const permission = await Hardware.notifications.checkPermissions();
        if (cancelled) return;
        if (permission.data?.state === "unavailable") return;
        if (permission.data?.state !== "granted") return;

        const topics = await Hardware.notifications.getTopicPrefs();
        const remote = await Hardware.notifications.registerRemote({
          vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        });
        if (cancelled || !remote.ok || !remote.data) return;

        await registerDevice({
          platform: remote.data.platform,
          endpoint: remote.data.endpoint,
          p256dh: remote.data.p256dh,
          auth: remote.data.auth,
          topics: topics.data,
          userAgent: remote.data.userAgent,
        });
      } catch {
        /* registration is best-effort */
      } finally {
        registering.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, online, registerDevice]);

  useEffect(() => {
    if (!outbox || outbox.length === 0) return;
    const pending = outbox.filter((row) => !acked.current.has(String(row._id)));
    if (pending.length === 0) return;

    void (async () => {
      const ids: Array<(typeof pending)[number]["_id"]> = [];
      for (const row of pending) {
        acked.current.add(String(row._id));
        await Hardware.notifications.scheduleLocal({
          title: row.title,
          body: row.body,
        });
        ids.push(row._id);
      }
      if (ids.length > 0) {
        try {
          await ackOutbox({ ids });
        } catch {
          for (const id of ids) acked.current.delete(String(id));
        }
      }
    })();
  }, [outbox, ackOutbox]);

  return null;
}
