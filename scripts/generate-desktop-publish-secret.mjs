#!/usr/bin/env node
/**
 * Generate DESKTOP_RELEASE_PUBLISH_SECRET for Convex + GitHub Actions.
 *
 *   pnpm desktop:secret
 *   pnpm desktop:secret -- --set-convex
 *   pnpm desktop:secret -- --set-github
 *   pnpm desktop:secret -- --set-convex --set-github
 */
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const NAME = "DESKTOP_RELEASE_PUBLISH_SECRET";
const args = new Set(process.argv.slice(2));
const setConvex = args.has("--set-convex");
const setGithub = args.has("--set-github");

const secret = randomBytes(32).toString("base64url");

console.log("");
console.log(`${NAME}=${secret}`);
console.log("");
console.log("Put the same value in both places:");
console.log(`  Convex:  pnpm exec convex env set ${NAME} <value>`);
console.log(`  GitHub:  gh secret set ${NAME}`);
console.log("");

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    stdio: options.input ? ["pipe", "inherit", "inherit"] : "inherit",
    shell: true,
    input: options.input,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(" ")} failed`);
  }
}

if (setConvex) {
  const dir = join(tmpdir(), `novend-desktop-secret-${randomBytes(4).toString("hex")}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "secret.txt");
  try {
    writeFileSync(file, secret, "utf8");
    run("pnpm", ["exec", "convex", "env", "set", NAME, "--from-file", file]);
    console.log(`Set ${NAME} on the current Convex deployment.`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (setGithub) {
  run("gh", ["secret", "set", NAME], { input: secret });
  console.log(`Set ${NAME} as a GitHub Actions repository secret.`);
}

if (!setConvex && !setGithub) {
  console.log("Optional next steps:");
  console.log("  pnpm desktop:secret -- --set-convex");
  console.log("  pnpm desktop:secret -- --set-github");
  console.log("");
}
