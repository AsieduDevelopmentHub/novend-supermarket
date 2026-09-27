/**
 * Experience token validation and defaults.
 *
 * Presets store semantic colors only — never raw CSS, URLs, or gradients.
 * Contrast checks enforce WCAG AA for normal interface text (4.5:1).
 */

export const EXPERIENCE_TOKEN_FIELDS = [
  "accent",
  "accentForeground",
  "sidebarBackground",
  "sidebarForeground",
  "sidebarAccent",
  "sidebarAccentForeground",
  "focusRing",
  "success",
  "warning",
  "danger",
] as const;

export type ExperienceTokenField = (typeof EXPERIENCE_TOKEN_FIELDS)[number];

export type ExperienceRadiusScale = "compact" | "default" | "soft";

export type ResolvedExperienceTokens = {
  accent: string;
  accentForeground: string;
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  focusRing: string;
  success: string;
  warning: string;
  danger: string;
  radiusScale: ExperienceRadiusScale;
};

/** Official Novend defaults — Candy Blue accent + Onyx navy sidebar. */
export const DEFAULT_NOVEND_EXPERIENCE: ResolvedExperienceTokens = {
  accent: "#38bdf8",
  accentForeground: "#111827",
  sidebarBackground: "#111827",
  sidebarForeground: "#e2e8f0",
  sidebarAccent: "#1e293b",
  sidebarAccentForeground: "#f8fafc",
  focusRing: "#38bdf8",
  success: "#16a34a",
  warning: "#ea580c",
  danger: "#dc2626",
  radiusScale: "default",
};

/** @deprecated Typo alias — prefer DEFAULT_NOVEND_EXPERIENCE. */
export const DEFAULT_NOVENT_EXPERIENCE = DEFAULT_NOVEND_EXPERIENCE;

/** Warm amber — restaurant / F&B industry pack. */
export const RESTAURANT_EXPERIENCE: ResolvedExperienceTokens = {
  accent: "#f59e0b",
  accentForeground: "#111827",
  sidebarBackground: "#1c1917",
  sidebarForeground: "#f5f5f4",
  sidebarAccent: "#292524",
  sidebarAccentForeground: "#fafaf9",
  focusRing: "#f59e0b",
  success: "#16a34a",
  warning: "#ea580c",
  danger: "#dc2626",
  radiusScale: "default",
};

/** Teal — hotel / lodging industry pack. */
export const HOTEL_EXPERIENCE: ResolvedExperienceTokens = {
  accent: "#0d9488",
  accentForeground: "#f8fafc",
  sidebarBackground: "#0f172a",
  sidebarForeground: "#e2e8f0",
  sidebarAccent: "#1e293b",
  sidebarAccentForeground: "#f8fafc",
  focusRing: "#0d9488",
  success: "#16a34a",
  warning: "#ea580c",
  danger: "#dc2626",
  radiusScale: "default",
};

export function experiencePresetForIndustry(
  profile: string | null | undefined,
): ResolvedExperienceTokens {
  if (profile === "restaurant" || profile === "bar") return { ...RESTAURANT_EXPERIENCE };
  if (profile === "hotel") return { ...HOTEL_EXPERIENCE };
  return { ...DEFAULT_NOVEND_EXPERIENCE };
}

/**
 * Build a 5-stop chart palette from an accent hex for CSS `--chart-*` tokens.
 * Pure and deterministic — used by applyExperienceTokens and tests.
 */
export function deriveChartPalette(accentHex: string): {
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
} {
  const validated = validateHexColor(accentHex);
  const accent = validated.ok ? validated.value : DEFAULT_NOVEND_EXPERIENCE.accent;
  const { r, g, b } = hexToRgb(accent);
  return {
    chart1: accent,
    chart2: rgbToHex(shiftChannel(r, -20), shiftChannel(g, -10), shiftChannel(b, 30)),
    chart3: rgbToHex(shiftChannel(r, -40), shiftChannel(g, -20), shiftChannel(b, -10)),
    chart4: DEFAULT_NOVEND_EXPERIENCE.success,
    chart5: DEFAULT_NOVEND_EXPERIENCE.warning,
  };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const raw = hex.slice(1);
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function shiftChannel(value: number, delta: number): number {
  return Math.max(0, Math.min(255, value + delta));
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const UNSAFE_COLOR_RE = /(url\s*\(|var\s*\(|gradient|expression\s*\()/i;

export type HexColorValidation =
  | { ok: true; value: string }
  | { ok: false; reason: string };

/** Accepts only `#RRGGBB`. Rejects shorthand, alpha, named colors, and CSS functions. */
export function validateHexColor(value: unknown): HexColorValidation {
  if (typeof value !== "string") {
    return { ok: false, reason: "Color must be a string." };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, reason: "Color is required." };
  }
  if (UNSAFE_COLOR_RE.test(trimmed)) {
    return { ok: false, reason: "Colors must be plain #RRGGBB hex values." };
  }
  if (!HEX_COLOR_RE.test(trimmed)) {
    return { ok: false, reason: "Color must be #RRGGBB (six hex digits)." };
  }
  return { ok: true, value: trimmed.toLowerCase() };
}

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Relative luminance per WCAG 2.x (sRGB). */
export function relativeLuminance(hex: string): number {
  const validated = validateHexColor(hex);
  if (!validated.ok) {
    throw new Error(validated.reason);
  }
  const raw = validated.value.slice(1);
  const r = channelToLinear(parseInt(raw.slice(0, 2), 16));
  const g = channelToLinear(parseInt(raw.slice(2, 4), 16));
  const b = channelToLinear(parseInt(raw.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio of two #RRGGBB colors (WCAG). */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const WCAG_AA_NORMAL_TEXT = 4.5;

export type ContrastPair = {
  name: string;
  foreground: string;
  background: string;
};

export function assertWcagAaContrast(pairs: ContrastPair[]): void {
  for (const pair of pairs) {
    const fg = validateHexColor(pair.foreground);
    const bg = validateHexColor(pair.background);
    if (!fg.ok) throw new Error(`${pair.name}: ${fg.reason}`);
    if (!bg.ok) throw new Error(`${pair.name}: ${bg.reason}`);
    const ratio = contrastRatio(fg.value, bg.value);
    if (ratio < WCAG_AA_NORMAL_TEXT) {
      throw new Error(
        `${pair.name} contrast ${ratio.toFixed(2)}:1 is below WCAG AA (${WCAG_AA_NORMAL_TEXT}:1).`,
      );
    }
  }
}

/** Builds the WCAG AA pairs that experience tokens must satisfy. */
export function experienceContrastPairs(tokens: {
  accent: string;
  accentForeground: string;
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarAccent?: string;
  sidebarAccentForeground?: string;
}): ContrastPair[] {
  const pairs: ContrastPair[] = [
    {
      name: "Accent / foreground",
      foreground: tokens.accentForeground,
      background: tokens.accent,
    },
    {
      name: "Sidebar / foreground",
      foreground: tokens.sidebarForeground,
      background: tokens.sidebarBackground,
    },
  ];
  if (tokens.sidebarAccent && tokens.sidebarAccentForeground) {
    pairs.push({
      name: "Sidebar accent / foreground",
      foreground: tokens.sidebarAccentForeground,
      background: tokens.sidebarAccent,
    });
  }
  return pairs;
}

/** Validates required accent/sidebar text pairs for a token set. */
export function assertExperienceContrast(tokens: {
  accent: string;
  accentForeground: string;
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarAccent?: string;
  sidebarAccentForeground?: string;
}): void {
  assertWcagAaContrast(experienceContrastPairs(tokens));
}

export type ExperienceTokensValidation =
  | { ok: true; tokens: ResolvedExperienceTokens }
  | { ok: false; errors: string[] };

/**
 * Non-throwing hex + contrast validation for platform UI and Convex mutations.
 * Normalizes hex to lowercase `#rrggbb` on success.
 */
export function validateExperienceTokens(input: {
  accent: string;
  accentForeground: string;
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  focusRing: string;
  success: string;
  warning: string;
  danger: string;
  radiusScale: ExperienceRadiusScale;
}): ExperienceTokensValidation {
  const errors: string[] = [];
  const normalized: Partial<ResolvedExperienceTokens> = {
    radiusScale: input.radiusScale,
  };

  for (const field of EXPERIENCE_TOKEN_FIELDS) {
    const result = validateHexColor(input[field]);
    if (!result.ok) {
      errors.push(`${field}: ${result.reason}`);
    } else {
      normalized[field] = result.value;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const tokens = normalized as ResolvedExperienceTokens;
  for (const pair of experienceContrastPairs(tokens)) {
    const ratio = contrastRatio(pair.foreground, pair.background);
    if (ratio < WCAG_AA_NORMAL_TEXT) {
      errors.push(
        `${pair.name} contrast ${ratio.toFixed(2)}:1 is below WCAG AA (${WCAG_AA_NORMAL_TEXT}:1).`,
      );
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, tokens };
}
