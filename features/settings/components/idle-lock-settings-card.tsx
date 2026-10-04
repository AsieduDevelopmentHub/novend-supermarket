"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Timer } from "lucide-react";
import {
  IDLE_LOCK_TIMEOUT_OPTIONS,
  parseIdleLockTimeout,
  readIdleLockTimeout,
  writeIdleLockTimeout,
  type IdleLockTimeoutMinutes,
} from "@/lib/offline/idle-lock";

type IdleLockSettingsCardProps = {
  /** Called when the till timeout preference changes so the live watcher updates. */
  onTimeoutChange?: (minutes: IdleLockTimeoutMinutes) => void;
};

/**
 * Shared-till inactivity lock. Device-local preference (survives logout).
 * Matches Security panel Card density — no new chrome.
 * Offline password unlock uses the device verifier from the last online sign-in;
 * Cap biometrics can also unlock offline when enrolled.
 */
export function IdleLockSettingsCard({ onTimeoutChange }: IdleLockSettingsCardProps) {
  const [timeoutMinutes, setTimeoutMinutes] = useState<IdleLockTimeoutMinutes>(() =>
    readIdleLockTimeout(),
  );

  function onChange(value: string) {
    const next = parseIdleLockTimeout(value);
    setTimeoutMinutes(next);
    writeIdleLockTimeout(next);
    onTimeoutChange?.(next);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Timer className="h-4 w-4" aria-hidden />
          Inactivity lock
        </CardTitle>
        <CardDescription>
          Unlock with your password, even offline, after you have signed in online once on this
          device. On Android, biometrics can also unlock when enabled.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="idle-lock-timeout">Lock after</Label>
          <Select value={String(timeoutMinutes)} onValueChange={onChange}>
            <SelectTrigger id="idle-lock-timeout">
              <SelectValue placeholder="Timeout" />
            </SelectTrigger>
            <SelectContent>
              {IDLE_LOCK_TIMEOUT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
