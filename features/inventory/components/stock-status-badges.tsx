import { Badge } from "@/components/ui/badge";

export function StockStatusBadges({
  isLowStock,
  isExpired,
  isExpiring,
}: {
  isLowStock: boolean;
  isExpired?: boolean;
  isExpiring?: boolean;
}) {
  if (!isExpired && !isExpiring && !isLowStock) {
    return <Badge variant="success">In Stock</Badge>;
  }

  return (
    <div className="flex flex-nowrap items-center gap-1">
      {isExpired ? <Badge variant="destructive">Expired</Badge> : null}
      {isExpiring ? <Badge variant="warning">Expiring</Badge> : null}
      {isLowStock ? <Badge variant="warning">Low Stock</Badge> : null}
    </div>
  );
}
