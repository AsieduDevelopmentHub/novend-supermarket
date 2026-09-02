"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Monitor, Scale, ScanBarcode, Printer } from "lucide-react";

const PLANNED = [
  {
    title: "Cash drawer",
    detail: "Triggered via ESC/POS pulse with receipt print (pulse already supported on printers).",
    status: "Partial",
  },
  {
    title: "Weighing scale",
    detail: "Read live weight for catch-weight / bulk items at checkout.",
    status: "Planned",
  },
  {
    title: "Label printer",
    detail: "Print shelf and barcode labels from the catalog.",
    status: "Planned",
  },
] as const;

/** Placeholder list so Hardware stays extensible without hardcoding new top-level tabs yet. */
export function FutureDevicesPanel() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Future devices</CardTitle>
          <CardDescription>
            Hardware uses a shared discovery + capability registry in the desktop shell. New device
            kinds register adapters without changing the Settings layout.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {PLANNED.map((item) => (
            <div
              key={item.title}
              className="border-border flex items-start gap-3 rounded-lg border px-3 py-3"
            >
              <DeviceIcon title={item.title} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{item.title}</p>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">{item.detail}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function DeviceIcon({ title }: { title: string }) {
  const className = "text-muted-foreground mt-0.5 h-4 w-4 shrink-0";
  if (title.includes("drawer")) return <Monitor className={className} />;
  if (title.includes("scale")) return <Scale className={className} />;
  if (title.includes("Label")) return <Printer className={className} />;
  return <ScanBarcode className={className} />;
}
