import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const JAVA_BIN = process.platform === "win32" ? "java.exe" : "java";

function javaMajor(javaHome) {
  const java = join(javaHome, "bin", JAVA_BIN);
  if (!existsSync(java)) {
    return null;
  }
  const result = spawnSync(java, ["-version"], { encoding: "utf8" });
  const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const match = text.match(/version "(\d+)/);
  return match ? Number(match[1]) : null;
}

function pushIfDir(candidates, path) {
  if (path && existsSync(path)) {
    candidates.push(path);
  }
}

function homesUnder(root, prefix) {
  if (!root || !existsSync(root)) {
    return [];
  }
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.toLowerCase().startsWith(prefix))
    .map((entry) => join(root, entry.name));
}

export function resolveJava21Home() {
  const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
  const localAppData = process.env.LOCALAPPDATA ?? "";
  const candidates = [];

  pushIfDir(candidates, process.env.JAVA_HOME);
  candidates.push(
    ...homesUnder(join(programFiles, "Eclipse Adoptium"), "jdk-21"),
    ...homesUnder(join(programFiles, "Microsoft"), "jdk-21"),
    ...homesUnder(join(programFiles, "Java"), "jdk-21"),
    ...homesUnder(join(programFiles, "Android", "Android Studio"), "jbr"),
    ...homesUnder(join(localAppData, "Programs", "Android", "Android Studio"), "jbr"),
  );
  pushIfDir(candidates, join(programFiles, "Android", "Android Studio", "jbr"));
  pushIfDir(candidates, join(localAppData, "Programs", "Android", "Android Studio", "jbr"));

  const unique = [...new Set(candidates)];
  const match = unique.find((home) => javaMajor(home) === 21);
  if (!match) {
    throw new Error(
      "Capacitor 7 needs JDK 21 (source/target 21). Current JAVA_HOME is not 21. " +
        "Install Temurin 21 (`winget install EclipseAdoptium.Temurin.21.JDK`) " +
        "or set JAVA_HOME to a JDK 21 install.",
    );
  }
  return match;
}

export function envWithJava21(base = process.env) {
  const javaHome = resolveJava21Home();
  const pathKey = Object.keys(base).find((key) => key.toLowerCase() === "path") ?? "PATH";
  return {
    ...base,
    JAVA_HOME: javaHome,
    [pathKey]: `${join(javaHome, "bin")}${process.platform === "win32" ? ";" : ":"}${base[pathKey] ?? ""}`,
  };
}
