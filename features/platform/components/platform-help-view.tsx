import Link from "next/link";
import { PageHeader } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { HelpToursPanel } from "@/features/settings/components/help-tours-panel";

export function PlatformHelpView() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform help"
        description="Replay the Super Admin monitoring walkthrough."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/platform/analytics">Back to monitoring</Link>
          </Button>
        }
      />
      <HelpToursPanel />
    </div>
  );
}
