# Novend POS

## Design System

Version: 1.0.0

# Purpose

Visual language: tokens, color, type, spacing, elevation, icons, motion, and
component variants. Workflow UX lives in `UI_GUIDELINES.md`.

# Intent

Mature SaaS operations software — trustworthy, calm, efficient.

Inspiration (principles, not skins): Stripe Dashboard, Linear, Vercel, Notion,
Shopify Admin, Square POS.

Characteristics: large whitespace, clear hierarchy, rounded components, minimal
borders, subtle elevation, professional type, soft purposeful color.

# Tokens

All visual decisions resolve to tokens (CSS variables), never one-off values.

Categories: color, typography, spacing, radius, shadow, motion, z-index.

When a screen needs a new value, add a token first, then consume it.

Satellites:

- `COLOR_SYSTEM.md`
- `TYPOGRAPHY.md`
- `SPACING_SYSTEM.md`
- `COMPONENT_LIBRARY.md`
- `UI_GUIDELINES.md`

# Brand vs Princellen

Reuse Princellen **structure** (navy sidebar, light canvas, density, components).
Replace Princellen orange / PEEVA accents with Novend teal. No industry-specific
chart colors.
