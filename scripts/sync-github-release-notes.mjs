#!/usr/bin/env node
/**
 * Sets the GitHub Release title + customer-facing body from CHANGELOG.md.
 *
 * Publishes only the `### What's new` section for the tag — not the full
 * engineering Added/Fixed/Changed dump. Desktop + Android share one GitHub
 * Release, so one friendly body covers both surfaces.
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

const whatsNewHeading = /^###\s+what['’]?s\s+new(?:\s+for\s+customers)?\s*$/im;
const whatsNewMatch = whatsNewHeading.exec(sectionBody);
if (!whatsNewMatch || whatsNewMatch.index === undefined) {
  console.error(
    `CHANGELOG section for ${tag} is missing a customer "### What's new" block.\n` +
      `Add 3–6 plain-language bullets under ### What's new before engineering Added/Fixed sections.`,
  );
  process.exit(1);
}

const afterWhatsNew = sectionBody.slice(whatsNewMatch.index + whatsNewMatch[0].length);
const nextSection = afterWhatsNew.search(/^###\s+\S/m);
const whatsNewBody = (nextSection === -1 ? afterWhatsNew : afterWhatsNew.slice(0, nextSection))
  .trim()
  .replace(/\r\n/g, "\n");

if (!whatsNewBody || !/[-*+]|\d+[.)]/.test(whatsNewBody)) {
  console.error(`### What's new for ${tag} must include at least one bullet`);
  process.exit(1);
}

const title = `Novend POS ${tag}`;
const body = [`## What's new`, "", whatsNewBody].join("\n");

const notesPath = path.join(process.cwd(), `.release-notes-${version}.md`);
fs.writeFileSync(notesPath, body, "utf8");

try {
  execFileSync(
    "gh",
    ["release", "edit", tag, "--repo", repo, "--title", title, "--notes-file", notesPath],
    { stdio: "inherit", env: process.env },
  );
  console.log(`Updated GitHub Release ${tag}: customer What's new only`);
} finally {
  fs.unlinkSync(notesPath);
}
