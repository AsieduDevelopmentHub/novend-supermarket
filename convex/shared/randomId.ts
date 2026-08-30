/**
 * Cryptographically strong ids when the runtime provides them.
 * Android WebView on http:// (Cap live-reload) often has `crypto` but no
 * `randomUUID` / `getRandomValues` — checkout must still allocate invoices.
 */

let fallbackSeq = 0;

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function randomUuid(): string {
  const webCrypto = typeof crypto !== "undefined" ? crypto : undefined;
  if (webCrypto && typeof webCrypto.randomUUID === "function") {
    return webCrypto.randomUUID();
  }
  if (webCrypto && typeof webCrypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    webCrypto.getRandomValues(bytes);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    return bytesToUuid(bytes);
  }
  fallbackSeq += 1;
  const seed = `${Date.now().toString(16)}${fallbackSeq.toString(16)}${Math.random().toString(16).slice(2)}00`;
  return bytesToUuid(
    Uint8Array.from({ length: 16 }, (_, index) => {
      const pair = seed.slice(index * 2, index * 2 + 2);
      return Number.parseInt(pair.padEnd(2, "0"), 16) & 0xff;
    }),
  );
}

/** Uppercase hex, no dashes — invoice / return / PO suffixes. */
export function randomHexId(length = 16): string {
  const hex = randomUuid().replaceAll("-", "").toUpperCase();
  if (hex.length >= length) return hex.slice(0, length);
  return `${hex}${randomUuid().replaceAll("-", "").toUpperCase()}`.slice(0, length);
}
