import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { envWithJava21 } from "./java21-home.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const mobileRoot = resolve(repoRoot, "apps/mobile");
const androidRoot = resolve(mobileRoot, "android");
const capArgs = process.argv.slice(2);
const args = capArgs.length > 0 ? capArgs : ["run", "android"];

let env;
try {
  env = envWithJava21(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

console.log(`Using JAVA_HOME=${env.JAVA_HOME}`);

const gradle = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
spawnSync(gradle, ["--stop"], {
  cwd: androidRoot,
  env,
  stdio: "ignore",
  windowsHide: true,
  shell: process.platform === "win32",
});

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(pnpm, ["exec", "cap", ...args], {
  cwd: mobileRoot,
  env,
  stdio: "inherit",
  windowsHide: true,
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(`Unable to start cap: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
