#!/usr/bin/env node
/**
 * Sets the GitHub Release title + body from CHANGELOG.md for a given tag.
 *
 * Required env:
 *   GH_TOKEN / GITHUB_TOKEN
 *   GITHUB_REPOSITORY          owner/repo
 *   RELEASE_TAG                vX.Y.Z
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return value;
}

const tag = required("RELEASE_TAG");
const repo = required("GITHUB_REPOSITORY");
const version = tag.replace(/^v/, "");
const changelogPath = path.resolve(process.cwd(), "CHANGELOG.md");

if (!fs.existsSync(changelogPath)) {
  console.error("CHANGELOG.md not found");
  process.exit(1);
}

const changelog = fs.readFileSync(changelogPath, "utf8");
const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const headingRe = new RegExp(
  `^## (?:${escapedTag}|${escapedVersion})(?:\\s+[—–-]\\s+.+)?\\s*$`,
  "m",
);
const match = headingRe.exec(changelog);
if (!match) {
  console.error(`No CHANGELOG section found for ${tag}`);
  process.exit(1);
}

const start = match.index + match[0].length;
const rest = changelog.slice(start);
const nextHeading = rest.search(/^## /m);
const sectionBody = (nextHeading === -1 ? rest : rest.slice(0, nextHeading)).trim();

if (!sectionBody) {
  console.error(`CHANGELOG section for ${tag} is empty`);
  process.exit(1);
}

const title = `Novend POS ${tag}`;
const body = [
  `# ${title}`,
  "",
  sectionBody,
  "",
  "---",
  "",
  `Full changelog: see \`CHANGELOG.md\` in the repository.`,
].join("\n");

const notesPath = path.join(process.cwd(), `.release-notes-${version}.md`);
fs.writeFileSync(notesPath, body, "utf8");

try {
  execFileSync(
    "gh",
    ["release", "edit", tag, "--repo", repo, "--title", title, "--notes-file", notesPath],
    { stdio: "inherit", env: process.env },
  );
  console.log(`Updated GitHub Release ${tag}: ${title}`);
} finally {
  fs.unlinkSync(notesPath);
}
