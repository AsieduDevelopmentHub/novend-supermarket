"use client";

import { FormEvent, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/primitives";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { useConnectivity } from "@/hooks/use-connectivity";
import { SMS_AUDIENCES, SMS_MESSAGE_MAX, type SmsAudience } from "@/convex/shared/smsAudience";
import { formatDateTime } from "@/lib/date";
import { showError } from "@/lib/errors";
import { toast } from "sonner";

const AUDIENCE_LABEL: Record<SmsAudience, string> = {
  owners: "Business owners",
  administrators: "Administrators",
  managers: "Managers",
};

export function PlatformSmsView() {
  const online = useConnectivity();
  const organizations = useAuthedQuery(api.platformSms.listOrganizations, online ? {} : "skip");
  const broadcasts = useAuthedQuery(api.platformSms.listBroadcasts, online ? {} : "skip");
  const send = useAction(api.sms.broadcast);

  const [organizationId, setOrganizationId] = useState("");
  const [audiences, setAudiences] = useState<SmsAudience[]>(["owners"]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const preview = useAuthedQuery(
    api.platformSms.preview,
    online && audiences.length > 0
      ? {
          organizationId: organizationId
            ? (organizationId as Id<"organizations">)
            : undefined,
          audiences,
        }
      : "skip",
  );

  function toggleAudience(audience: SmsAudience) {
    setAudiences((current) =>
      current.includes(audience)
        ? current.filter((item) => item !== audience)
        : [...current, audience],
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await send({
        organizationId: organizationId ? (organizationId as Id<"organizations">) : undefined,
        audiences,
        message,
      });
      if (result.status === "skipped") {
        toast.message("Message saved. SMS was not sent because Arkesel is not configured.");
      } else {
        toast.success(`SMS sent to ${result.recipientCount} people`);
      }
      setMessage("");
    } catch (error) {
      showError(error, "Could not send SMS");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="SMS"
        description="Send one message to business owners, administrators, or managers. Cashiers are not included."
      />

      <Card>
        <CardHeader>
          <CardTitle>New message</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="sms-org">Business</Label>
              <SearchableSelect
                id="sms-org"
                value={organizationId || "all"}
                onValueChange={(value) => setOrganizationId(value === "all" ? "" : value)}
                placeholder="All businesses"
                searchPlaceholder="Search businesses"
                options={[
                  { value: "all", label: "All businesses" },
                  ...(organizations ?? []).map((org) => ({ value: org.id, label: org.name })),
                ]}
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Recipients</legend>
              <div className="flex flex-wrap gap-2">
                {SMS_AUDIENCES.map((audience) => {
                  const selected = audiences.includes(audience);
                  return (
                    <Button
                      key={audience}
                      type="button"
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      aria-pressed={selected}
                      onClick={() => toggleAudience(audience)}
                    >
                      {AUDIENCE_LABEL[audience]}
                    </Button>
                  );
                })}
              </div>
              <p className="text-muted-foreground text-xs">
                {audiences.length === 0
                  ? "Choose at least one group."
                  : preview === undefined
                    ? "Counting phone numbers…"
                    : preview.capped
                      ? `More than ${preview.count} numbers. Pick one business.`
                      : `${preview.count} phone number${preview.count === 1 ? "" : "s"} on file.`}
              </p>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="sms-message">Message</Label>
              <Textarea
                id="sms-message"
                value={message}
                onChange={(event) => setMessage(event.target.value.slice(0, SMS_MESSAGE_MAX))}
                rows={4}
                required
                placeholder="Short update for owners and managers"
              />
              <p className="text-muted-foreground text-xs">
                {message.trim().length}/{SMS_MESSAGE_MAX}
              </p>
            </div>

            <Button
              type="submit"
              disabled={
                pending ||
                !online ||
                audiences.length === 0 ||
                !message.trim() ||
                !preview ||
                preview.count === 0 ||
                preview.capped
              }
            >
              {pending ? "Sending…" : "Send SMS"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent sends</CardTitle>
        </CardHeader>
        <CardContent>
          {broadcasts === undefined ? (
            <LoadingState label="Loading messages…" />
          ) : broadcasts.length === 0 ? (
            <EmptyState title="No messages yet" description="Sent broadcasts show up here." />
          ) : (
            <ul className="space-y-3">
              {broadcasts.map((row) => (
                <li key={row.id} className="border-border rounded-xl border px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        row.status === "sent"
                          ? "success"
                          : row.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {row.status}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {formatDateTime(row.createdAt)} · {row.recipientCount} recipients
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{row.message}</p>
                  <p className="text-muted-foreground mt-1 text-xs capitalize">
                    {row.audiences.join(", ")}
                    {row.detail ? ` · ${row.detail}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
