#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) => !file.endsWith(".lock") && !file.endsWith(".map"));

const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:PAYSTACK_SECRET_KEY|BOOTSTRAP_(?:ADMIN|PLATFORM)_SECRET|DESKTOP_RELEASE_PUBLISH_SECRET)\s*[:=]\s*["']?[^\s"']{16,}/,
  /ghp_[A-Za-z0-9]{30,}/,
];
const findings = [];
for (const file of files) {
  let text;
  try {
    text = execFileSync("git", ["show", `HEAD:${file}`], {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch {
    continue;
  }
  for (const pattern of patterns) {
    if (pattern.test(text)) findings.push(file);
  }
}
if (findings.length) {
  console.error(
    `Potential secret material found in tracked files:\n${[...new Set(findings)].join("\n")}`,
  );
  process.exit(1);
}
console.log(`Secret hygiene check passed for ${files.length} tracked files.`);
