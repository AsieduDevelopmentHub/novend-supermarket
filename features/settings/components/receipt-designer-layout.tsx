import type { ReactNode } from "react";

type Props = {
  form: ReactNode;
  preview: ReactNode;
  previewLabel?: string;
};

/**
 * Two-column receipt designer. Height follows the form — preview column stretches
 * to match without forcing viewport min-height (which pushed the page header away).
 */
export function ReceiptDesignerLayout({ form, preview, previewLabel = "Preview" }: Props) {
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-stretch">
      <div className="min-w-0">{form}</div>
      <div className="flex min-h-0 min-w-0 flex-col gap-2">
        <p className="text-muted-foreground shrink-0 text-xs lg:text-sm">{previewLabel}</p>
        <div className="bg-muted/40 flex min-h-[18rem] flex-1 items-start justify-center rounded-xl p-4 lg:min-h-full">
          {preview}
        </div>
      </div>
    </div>
  );
}
