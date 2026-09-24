/**
 * Turn GitHub-style markdown release notes into plain, user-readable lines.
 * Strips headings, emphasis, links, code fences, list markers, and engineer-facing jargon.
 */
const TECH_NOISE =
  /\b(electron|capacitor|convex|next\.?js|react|typescript|pnpm|npm|yarn|gradle|android studio|xcode|github actions?|ci\/cd|dockerfile|webpack|turbopack|vercel|dexie|indexeddb|service worker|webauthn|jwks|jwt|openapi|graphql|prisma|supabase|firebase|nodejs|node\.js|rust|golang|kotlin|swiftui|cocoapods|podfile|eslint|prettier|vitest|jest|playwright|chromedriver|sourcemap|stack trace|segfault|null pointer|undefined is not|console\.log|todo\b|fixme\b|hack\b|workaround|breaking change|chore:|feat:|refactor:|deps?:|bump |merge pull request|co-authored-by)\b/i;

export function sanitizeReleaseNoteLines(notes: string | undefined | null): string[] {
  if (!notes?.trim()) return [];

  const text = notes
    .replace(/\r\n/g, "\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
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

  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => {
      if (!line || /^[|*:\-]+$/.test(line)) return false;
      if (TECH_NOISE.test(line)) return false;
      if (/^v?\d+\.\d+(\.\d+)?\s*$/i.test(line)) return false;
      if (/^(full changelog|see also|internal|developers? only)\b/i.test(line)) return false;
      return true;
    })
    .slice(0, 12);
}
