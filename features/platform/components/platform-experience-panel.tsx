"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/feedback/loading-state";
import { useConnectivity } from "@/hooks/use-connectivity";
import { showError } from "@/lib/errors";
import {
  DEFAULT_NOVEND_EXPERIENCE,
  validateExperienceTokens,
  type ExperienceRadiusScale,
  type ExperienceTokenField,
} from "@/convex/shared/experience";

const OVERRIDE_FIELDS: ExperienceTokenField[] = [
  "accent",
  "accentForeground",
  "sidebarBackground",
  "sidebarForeground",
  "sidebarAccent",
  "sidebarAccentForeground",
];

const FIELD_LABELS: Record<ExperienceTokenField, string> = {
  accent: "Accent",
  accentForeground: "Accent foreground",
  sidebarBackground: "Sidebar background",
  sidebarForeground: "Sidebar foreground",
  sidebarAccent: "Sidebar accent",
  sidebarAccentForeground: "Sidebar accent foreground",
  focusRing: "Focus ring",
  success: "Success",
  warning: "Warning",
  danger: "Danger",
};

type OverrideDraft = Partial<Record<(typeof OVERRIDE_FIELDS)[number], string>>;

function emptyOverrides(): OverrideDraft {
  return {};
}

/** Platform Experience tab — assign preset and optional hex overrides. */
export function PlatformExperiencePanel({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const online = useConnectivity();
  const config = useQuery(
    api.platform.getOrganizationConfig,
    online ? { organizationId } : "skip",
  );
  const presets = useQuery(api.experiencePresets.list, online ? {} : "skip");
  const assign = useMutation(api.experiencePresets.assignToOrganization);
  const seedDefault = useMutation(api.experiencePresets.seedNovendDefault);
  const createPreset = useMutation(api.experiencePresets.create);

  const [presetId, setPresetId] = useState<string>("none");
  const [overrides, setOverrides] = useState<OverrideDraft>(emptyOverrides());
  const [pending, setPending] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetKey, setNewPresetKey] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [draftSourceKey, setDraftSourceKey] = useState<string | null>(null);

  // Sync draft from server when experience assignment changes (avoid effect setState).
  const nextSourceKey = config
    ? `${config.assignment.experienceVersion}:${config.assignment.experiencePresetId ?? "none"}`
    : null;
  if (config && nextSourceKey !== draftSourceKey) {
    setDraftSourceKey(nextSourceKey);
    setPresetId(config.assignment.experiencePresetId ?? "none");
    setOverrides({ ...(config.assignment.experienceOverrides ?? {}) });
  }

  if (!online && config === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Experience</CardTitle>
          <CardDescription>
            Experience controls need a connection. Showing nothing from cache for this tab.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (config === undefined || presets === undefined) {
    return <LoadingState label="Loading experience…" variant="form" />;
  }
  if (config === null) {
    return <LoadingState label="Organization not found…" variant="form" />;
  }

  const activePresets = presets.filter((row) => row.status === "active");
  const selectedPreset =
    presetId !== "none" ? presets.find((row) => row._id === presetId) : null;

  const previewBase = selectedPreset ?? config.preset ?? DEFAULT_NOVEND_EXPERIENCE;
  const previewTokens = {
    ...previewBase,
    ...Object.fromEntries(
      OVERRIDE_FIELDS.filter((field) => overrides[field]?.trim()).map((field) => [
        field,
        overrides[field]!.trim(),
      ]),
    ),
  };
  const contrastCheck = validateExperienceTokens({
    accent: previewTokens.accent,
    accentForeground: previewTokens.accentForeground,
    sidebarBackground: previewTokens.sidebarBackground,
    sidebarForeground: previewTokens.sidebarForeground,
    sidebarAccent: previewTokens.sidebarAccent,
    sidebarAccentForeground: previewTokens.sidebarAccentForeground,
    focusRing: "focusRing" in previewTokens ? previewTokens.focusRing : DEFAULT_NOVEND_EXPERIENCE.focusRing,
    success: "success" in previewTokens ? previewTokens.success : DEFAULT_NOVEND_EXPERIENCE.success,
    warning: "warning" in previewTokens ? previewTokens.warning : DEFAULT_NOVEND_EXPERIENCE.warning,
    danger: "danger" in previewTokens ? previewTokens.danger : DEFAULT_NOVEND_EXPERIENCE.danger,
    radiusScale:
      ("radiusScale" in previewTokens
        ? previewTokens.radiusScale
        : DEFAULT_NOVEND_EXPERIENCE.radiusScale) as ExperienceRadiusScale,
  });

  async function onSave() {
    if (!online) {
      toast.error("Experience changes require a connection");
      return;
    }
    if (!contrastCheck.ok) {
      toast.error(contrastCheck.errors[0] ?? "Contrast validation failed");
      return;
    }
    setPending(true);
    try {
      const cleaned: OverrideDraft = {};
      for (const field of OVERRIDE_FIELDS) {
        const value = overrides[field]?.trim();
        if (value) cleaned[field] = value;
      }
      await assign({
        organizationId,
        experiencePresetId:
          presetId === "none" ? null : (presetId as Id<"experiencePresets">),
        experienceOverrides: Object.keys(cleaned).length > 0 ? cleaned : null,
      });
      toast.success("Experience saved");
    } catch (error) {
      showError(error, "Save failed");
    } finally {
      setPending(false);
    }
  }

  async function onResetOverrides() {
    setOverrides(emptyOverrides());
  }

  async function onEnsureDefault() {
    try {
      await seedDefault({});
      toast.success("Novend default preset ready");
    } catch (error) {
      showError(error, "Seed failed");
    }
  }

  async function onCreatePreset() {
    setCreatePending(true);
    try {
      const tokens = DEFAULT_NOVEND_EXPERIENCE;
      await createPreset({
        key: newPresetKey.trim() || newPresetName.trim().toLowerCase().replace(/\s+/g, "-"),
        name: newPresetName.trim(),
        ...tokens,
      });
      toast.success("Preset created");
      setManageOpen(false);
      setNewPresetName("");
      setNewPresetKey("");
    } catch (error) {
      showError(error, "Create failed");
    } finally {
      setCreatePending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Experience
              <Badge variant="outline">v{config.assignment.experienceVersion}</Badge>
            </CardTitle>
            <CardDescription>
              Assign a reusable preset. Overrides are for negotiated customers only.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void onEnsureDefault()}>
              Seed default
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setManageOpen(true)}>
              Manage presets
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="experience-preset">Preset</Label>
            <Select value={presetId} onValueChange={setPresetId} disabled={!online || pending}>
              <SelectTrigger id="experience-preset">
                <SelectValue placeholder="Select preset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Platform default (no assignment)</SelectItem>
                {activePresets.map((preset) => (
                  <SelectItem key={preset._id} value={preset._id}>
                    {preset.name} ({preset.key})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {OVERRIDE_FIELDS.map((field) => (
              <div key={field} className="space-y-2">
                <Label htmlFor={`override-${field}`}>{FIELD_LABELS[field]} override</Label>
                <div className="flex gap-2">
                  <Input
                    id={`override-${field}`}
                    value={overrides[field] ?? ""}
                    onChange={(event) =>
                      setOverrides((prev) => ({ ...prev, [field]: event.target.value }))
                    }
                    placeholder={previewBase[field]}
                    disabled={!online || pending}
                    className="font-mono text-sm"
                  />
                  <input
                    type="color"
                    aria-label={`${FIELD_LABELS[field]} color picker`}
                    value={
                      /^#[0-9a-fA-F]{6}$/.test(overrides[field] ?? "")
                        ? overrides[field]!
                        : previewBase[field]
                    }
                    onChange={(event) =>
                      setOverrides((prev) => ({ ...prev, [field]: event.target.value }))
                    }
                    disabled={!online || pending}
                    className="border-input h-9 w-10 cursor-pointer rounded-md border bg-transparent p-1"
                  />
                </div>
              </div>
            ))}
          </div>

          {!contrastCheck.ok ? (
            <div
              role="alert"
              className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm"
            >
              <p className="font-medium">Contrast errors</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {contrastCheck.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-lg border">
            <div
              className="flex min-h-[120px]"
              style={{ backgroundColor: previewTokens.sidebarBackground }}
            >
              <div
                className="flex w-36 flex-col gap-2 p-3 text-sm"
                style={{ color: previewTokens.sidebarForeground }}
              >
                <span className="font-semibold">Sidebar</span>
                <span
                  className="rounded px-2 py-1 text-xs"
                  style={{
                    backgroundColor: previewTokens.sidebarAccent,
                    color: previewTokens.sidebarAccentForeground,
                  }}
                >
                  Active item
                </span>
              </div>
              <div className="bg-background text-foreground flex flex-1 flex-col justify-center gap-3 p-4">
                <button
                  type="button"
                  className="rounded-md px-3 py-2 text-sm font-medium"
                  style={{
                    backgroundColor: previewTokens.accent,
                    color: previewTokens.accentForeground,
                  }}
                >
                  Primary action
                </button>
                <p className="text-muted-foreground text-xs">
                  Live preview of resolved tokens (not a full shell).
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!online || pending || !contrastCheck.ok}
              onClick={() => void onSave()}
            >
              Save experience
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!online || pending}
              onClick={() => void onResetOverrides()}
            >
              Clear overrides
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Experience presets</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
              {presets.map((preset) => (
                <li
                  key={preset._id}
                  className="border-border flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{preset.name}</p>
                    <p className="text-muted-foreground font-mono text-xs">{preset.key}</p>
                  </div>
                  <Badge variant={preset.status === "active" ? "success" : "secondary"}>
                    {preset.status}
                  </Badge>
                </li>
              ))}
            </ul>
            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium">Create from Novend defaults</p>
              <div className="space-y-2">
                <Label htmlFor="new-preset-name">Name</Label>
                <Input
                  id="new-preset-name"
                  value={newPresetName}
                  onChange={(event) => setNewPresetName(event.target.value)}
                  placeholder="Retail blue"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-preset-key">Key</Label>
                <Input
                  id="new-preset-key"
                  value={newPresetKey}
                  onChange={(event) => setNewPresetKey(event.target.value)}
                  placeholder="retail-blue"
                  className="font-mono"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setManageOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              disabled={createPending || !newPresetName.trim()}
              onClick={() => void onCreatePreset()}
            >
              Create preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
