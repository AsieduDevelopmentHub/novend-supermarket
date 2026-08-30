/**
 * Capacitor Filesystem.getUri() often returns https://localhost/_capacitor_file_/…
 * after the WebView has left the local boot page. Android Share / PrintManager
 * need a real filesystem path or file:// URI.
 */
export function toNativeFilePath(uri: string): string {
  const trimmed = uri.trim();
  const marker = "_capacitor_file_";
  const markerAt = trimmed.indexOf(marker);
  if (markerAt >= 0) {
    const rest = trimmed.slice(markerAt + marker.length);
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  if (trimmed.startsWith("file://")) {
    try {
      return decodeURIComponent(new URL(trimmed).pathname);
    } catch {
      return trimmed.replace(/^file:\/\//, "");
    }
  }
  return trimmed;
}

/** URI the Capacitor Share plugin can hand to FileProvider. */
export function toShareableFileUri(uri: string): string {
  if (uri.startsWith("content:")) {
    return uri;
  }
  const path = toNativeFilePath(uri);
  if (path.startsWith("/")) {
    return `file://${path}`;
  }
  return uri;
}

export function isMediaStoreUri(uri: string): boolean {
  return uri.startsWith("content://");
}
