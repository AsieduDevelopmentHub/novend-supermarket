"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildContactMailto, landingCopy } from "@/features/marketing/content";
import { trackGaEvent } from "@/lib/analytics/ga-events";

/** Client contact form — opens a drafted mailto (no server mailbox required). */
export function ContactForm() {
  const { form } = landingCopy.contactPage;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [business, setBusiness] = useState("");
  const [topic, setTopic] = useState<string>(form.topics[0]?.value ?? "Support");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName || !trimmedEmail || !trimmedMessage) {
      setError("Please fill in your name, email, and message.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setError(null);
    if (topic === "Sales") {
      trackGaEvent("contact_sales", { topic: "sales", source: "contact_form" });
    }
    window.location.href = buildContactMailto({
      name: trimmedName,
      email: trimmedEmail,
      business,
      topic,
      message: trimmedMessage,
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="contact-name" label={form.nameLabel}>
          <Input
            id="contact-name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="h-11 rounded-xl border-slate-200 bg-white"
          />
        </Field>
        <Field id="contact-email" label={form.emailLabel}>
          <Input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="h-11 rounded-xl border-slate-200 bg-white"
          />
        </Field>
      </div>

      <Field
        id="contact-business"
        label={form.businessLabel}
        hint={form.businessOptional}
      >
        <Input
          id="contact-business"
          name="business"
          autoComplete="organization"
          value={business}
          onChange={(event) => setBusiness(event.target.value)}
          className="h-11 rounded-xl border-slate-200 bg-white"
        />
      </Field>

      <Field id="contact-topic" label={form.topicLabel}>
        <select
          id="contact-topic"
          name="topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          className="border-input bg-card focus-visible:ring-ring flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:ring-2 focus-visible:outline-none"
        >
          {form.topics.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>

      <Field id="contact-message" label={form.messageLabel}>
        <Textarea
          id="contact-message"
          name="message"
          rows={5}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
          className="min-h-[8rem] rounded-xl border-slate-200 bg-white"
        />
      </Field>

      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="h-11 w-full rounded-full px-6 font-semibold sm:w-auto">
        {form.submit}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-[#0B1220]">
          {label}
        </Label>
        {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}
