/**
 * Production Capacitor/Electron load an HTTPS hosted origin.
 * Android Studio live-reload and LAN Next are HTTP (10.0.2.2 / LAN IP) —
 * those sessions must not hit the production update endpoint.
 */
export function shouldSkipMobileUpdateCheck(
  protocol: string,
  hostname: string,
): boolean {
  if (protocol !== "https:") return true;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "10.0.2.2" ||
    hostname === "0.0.0.0"
  );
}
