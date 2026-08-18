# Sales Workflow

Version: 1.0.0

Cashier POS: build a cart, optional customer, Hold or Pay. Completed sales are
immutable and print a receipt.

## Rules

- Only `active` products with sellable stock > 0 appear in the catalog
- Cart quantities cannot exceed sellable stock
- Dated products allocate lots FEFO; expired units cannot be sold
- Customer defaults to Walk-in
- Pay writes `sales` + `saleItems` + `receipts` and decrements inventory
- Completed sales are immutable
- Hold stores the cart; inventory is not reduced until checkout
- Offline checkout writes Dexie + outbox, then syncs with `clientOperationId`

## Flow

1. Open Sales
2. Optionally attach or create a customer
3. Search or tap products
4. Adjust quantities; optional discount
5. Hold, or Pay (cash / card / mobile money)
6. Print receipt
