/**
 * GA4 funnel events. No emails, names, phones, or till payloads.
 * Automatic page views stay on the marketing site (`GoogleAnalytics`).
 * These events can also fire from auth and install flows; they no-op when
 * NEXT_PUBLIC_GA_MEASUREMENT_ID is unset.
 */

export const GA_FUNNEL_EVENTS = [
  "sign_up",
  "login",
  "start_free_trial",
  "contact_whatsapp",
  "contact_sales",
  "download_desktop",
  "download_android",
  "install_pwa",
  "pricing_view",
  "demo_request",
  "onboarding_started",
] as const;

export type GaFunnelEvent = (typeof GA_FUNNEL_EVENTS)[number];

const PARAM_KEYS = new Set(["method", "source", "file_extension", "topic"]);

export type GaEventParams = Partial<
  Record<"method" | "source" | "file_extension" | "topic", string>
>;

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    __novendGaConfigured?: boolean;
    __novendGaClicks?: boolean;
  }
}

export function gaMeasurementId() {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";
  return id.startsWith("G-") ? id : "";
}

export function isGaFunnelEvent(value: string): value is GaFunnelEvent {
  return (GA_FUNNEL_EVENTS as readonly string[]).includes(value);
}

/** Map a clicked link to a funnel event. Returns null when the link is not one we track. */
export function gaEventForLink(
  href: string,
  origin: string,
  markedEvent: string | null,
): { name: GaFunnelEvent; params?: GaEventParams } | null {
  if (markedEvent && isGaFunnelEvent(markedEvent)) {
    return { name: markedEvent };
  }

  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return null;
  }

  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/signup") {
    return { name: "start_free_trial", params: { method: "signup_link" } };
  }

  const host = url.hostname.toLowerCase();
  if (host === "wa.me" || host === "chat.whatsapp.com" || host.endsWith(".whatsapp.com")) {
    return { name: "contact_whatsapp" };
  }

  if (url.protocol === "mailto:") {
    const address = decodeURIComponent(url.pathname).toLowerCase();
    const subject = (url.searchParams.get("subject") ?? "").toLowerCase();
    if (address.includes("sales") || subject.includes("sales") || subject.includes("enterprise")) {
      return { name: "contact_sales" };
    }
    return null;
  }

  if (host === "play.google.com" || path.toLowerCase().endsWith(".apk")) {
    return { name: "download_android" };
  }

  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  if (["exe", "msi", "dmg", "deb", "appimage", "rpm"].includes(extension)) {
    return { name: "download_desktop", params: { file_extension: extension } };
  }

  return null;
}

function sanitizeParams(params: GaEventParams | undefined) {
  if (!params) return undefined;
  const safe: GaEventParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (!PARAM_KEYS.has(key) || typeof value !== "string") continue;
    const trimmed = value.trim().slice(0, 64);
    if (!trimmed) continue;
    safe[key as keyof GaEventParams] = trimmed;
  }
  return Object.keys(safe).length > 0 ? safe : undefined;
}

function ensureGtag(measurementId: string) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
  }
  if (window.__novendGaConfigured) return;
  window.__novendGaConfigured = true;
  if (!document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);
    window.gtag("js", new Date());
    window.gtag("config", measurementId, { anonymize_ip: true, send_page_view: false });
  }
}

const oncePerPage = new Set<GaFunnelEvent>();

export function trackGaEvent(name: GaFunnelEvent, params?: GaEventParams) {
  if (typeof window === "undefined") return;
  const measurementId = gaMeasurementId();
  if (!measurementId) return;
  // Prompt accept and the browser `appinstalled` event are the same install.
  if (name === "install_pwa") {
    if (oncePerPage.has(name)) return;
    oncePerPage.add(name);
  }
  ensureGtag(measurementId);
  window.gtag?.("event", name, sanitizeParams(params));
}

/** Capture-phase listener for marketing and in-app download links. Idempotent. */
export function installGaClickTracking() {
  if (typeof window === "undefined" || window.__novendGaClicks) return;
  if (!gaMeasurementId()) return;
  window.__novendGaClicks = true;
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      const marked = anchor.getAttribute("data-ga-event");
      const match = gaEventForLink(anchor.href, window.location.origin, marked);
      if (!match) return;
      trackGaEvent(match.name, match.params);
    },
    true,
  );
}
