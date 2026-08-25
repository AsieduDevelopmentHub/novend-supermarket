# Multi-Branch Architecture

Version: 1.0.0

Novend supports multiple locations under one organization.

## This slice

Onboarding creates a single `MAIN` branch. Users are assigned to it.
There is no `/branches` UI and no stock transfers yet.

The schema still stores `branchId` on stock, sales, holds, and profiles so
multi-branch UI can land without a redesign.

## Model (full)

| Concept                         | Scope                                        |
| ------------------------------- | -------------------------------------------- |
| Product catalog                 | Organization-wide                            |
| Stock quantity                  | Per branch (`branchStock`)                   |
| Sales, holds, inventory history | Stamped with `branchId`                      |
| Customers                       | Organization-wide (sales still stamp branch) |
| Users                           | Assigned to one `branchId`                   |

## Roles (when multi-branch UI ships)

- **Administrator** — all branches
- **Manager** — own branch operations
- **Cashier** — own branch only
