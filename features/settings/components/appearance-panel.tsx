"use client";

import { useMutation } from "convex/react";
import { useSyncExternalStore } from "react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  applyFontSize,
  getStoredFontSize,
  subscribeFontSize,
  type AppearanceTheme,
  type FontSize,
} from "@/hooks/use-appearance";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { showError } from "@/lib/errors";

export function AppearancePanel() {
  const { theme, setTheme } = useTheme();
  const online = useConnectivity();
  const updateOwnAppearance = useMutation(api.users.updateOwnAppearance);
  const fontSize = useSyncExternalStore(
    subscribeFontSize,
    getStoredFontSize,
    () => "md" as FontSize,
  );

  async function persist(nextTheme: AppearanceTheme, nextFont: FontSize) {
    setTheme(nextTheme);
    applyFontSize(nextFont);
    if (!online) {
      toast.success("Appearance saved on this device");
      return;
    }
    try {
      await updateOwnAppearance({ theme: nextTheme, fontSize: nextFont });
      toast.success("Appearance saved");
    } catch (error) {
      showError(error, "Could not save appearance");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
      </CardHeader>
      <CardContent className="grid max-w-lg gap-4">
        <div className="space-y-2">
          <Label>Theme</Label>
          <Select
            value={theme ?? "system"}
            onValueChange={(value) => {
              void persist(value as AppearanceTheme, fontSize);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Saved to your account and restored on every login.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Font size</Label>
          <Select
            value={fontSize}
            onValueChange={(value) => {
              void persist((theme as AppearanceTheme) ?? "system", value as FontSize);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Font size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sm">Small</SelectItem>
              <SelectItem value="md">Medium</SelectItem>
              <SelectItem value="lg">Large</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Applies across the app for accessibility and denser POS screens.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
