"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { usePermissions } from "@/hooks/use-permissions";
import { EXPENSE_CATEGORY_OPTIONS, type ExpenseCategory } from "../constants";
import { toast } from "sonner";
import { showError } from "@/lib/errors";

export type ExpenseRow = {
  id: Id<"expenses">;
  amount: number;
  category: ExpenseCategory;
  occurredAt: number;
  description: string | null;
  branchId?: Id<"branches"> | null;
};

function toDateInput(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fromDateInput(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: ExpenseRow | null;
};

export function ExpenseFormDialog({ open, onOpenChange, expense }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit expense" : "Record expense"}</DialogTitle>
        </DialogHeader>
        {open ? (
          <ExpenseFormFields
            key={expense?.id ?? "new"}
            expense={expense}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ExpenseFormFields({
  expense,
  onOpenChange,
}: {
  expense?: ExpenseRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { isManager, branchId: myBranchId } = usePermissions();
  const branches = useQuery(api.branches.list, {});
  const createExpense = useMutation(api.analytics.createExpense);
  const updateExpense = useMutation(api.analytics.updateExpense);
  const isEdit = Boolean(expense);

  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? "misc");
  const [occurredOn, setOccurredOn] = useState(() =>
    toDateInput(expense?.occurredAt ?? new Date().setHours(0, 0, 0, 0)),
  );
  const [description, setDescription] = useState(expense?.description ?? "");
  const [branchOverride, setBranchOverride] = useState<Id<"branches"> | null>(
    expense?.branchId ?? null,
  );
  const [pending, setPending] = useState(false);

  const resolvedBranchId = isManager
    ? (myBranchId ?? null)
    : (branchOverride ?? myBranchId ?? branches?.[0]?.id ?? null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid amount greater than zero");
      return;
    }
    if (!resolvedBranchId) {
      toast.error("Select a branch");
      return;
    }
    setPending(true);
    try {
      const payload = {
        amount: value,
        category,
        occurredAt: fromDateInput(occurredOn),
        description: description.trim() || undefined,
        branchId: resolvedBranchId,
      };
      if (isEdit && expense) {
        await updateExpense({ id: expense.id, ...payload });
        toast.success("Expense updated");
      } else {
        await createExpense(payload);
        toast.success("Expense recorded");
      }
      onOpenChange(false);
    } catch (error) {
      showError(error, "Could not save expense");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="expenseAmount">Amount (GHC)</Label>
        <Input
          id="expenseAmount"
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Branch</Label>
        <SearchableSelect
          options={(branches ?? []).map((b) => ({
            value: b.id,
            label: b.name,
            keywords: b.code,
          }))}
          value={resolvedBranchId ?? undefined}
          onValueChange={(v) => setBranchOverride(v as Id<"branches">)}
          disabled={isManager}
          placeholder="Select branch"
          searchPlaceholder="Search branches…"
        />
      </div>
      <div className="space-y-2">
        <Label>Category</Label>
        <SearchableSelect
          options={EXPENSE_CATEGORY_OPTIONS.map((opt) => ({
            value: opt.value,
            label: opt.label,
          }))}
          value={category}
          onValueChange={(v) => setCategory(v as ExpenseCategory)}
          placeholder="Select category"
          searchPlaceholder="Search categories…"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="expenseDate">Date</Label>
        <Input
          id="expenseDate"
          type="date"
          value={occurredOn}
          onChange={(e) => setOccurredOn(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="expenseNotes">Notes</Label>
        <Textarea
          id="expenseNotes"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Optional details"
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !resolvedBranchId}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Record expense"}
        </Button>
      </DialogFooter>
    </form>
  );
}
