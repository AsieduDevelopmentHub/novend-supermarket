# UI Guidelines

Version: 1.0.0

Cashiers work under time pressure. Optimize for speed and low error rate.

## Users must always know

Where they are, what they are doing, what happens next, and whether it succeeded.

## Page structure

```text
Header → Primary actions → Summary → Main content → Secondary information
```

## States

Every data view handles loading, empty, success, error, disabled, and
permission-denied where relevant.

## POS specifics

- Search is the primary product entry
- Cart is always visible on desktop
- Pay is the dominant action
- Destructive actions confirm
- Receipt print follows a successful sale immediately
