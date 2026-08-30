import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveJava21Home } from "./java21-home.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ideaDir = resolve(repoRoot, "apps/mobile/android/.idea");
const javaHome = resolveJava21Home();

function replaceOrThrow(path, search, replace) {
  if (!existsSync(path)) {
    return;
  }
  const before = readFileSync(path, "utf8");
  if (!before.includes(search) && !before.includes(replace)) {
    console.warn(`Skipped ${path}: expected marker not found.`);
    return;
  }
  writeFileSync(path, before.replaceAll(search, replace), "utf8");
}

const gradleXml = resolve(ideaDir, "gradle.xml");
if (existsSync(gradleXml)) {
  const next = readFileSync(gradleXml, "utf8").replace(
    /<option name="gradleJvm" value="[^"]*" \/>/,
    `<option name="gradleJvm" value="${javaHome}" />`,
  );
  writeFileSync(gradleXml, next, "utf8");
}
replaceOrThrow(
  resolve(ideaDir, "misc.xml"),
  `languageLevel="JDK_17" default="true" project-jdk-name="temurin-17"`,
  `languageLevel="JDK_21" default="true" project-jdk-name="temurin-21"`,
);
replaceOrThrow(
  resolve(ideaDir, "compiler.xml"),
  `<bytecodeTargetLevel target="17" />`,
  `<bytecodeTargetLevel target="21" />`,
);

console.log(`Android Studio Gradle JDK set to ${javaHome}`);
console.log("If Android Studio is already open: File → Sync Project with Gradle Files.");
