/** Customer display hardware policy — shared by Electron shell and settings UI. */

export const CUSTOMER_DISPLAY_SINGLE_MONITOR_MESSAGE =
  "Connect a second monitor to use the customer display. Novend opens the customer screen on your secondary display only.";

export function hasSecondaryDisplay(displayCount: number): boolean {
  return displayCount >= 2;
}
