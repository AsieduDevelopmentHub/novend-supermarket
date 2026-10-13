"use client";

import { FormEvent, useState } from "react";
import { useMutation } from "convex/react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useConnectivity } from "@/hooks/use-connectivity";
import {
  useCategoriesList,
  useCustomerGroups,
  usePriceListRules,
  useProductsList,
} from "@/hooks/use-offline-lists";
import { formatCurrency } from "@/lib/currency";
import { showError } from "@/lib/errors";
import {
  persistBusinessWrite,
  queuedSaveMessage,
  queueUpsertCustomerGroup,
  queueUpsertPriceRule,
} from "@/lib/offline/replica-writes";

const ALL_CUSTOMERS = "all";

type RuleScope = "product" | "category";

type RuleDraft = {
  id: string | null;
  scope: RuleScope;
  targetId: string;
  groupId: string;
  minBaseQty: string;
  unitPrice: string;
  priority: string;
  active: boolean;
};

const EMPTY_RULE: RuleDraft = {
  id: null,
  scope: "product",
  targetId: "",
  groupId: ALL_CUSTOMERS,
  minBaseQty: "1",
  unitPrice: "",
  priority: "0",
  active: true,
};

/** Customer groups and quantity-tier price rules. Managers and administrators only. */
export function PriceListsPanel() {
  const online = useConnectivity();
  const groups = useCustomerGroups();
  const rules = usePriceListRules();
  const categories = useCategoriesList();
  const { products } = useProductsList({ search: "", includeInactive: false, canViewCost: false });
  const saveGroup = useMutation(api.priceLists.saveGroup);
  const saveRule = useMutation(api.priceLists.saveRule);

  const [groupName, setGroupName] = useState("");
  const [groupPending, setGroupPending] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [draft, setDraft] = useState<RuleDraft>(EMPTY_RULE);
  const [rulePending, setRulePending] = useState(false);

  const groupName_ = (id: string | null) =>
    id ? (groups?.find((group) => group.id === id)?.name ?? "Group") : "All customers";
  const targetLabel = (rule: { productId: string | null; categoryId: string | null }) => {
    if (rule.productId) {
      return products.find((product) => product.id === rule.productId)?.name ?? "Product";
    }
    return categories?.find((category) => category._id === rule.categoryId)?.name ?? "Category";
  };

  async function onAddGroup(event: FormEvent) {
    event.preventDefault();
    const name = groupName.trim();
    if (!name) return;
    setGroupPending(true);
    try {
      const kind = await persistBusinessWrite({
        online,
        remote: () => saveGroup({ name }),
        local: () => queueUpsertCustomerGroup({ name }),
      });
      toast.success(queuedSaveMessage(kind, "Group added"));
      setGroupName("");
    } catch (error) {
      showError(error, "Could not add group");
    } finally {
      setGroupPending(false);
    }
  }

  function openRule(next: RuleDraft) {
    setDraft(next);
    setRuleOpen(true);
  }

  async function onSaveRule(event: FormEvent) {
    event.preventDefault();
    setRulePending(true);
    try {
      const minBaseQty = Number(draft.minBaseQty);
      const unitPrice = Number(draft.unitPrice);
      const priority = Number(draft.priority);
      if (!draft.targetId) throw new Error(`Choose a ${draft.scope}`);
      if (!Number.isInteger(minBaseQty) || minBaseQty < 1) {
        throw new Error("Minimum quantity must be a whole number of at least 1");
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("Enter a valid price");
      if (!Number.isInteger(priority)) throw new Error("Priority must be a whole number");
      const target =
        draft.scope === "product" ? { productId: draft.targetId } : { categoryId: draft.targetId };
      const groupId = draft.groupId === ALL_CUSTOMERS ? undefined : draft.groupId;
      const kind = await persistBusinessWrite({
        online,
        remote: () =>
          saveRule({
            id: draft.id ? (draft.id as Id<"priceListRules">) : undefined,
            productId: target.productId as Id<"products"> | undefined,
            categoryId: target.categoryId as Id<"categories"> | undefined,
            groupId: groupId as Id<"customerGroups"> | undefined,
            minBaseQty,
            unitPrice,
            priority,
            active: draft.active,
          }),
        local: () =>
          queueUpsertPriceRule({
            serverId: draft.id ?? undefined,
            ...target,
            groupId,
            minBaseQty,
            unitPrice,
            priority,
            active: draft.active,
          }),
      });
      toast.success(queuedSaveMessage(kind, "Price rule saved"));
      setRuleOpen(false);
    } catch (error) {
      showError(error, "Could not save price rule");
    } finally {
      setRulePending(false);
    }
  }

  const targetOptions =
    draft.scope === "product"
      ? products.map((product) => ({
          value: product.id as string,
          label: product.name,
          keywords: product.sku,
        }))
      : (categories ?? []).map((category) => ({ value: category._id as string, label: category.name }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Customer groups</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex gap-2" onSubmit={(event) => void onAddGroup(event)}>
            <Input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="e.g. Wholesale, Distributor"
              aria-label="New group name"
              maxLength={60}
            />
            <Button type="submit" disabled={groupPending || !groupName.trim()}>
              <Plus className="h-4 w-4" aria-hidden />
              Add group
            </Button>
          </form>
          {groups?.length ? (
            <ul className="flex flex-wrap gap-2">
              {groups.map((group) => (
                <li key={group.id}>
                  <Badge variant={group.status === "active" ? "secondary" : "outline"}>
                    {group.name}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              Groups let you give wholesale buyers their own prices.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Price rules</CardTitle>
          <Button type="button" size="sm" onClick={() => openRule(EMPTY_RULE)}>
            <Plus className="h-4 w-4" aria-hidden />
            Add rule
          </Button>
        </CardHeader>
        <CardContent>
          {rules && rules.length === 0 ? (
            <EmptyState
              title="No price rules yet"
              description="Without a rule, every customer pays the product's sell price."
            />
          ) : (
            <ul className="divide-border divide-y text-sm">
              {(rules ?? []).map((rule) => (
                <li key={rule.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{targetLabel(rule)}</p>
                    <p className="text-muted-foreground text-xs">
                      {groupName_(rule.groupId)} · from {rule.minBaseQty} base units · priority{" "}
                      {rule.priority}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{formatCurrency(rule.unitPrice)} / unit</span>
                    {!rule.active ? <Badge variant="outline">Off</Badge> : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        openRule({
                          id: rule.id,
                          scope: rule.productId ? "product" : "category",
                          targetId: rule.productId ?? rule.categoryId ?? "",
                          groupId: rule.groupId ?? ALL_CUSTOMERS,
                          minBaseQty: String(rule.minBaseQty),
                          unitPrice: String(rule.unitPrice),
                          priority: String(rule.priority),
                          active: rule.active,
                        })
                      }
                    >
                      Edit
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent>
          <form onSubmit={(event) => void onSaveRule(event)}>
            <DialogHeader>
              <DialogTitle>{draft.id ? "Edit price rule" : "Add price rule"}</DialogTitle>
              <DialogDescription>
                The price is per base unit. A carton line is charged price × units in the carton.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="space-y-2">
                <Label>Applies to</Label>
                <Select
                  value={draft.scope}
                  onValueChange={(value) =>
                    setDraft({ ...draft, scope: value as RuleScope, targetId: "" })
                  }
                >
                  <SelectTrigger aria-label="Rule scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">One product</SelectItem>
                    <SelectItem value="category">A whole category</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{draft.scope === "product" ? "Product" : "Category"}</Label>
                <SearchableSelect
                  options={targetOptions}
                  value={draft.targetId}
                  onValueChange={(value) => setDraft({ ...draft, targetId: value })}
                  placeholder={draft.scope === "product" ? "Choose a product" : "Choose a category"}
                />
              </div>
              <div className="space-y-2">
                <Label>Customers</Label>
                <Select
                  value={draft.groupId}
                  onValueChange={(value) => setDraft({ ...draft, groupId: value })}
                >
                  <SelectTrigger aria-label="Customer group">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_CUSTOMERS}>All customers (volume price)</SelectItem>
                    {(groups ?? []).map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="rule-min-qty">From qty</Label>
                  <Input
                    id="rule-min-qty"
                    type="number"
                    min={1}
                    step={1}
                    value={draft.minBaseQty}
                    onChange={(event) => setDraft({ ...draft, minBaseQty: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rule-price">Price / unit</Label>
                  <Input
                    id="rule-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.unitPrice}
                    onChange={(event) => setDraft({ ...draft, unitPrice: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rule-priority">Priority</Label>
                  <Input
                    id="rule-priority"
                    type="number"
                    step={1}
                    value={draft.priority}
                    onChange={(event) => setDraft({ ...draft, priority: event.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="rule-active">Rule is active</Label>
                <Switch
                  id="rule-active"
                  checked={draft.active}
                  onCheckedChange={(checked) => setDraft({ ...draft, active: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={rulePending}>
                {rulePending ? "Saving…" : "Save rule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
