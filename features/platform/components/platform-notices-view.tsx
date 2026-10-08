"use client";

import { FormEvent, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/primitives";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { useConnectivity } from "@/hooks/use-connectivity";
import {
  NOTICE_BODY_MAX,
  NOTICE_TITLE_MAX,
  SMS_AUDIENCES,
  type SmsAudience,
} from "@/convex/shared/smsAudience";
import { formatDateTime } from "@/lib/date";
import { showError } from "@/lib/errors";
import { toast } from "sonner";

const AUDIENCE_LABEL: Record<SmsAudience, string> = {
  owners: "Business owners",
  administrators: "Administrators",
  managers: "Managers",
};

export function PlatformNoticesView() {
  const online = useConnectivity();
  const organizations = useAuthedQuery(api.platformSms.listOrganizations, online ? {} : "skip");
  const notices = useAuthedQuery(api.platformNotices.list, online ? {} : "skip");
  const send = useMutation(api.platformNotices.send);

  const [organizationId, setOrganizationId] = useState("");
  const [audiences, setAudiences] = useState<SmsAudience[]>(["owners"]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);

  const preview = useAuthedQuery(
    api.platformNotices.preview,
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
        title,
        body,
      });
      toast.success(`Notice sent to ${result.recipientCount} people`);
      setTitle("");
      setBody("");
    } catch (error) {
      showError(error, "Could not send the notice");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Send one in-app notice to business owners, administrators, or managers. Cashiers are not included."
      />

      <Card>
        <CardHeader>
          <CardTitle>New notice</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="notice-org">Business</Label>
              <SearchableSelect
                id="notice-org"
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
                    ? "Counting people…"
                    : preview.capped
                      ? `More than ${preview.count} people. Pick one business.`
                      : `${preview.count} ${preview.count === 1 ? "person" : "people"} will see this in the bell.`}
              </p>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="notice-title">Title</Label>
              <Input
                id="notice-title"
                value={title}
                onChange={(event) => setTitle(event.target.value.slice(0, NOTICE_TITLE_MAX))}
                required
                placeholder="Short headline"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notice-body">Message</Label>
              <Textarea
                id="notice-body"
                value={body}
                onChange={(event) => setBody(event.target.value.slice(0, NOTICE_BODY_MAX))}
                rows={4}
                required
                placeholder="What owners and managers should know"
              />
              <p className="text-muted-foreground text-xs">
                {body.trim().length}/{NOTICE_BODY_MAX}
              </p>
            </div>

            <Button
              type="submit"
              disabled={
                pending ||
                !online ||
                audiences.length === 0 ||
                !title.trim() ||
                !body.trim() ||
                !preview ||
                preview.count === 0 ||
                preview.capped
              }
            >
              {pending ? "Sending…" : "Send notice"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent notices</CardTitle>
        </CardHeader>
        <CardContent>
          {notices === undefined ? (
            <LoadingState label="Loading notices…" />
          ) : notices.length === 0 ? (
            <EmptyState title="No notices yet" description="Sent notices show up here." />
          ) : (
            <ul className="space-y-3">
              {notices.map((row) => (
                <li key={row.id} className="border-border rounded-xl border px-4 py-3">
                  <p className="text-sm font-medium">{row.title}</p>
                  <p className="mt-1 text-sm">{row.body}</p>
                  <p className="text-muted-foreground mt-2 text-xs capitalize">
                    {formatDateTime(row.createdAt)} · {row.recipientCount} recipients ·{" "}
                    {row.audiences.join(", ")}
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
