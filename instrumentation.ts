/**
 * Next.js server instrumentation. Sentry loads only when a DSN is configured.
 * @see https://nextjs.org/docs/app/guides/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initSentryServer } = await import("./lib/monitoring/sentry");
    await initSentryServer();
  }
}
