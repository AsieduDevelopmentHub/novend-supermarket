# Component Library

Version: 1.0.0

## Foundation (`components/ui`)

Button, Input, Textarea, Select, Checkbox, Switch, Dialog, Sheet, Dropdown,
Tabs, Table primitives, Badge, Card, Avatar, Tooltip, Separator, Label, Alert.

Business-agnostic. No Convex. No domain rules.

## Layout (`components/layout`)

App sidebar, mobile sidebar, page header primitives.

## Feedback (`components/feedback`)

Loading, empty, error, confirm dialog.

## Offline (`components/offline`)

Sync status banner, conflict panel.

## Feature components (`features/*/components`)

POS cart, product forms, inventory tables — domain-aware, still no business
outcome decisions (those stay in Convex).

## Rule

Before creating a component: does it exist? Can it be extended? Should it be
extracted to `components/`?
