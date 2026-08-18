# Color System

Version: 1.1.0

Implemented in `styles/globals.css`. Source: `docs/design/branding/colors.md`.

Novend brand: **Onyx** structure + **Candy Blue** accent. Geometric, minimal. Avoid purple gradients and neon glows.

## Semantic tokens

| Token | Hex | Use |
|-------|-----|-----|
| `--primary` | `#38BDF8` | CTAs, active nav, emphasis |
| `--primary-foreground` | `#111827` | Text on Candy Blue |
| `--secondary` | `#111827` | Secondary buttons |
| `--sidebar` | `#111827` | App sidebar |
| `--background` | `#F8FAFC` | App canvas |
| `--card` | `#FFFFFF` | Surfaces |
| `--muted-foreground` | `#64748B` | Secondary text |
| `--border` | `#E2E8F0` | Card and input borders |
| `--success` | `#16A34A` | In stock / active |
| `--warning` | `#EA580C` | Low stock |
| `--destructive` | `#DC2626` | Errors |
| `--ring` | `#38BDF8` | Focus ring |

## Rules

- WCAG AA contrast for text and critical controls
- Color reinforces hierarchy; it is not decoration
- Do not introduce one-off hex values in feature CSS
- Dark mode maps the same semantic tokens
