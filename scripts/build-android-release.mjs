import { existsSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { envWithJava21 } from "./java21-home.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const localEnvPath = resolve(repoRoot, ".env.local");
if (existsSync(localEnvPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(localEnvPath);
}
const required = [
  "ANDROID_KEYSTORE_PATH",
  "ANDROID_KEYSTORE_PASSWORD",
  "ANDROID_KEY_ALIAS",
  "ANDROID_KEY_PASSWORD",
];

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(
    `Missing Android release signing variables: ${missing.join(", ")}. ` +
      "Set them in .env.local (see .env.example).",
  );
  process.exit(1);
}

const keystorePath = isAbsolute(process.env.ANDROID_KEYSTORE_PATH)
  ? process.env.ANDROID_KEYSTORE_PATH
  : resolve(repoRoot, process.env.ANDROID_KEYSTORE_PATH);

if (!existsSync(keystorePath) || !statSync(keystorePath).isFile()) {
  console.error(`Android keystore not found: ${keystorePath}`);
  console.error("Create one with keytool or set ANDROID_KEYSTORE_PATH to an existing keystore.");
  process.exit(1);
}

let env;
try {
  env = {
    ...envWithJava21(process.env),
    ANDROID_KEYSTORE_PATH: keystorePath,
    NOVEND_MOBILE_BUILD: "production",
  };
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

function run(command, args, cwd = repoRoot) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: "inherit",
    windowsHide: true,
    // Windows needs a shell to spawn .cmd / .bat (otherwise EINVAL).
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error(`Unable to start ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["mobile:sync"]);
run(process.execPath, ["scripts/verify-mobile-origin.mjs"]);

const gradle = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
run(gradle, ["assembleRelease", "--no-daemon"], resolve(repoRoot, "apps/mobile/android"));

console.log(
  "Signed Android APK built at apps/mobile/android/app/build/outputs/apk/release/app-release.apk",
);
