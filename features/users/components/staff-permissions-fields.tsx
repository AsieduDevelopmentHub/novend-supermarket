"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  APP_PERMISSION_LABELS,
  APP_PERMISSIONS,
  permissionsForRole,
  type AppPermission,
} from "@/lib/offline/millies-permissions";
import type { MilliesLocalRole } from "@/lib/offline/millies-auth-db";

type StaffPermissionsFieldsProps = {
  role: MilliesLocalRole;
  value: AppPermission[];
  onChange: (next: AppPermission[]) => void;
  /** Permissions the actor may grant. */
  grantable: readonly AppPermission[];
  disabled?: boolean;
};

export function StaffPermissionsFields({
  role,
  value,
  onChange,
  grantable,
  disabled,
}: StaffPermissionsFieldsProps) {
  const grantableSet = new Set(grantable);
  const selected = new Set(value);

  function toggle(permission: AppPermission, checked: boolean) {
    if (!grantableSet.has(permission)) return;
    const next = new Set(selected);
    if (checked) next.add(permission);
    else next.delete(permission);
    onChange(APP_PERMISSIONS.filter((key) => next.has(key)));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Permissions</Label>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
          disabled={disabled}
          onClick={() =>
            onChange(permissionsForRole(role).filter((key) => grantableSet.has(key)))
          }
        >
          Reset to {role} defaults
        </button>
      </div>
      <p className="text-muted-foreground text-xs">
        Role sets the starting access. Turn individual permissions on or off for this staff
        account.
      </p>
      <ul className="border-border max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3">
        {APP_PERMISSIONS.map((permission) => {
          const allowed = grantableSet.has(permission);
          return (
            <li key={permission} className="flex items-start gap-2">
              <Checkbox
                id={`staff-perm-${permission}`}
                checked={selected.has(permission)}
                disabled={disabled || !allowed}
                onCheckedChange={(state) => toggle(permission, state === true)}
              />
              <Label
                htmlFor={`staff-perm-${permission}`}
                className={!allowed ? "text-muted-foreground font-normal" : "font-normal"}
              >
                {APP_PERMISSION_LABELS[permission]}
              </Label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
