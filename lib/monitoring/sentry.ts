/**
 * Sentry bootstrap. Only initializes when NEXT_PUBLIC_SENTRY_DSN is set.
 * Never throw from these helpers — monitoring must not take down the POS.
 */

const dsn = () => process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || "";

export function isSentryEnabled() {
  return Boolean(dsn());
}

export async function initSentryBrowser() {
  if (typeof window === "undefined" || !isSentryEnabled()) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: dsn(),
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      beforeSend(event) {
        if (event.request?.headers) {
          delete event.request.headers["authorization"];
          delete event.request.headers["cookie"];
        }
        const text = `${event.message ?? ""} ${event.exception?.values?.map((value) => value.value).join(" ") ?? ""}`;
        if (/plugin is not implemented/i.test(text)) return null;
        return event;
      },
    });
  } catch (error) {
    console.warn("[sentry] Browser init skipped:", error);
  }
}

export async function initSentryServer() {
  if (!isSentryEnabled()) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: dsn(),
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
      tracesSampleRate: 0.1,
    });
  } catch (error) {
    console.warn("[sentry] Server init skipped:", error);
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!isSentryEnabled()) return;
  void import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.withScope((scope) => {
        if (context) {
          for (const [key, value] of Object.entries(context)) {
            scope.setExtra(key, value);
          }
        }
        Sentry.captureException(error);
      });
    })
    .catch(() => undefined);
}
