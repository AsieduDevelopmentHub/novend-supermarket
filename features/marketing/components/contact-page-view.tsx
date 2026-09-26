import Link from "next/link";
import {
  Linkedin,
  Mail,
  MessageCircle,
  Phone,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactForm } from "@/features/marketing/components/contact-form";
import { LandingCta } from "@/features/marketing/components/landing-cta";
import { landingCopy } from "@/features/marketing/content";
import { cn } from "@/lib/utils";

const CHANNEL_ICONS = {
  community: Users,
  whatsapp: MessageCircle,
  email: Mail,
  phone: Phone,
} as const;

const SOCIAL_ICONS: Record<string, LucideIcon> = {
  community: Users,
  whatsapp: MessageCircle,
  linkedin: Linkedin,
};

/** Public contact page — channels, WhatsApp community, form, and social links. */
export function ContactPageView() {
  const { contactPage } = landingCopy;

  return (
    <div className="bg-[#F8FAFC]">
      <section className="border-b border-[rgba(11,18,32,0.08)] bg-gradient-to-b from-[#EFF8FF] to-[#F8FAFC]">
        <div
          data-reveal
          className="mx-auto max-w-[820px] px-4 py-14 text-center sm:px-6 sm:py-16 lg:px-8 lg:py-20"
        >
          <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
            {contactPage.badge}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-[#0B1220] sm:text-4xl lg:text-5xl lg:leading-[1.05]">
            {contactPage.title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-pretty text-[#526174] sm:text-lg">
            {contactPage.subtitle}
          </p>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500">{contactPage.responseNote}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-full px-7 font-semibold">
              <a href={contactPage.channels.items[0]?.href} target="_blank" rel="noopener noreferrer">
                Join WhatsApp community
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-full border-slate-300 bg-white px-7 font-semibold"
            >
              <a href="#contact-form">Send a message</a>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <header data-reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-[#0B1220] sm:text-3xl">
            {contactPage.channels.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#526174] sm:text-base">
            {contactPage.channels.detail}
          </p>
        </header>

        <ul
          data-reveal
          className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4"
        >
          {contactPage.channels.items.map((channel) => {
            const Icon = CHANNEL_ICONS[channel.id as keyof typeof CHANNEL_ICONS] ?? MessageCircle;
            const isExternal = channel.href.startsWith("http");
            return (
              <li key={channel.id}>
                <a
                  href={channel.href}
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noopener noreferrer" : undefined}
                  className={cn(
                    "flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white p-5 transition-colors",
                    "hover:border-primary/30 hover:bg-primary/[0.03] focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none",
                    channel.accent === "community" && "border-primary/25 bg-primary/[0.04]",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl",
                      channel.accent === "community"
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary/12 text-primary",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <p className="mt-4 text-sm font-semibold tracking-tight text-[#0B1220]">
                    {channel.label}
                  </p>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-600">
                    {channel.detail}
                  </p>
                  <span className="text-primary mt-4 text-sm font-semibold">{channel.cta}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        id="contact-form"
        className="scroll-mt-24 border-y border-slate-200/80 bg-white"
      >
        <div className="mx-auto grid max-w-[1100px] gap-10 px-4 py-12 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-14 lg:px-8 lg:py-16">
          <div data-reveal>
            <h2 className="text-2xl font-semibold tracking-tight text-[#0B1220] sm:text-3xl">
              {contactPage.form.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#526174] sm:text-base">
              {contactPage.form.detail}
            </p>
            <ul className="mt-6 space-y-2 text-sm text-slate-600">
              <li>Support questions: include organization name and what you were doing.</li>
              <li>Sales & Enterprise: share branch count, SKUs, and go-live timing.</li>
              <li>Prefer WhatsApp? Use the community or chat links above.</li>
            </ul>
          </div>
          <div data-reveal className="rounded-[1.5rem] border border-slate-200/90 bg-[#F8FAFC] p-5 sm:p-7">
            <ContactForm />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <header data-reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-[#0B1220] sm:text-3xl">
            {contactPage.socials.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#526174] sm:text-base">
            {contactPage.socials.detail}
          </p>
        </header>

        <ul
          data-reveal
          className="mx-auto mt-8 grid max-w-4xl gap-3 sm:mt-10 sm:grid-cols-2 lg:grid-cols-4"
        >
          {contactPage.socials.links.map((social) => {
            const Icon = SOCIAL_ICONS[social.id] ?? Linkedin;            return (
              <li key={social.id}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-4 transition-colors hover:border-primary/30 hover:bg-primary/[0.03] focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="bg-primary/12 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[#0B1220]">{social.label}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {social.detail}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>

        <p data-reveal className="mt-8 text-center text-sm text-slate-500">
          Looking for docs instead?{" "}
          <Link href="/docs/help" className="text-primary font-medium hover:underline">
            Visit the Help Center
          </Link>
          .
        </p>
      </section>

      <LandingCta />
    </div>
  );
}
