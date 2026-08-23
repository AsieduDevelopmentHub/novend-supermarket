#!/usr/bin/env node
/**
 * Exit 1 if recent commits contain Co-authored-by trailers.
 * Run before git push so Cursor-injected trailers never leave the machine.
 *
 *   node scripts/assert-no-coauthor.mjs
 *   node scripts/assert-no-coauthor.mjs 5
 */
import { execFileSync } from "node:child_process";

const count = Math.max(1, Number.parseInt(process.argv[2] || "1", 10) || 1);
const log = execFileSync("git", ["log", `-n`, String(count), "--format=%H%x00%B%x00"], {
  encoding: "utf8",
});

const parts = log.split("\0").map((part) => part.trim()).filter(Boolean);
let failed = false;

for (let i = 0; i + 1 < parts.length; i += 2) {
  const hash = parts[i] || "";
  const body = parts[i + 1] || "";
  if (/^Co-authored-by:/im.test(body)) {
    console.error(`Commit ${hash.slice(0, 7)} contains a Co-authored-by trailer — do not push.`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(`Checked ${count} commit(s): no Co-authored-by trailers.`);
