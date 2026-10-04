"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/currency";
import { showError } from "@/lib/errors";
import { toast } from "sonner";

/** Compact modifier group editor for a product (modifiers capability). */
export function ProductModifiersEditor({ productId }: { productId: Id<"products"> }) {
  const groups = useAuthedQuery(api.dining.listModifierGroupsForProduct, { productId });
  const upsertGroup = useMutation(api.dining.upsertModifierGroup);
  const upsertOption = useMutation(api.dining.upsertModifierOption);
  const [groupName, setGroupName] = useState("");
  const [required, setRequired] = useState(false);
  const [optionDrafts, setOptionDrafts] = useState<Record<string, { name: string; delta: string }>>(
    {},
  );

  if (groups === undefined) {
    return <p className="text-muted-foreground text-sm">Loading modifiers…</p>;
  }

  async function onAddGroup() {
    if (!groupName.trim()) return;
    try {
      await upsertGroup({
        productId,
        name: groupName.trim(),
        required,
      });
      setGroupName("");
      setRequired(false);
      toast.success("Modifier group added");
    } catch (error) {
      showError(error, "Could not add group");
    }
  }

  async function onAddOption(groupId: Id<"modifierGroups">) {
    const draft = optionDrafts[groupId];
    if (!draft?.name.trim()) return;
    try {
      await upsertOption({
        groupId,
        name: draft.name.trim(),
        priceDelta: Number(draft.delta) || 0,
      });
      setOptionDrafts((prev) => ({ ...prev, [groupId]: { name: "", delta: "0" } }));
      toast.success("Option added");
    } catch (error) {
      showError(error, "Could not add option");
    }
  }

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div>
        <p className="text-sm font-medium">Modifiers</p>
        <p className="text-muted-foreground text-xs">
          Optional add-ons shown when adding this item on the floor.
        </p>
      </div>
      {groups.map((group) => (
        <div key={group._id} className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">
            {group.name}
            {group.required ? " (required)" : ""}
          </p>
          <ul className="text-muted-foreground space-y-1 text-xs">
            {group.options.map((opt) => (
              <li key={opt._id}>
                {opt.name}
                {opt.priceDelta
                  ? ` · ${opt.priceDelta > 0 ? "+" : ""}${formatCurrency(opt.priceDelta)}`
                  : ""}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Option name"
              className="h-9 max-w-[140px]"
              value={optionDrafts[group._id]?.name ?? ""}
              onChange={(e) =>
                setOptionDrafts((prev) => ({
                  ...prev,
                  [group._id]: {
                    name: e.target.value,
                    delta: prev[group._id]?.delta ?? "0",
                  },
                }))
              }
            />
            <Input
              placeholder="Δ price"
              className="h-9 w-24"
              value={optionDrafts[group._id]?.delta ?? "0"}
              onChange={(e) =>
                setOptionDrafts((prev) => ({
                  ...prev,
                  [group._id]: {
                    name: prev[group._id]?.name ?? "",
                    delta: e.target.value,
                  },
                }))
              }
            />
            <Button type="button" size="sm" variant="outline" onClick={() => void onAddOption(group._id)}>
              Add option
            </Button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-end gap-2 border-t pt-3">
        <div className="space-y-1">
          <Label htmlFor="mod-group">New group</Label>
          <Input
            id="mod-group"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="e.g. Size"
            className="h-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={required} onCheckedChange={(c) => setRequired(c === true)} />
          Required
        </label>
        <Button type="button" size="sm" onClick={() => void onAddGroup()} disabled={!groupName.trim()}>
          Add group
        </Button>
      </div>
    </div>
  );
}
