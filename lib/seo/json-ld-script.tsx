import type { ReactNode } from "react";

type JsonLdValue = Record<string, unknown> | ReadonlyArray<Record<string, unknown>>;

/**
 * Embed schema.org JSON-LD. Rendered as a static script body so CSP
 * `strict-dynamic` + Next metadata pipeline treat it as document content.
 */
export function JsonLd({ data }: { data: JsonLdValue }): ReactNode {
  const payload = Array.isArray(data) ? data : [data];
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
