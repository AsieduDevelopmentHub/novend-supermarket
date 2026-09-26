/**
 * Customer-facing release highlights.
 *
 * Prefers a `### What's new` (or `## What's new`) section when present.
 * Falls back to stripping engineer-facing CHANGELOG noise so Downloads /
 * Releases / native update prompts never show API names, CI jargon, or
 * platform-duplicate dumps.
 */

const TECH_NOISE =
  /\b(electron|capacitor|convex|next\.?js|react|typescript|pnpm|npm|yarn|gradle|android studio|xcode|github actions?|ci\/cd|dockerfile|webpack|turbopack|vercel|dexie|indexeddb|service worker|webauthn|jwks|jwt|openapi|graphql|prisma|supabase|firebase|nodejs|node\.js|rust|golang|kotlin|swiftui|cocoapods|podfile|eslint|prettier|vitest|jest|playwright|chromedriver|sourcemap|stack trace|segfault|null pointer|undefined is not|console\.log|todo\b|fixme\b|hack\b|workaround|breaking change|chore:|feat:|refactor:|deps?:|bump |merge pull request|co-authored-by|targets:\s*all|versioncode|stay=1|rsc |webview|localstorage|securestorage|paystack|vapid|nsis|appimage|blockmap|semver|electron-updater|retagged)\b/i;

/** API / mutation style identifiers: repairs.clearTradingHistory, backup_only */
const API_IDENT =
  /\b[a-z][a-z0-9]*(?:\.[a-z][a-zA-Z0-9]*|_[a-z0-9]+)+\b|\b[a-z]+[A-Z][a-zA-Z]+\b/;

const CUSTOMER_HEADING =
  /^#{2,3}\s+what['’]?s\s+new(?:\s+for\s+customers)?\s*$/im;

const SECTION_HEADING = /^#{2,3}\s+\S/m;

const MAX_HIGHLIGHTS = 6;

function stripMarkdownDecorations(notes: string): string {
  return notes
    .replace(/\r\n/g, "\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^(\s*)[-*+]\s+\[[ xX]\]\s+/gm, "$1")
    .replace(/^(\s*)[-*+]\s+/gm, "$1")
    .replace(/^(\s*)\d+[.)]\s+/gm, "$1")
    .replace(/^(-{3,}|\*{3,}|_{3,})\s*$/gm, "")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

/** Pull the customer `What's new` block from markdown notes or changelog body. */
export function extractWhatsNewSection(notes: string): string | null {
  const match = CUSTOMER_HEADING.exec(notes);
  if (!match || match.index === undefined) return null;
  const after = notes.slice(match.index + match[0].length);
  const next = after.search(SECTION_HEADING);
  const body = (next === -1 ? after : after.slice(0, next)).trim();
  return body || null;
}

function isCustomerLine(line: string): boolean {
  if (!line || /^[|*:\-]+$/.test(line)) return false;
  if (/^#{1,6}\s/.test(line)) return false;
  if (/^v?\d+\.\d+(\.\d+)?\s*$/i.test(line)) return false;
  if (/^(full changelog|see also|internal|developers? only|added|fixed|changed|removed)\b/i.test(line)) {
    return false;
  }
  if (TECH_NOISE.test(line)) return false;
  if (API_IDENT.test(line)) return false;
  if (line.length > 160) return false;
  return true;
}

/**
 * Turn release notes into short, plain customer bullets (max 6).
 * Prefer `### What's new`; otherwise filter engineering CHANGELOG noise.
 */
export function sanitizeReleaseNoteLines(notes: string | undefined | null): string[] {
  if (!notes?.trim()) return [];

  const preferred = extractWhatsNewSection(notes);
  const source = preferred ?? notes;
  const text = stripMarkdownDecorations(source).replace(/^#{1,6}\s+/gm, "");

  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(isCustomerLine);

  // Prefer bullet-like short lines; drop long intro paragraphs when we already have bullets.
  const short = lines.filter((line) => line.length <= 120);
  const picked = (short.length >= 2 ? short : lines).slice(0, MAX_HIGHLIGHTS);

  // Deduplicate identical lines (desktop + Android often share the same body).
  return [...new Set(picked)];
}
