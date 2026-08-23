#!/usr/bin/env node
/**
 * Create a commit from the index without Cursor co-author injection.
 * Usage: node scripts/commit-clean.mjs path/to/message.txt
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const msgPath = process.argv[2];
if (!msgPath) {
  console.error("Usage: node scripts/commit-clean.mjs <message-file>");
  process.exit(1);
}

const message = readFileSync(msgPath, "utf8").replace(/^\uFEFF/, "");
if (/^Co-authored-by:/im.test(message)) {
  console.error("Message file already contains Co-authored-by — aborting.");
  process.exit(1);
}

const tree = execFileSync("git", ["write-tree"], { encoding: "utf8" }).trim();
const parent = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const newSha = execFileSync("git", ["commit-tree", tree, "-p", parent, "-m", message], {
  encoding: "utf8",
}).trim();

execFileSync("git", ["update-ref", "HEAD", newSha], { encoding: "utf8" });
console.log(newSha);
