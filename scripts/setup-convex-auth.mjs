/**
 * Generate Convex Auth RS256 keys and set them on the current Convex deployment.
 * Usage (cmd): node scripts/setup-convex-auth.mjs
 */
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = join(tmpdir(), `novend-auth-keys-${randomBytes(6).toString("hex")}`);
mkdirSync(dir, { recursive: true });

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

const pem = privateKey.export({ type: "pkcs8", format: "pem" });
const jwk = publicKey.export({ format: "jwk" });
jwk.use = "sig";
jwk.alg = "RS256";
jwk.kid = "novend-auth";

const pemPath = join(dir, "jwt_private.pem");
const jwksPath = join(dir, "jwks.json");
writeFileSync(pemPath, pem, "utf8");
writeFileSync(jwksPath, JSON.stringify({ keys: [jwk] }), "utf8");

function setEnv(name, file) {
  const result = spawnSync(
    "pnpm",
    ["exec", "convex", "env", "set", name, "--from-file", file],
    { stdio: "inherit", shell: true },
  );
  if (result.status !== 0) {
    throw new Error(`Failed to set ${name}`);
  }
}

setEnv("JWT_PRIVATE_KEY", pemPath);
setEnv("JWKS", jwksPath);

rmSync(dir, { recursive: true, force: true });
console.log("Set JWT_PRIVATE_KEY and JWKS on the Convex deployment.");
