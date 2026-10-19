import { app } from "electron";
import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { PACKAGED_LOCAL_ORIGIN, PACKAGED_LOCAL_PORT } from "./desktop-config";

export type LocalServerHandle = {
  origin: string;
  port: number;
  root: string;
};

let child: ChildProcess | null = null;
let running: LocalServerHandle | null = null;

function findServerJs(dir: string, depth = 0): string | null {
  if (depth > 4) return null;
  const candidate = path.join(dir, "server.js");
  if (fs.existsSync(candidate)) return candidate;
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return null;
  }
  for (const name of entries) {
    if (name === "node_modules") continue;
    const childPath = path.join(dir, name);
    try {
      if (!fs.statSync(childPath).isDirectory()) continue;
    } catch {
      continue;
    }
    const found = findServerJs(childPath, depth + 1);
    if (found) return found;
  }
  return null;
}

/** Resolve the Next standalone tree (packaged resources or repo prepare output). */
export function resolveAppServerRoot(): string | null {
  const candidates = [
    path.join(process.resourcesPath, "app-server"),
    path.resolve(__dirname, "..", "resources", "app-server"),
    path.resolve(__dirname, "..", "..", "..", ".next", "standalone"),
  ];
  for (const root of candidates) {
    if (!fs.existsSync(root)) continue;
    if (findServerJs(root)) return root;
  }
  return null;
}

/**
 * Bind the fixed packaged port (or fail). Never fall back to a random port —
 * that would change the renderer origin and wipe IndexedDB / Dexie accounts.
 */
function assertFixedPortAvailable(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        reject(
          new Error(
            `Millie's local till port ${port} is already in use. Close any other Millie's Supermarket window (or free 127.0.0.1:${port}), then try again.`,
          ),
        );
        return;
      }
      reject(error);
    });
    server.listen(port, "127.0.0.1", () => {
      server.close((closeError) => {
        if (closeError) reject(closeError);
        else resolve();
      });
    });
  });
}

function waitForHealth(origin: string, timeoutMs = 45_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const url = `${origin}/api/health`;
  /** Tight poll — Next often becomes ready between 200ms ticks on cold start. */
  const pollMs = 50;

  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (Date.now() > deadline) {
        reject(new Error(`Local till server did not become healthy at ${url}`));
        return;
      }
      const req = http.get(url, { timeout: 1_500 }, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
          return;
        }
        setTimeout(attempt, pollMs);
      });
      req.on("error", () => setTimeout(attempt, pollMs));
      req.on("timeout", () => {
        req.destroy();
        setTimeout(attempt, pollMs);
      });
    };
    attempt();
  });
}

/**
 * Start the bundled Next standalone server on 127.0.0.1.
 * Uses Electron as Node (`ELECTRON_RUN_AS_NODE`) so cashiers need no system Node.
 */
export async function startLocalServer(): Promise<LocalServerHandle> {
  if (running) return running;

  const root = resolveAppServerRoot();
  if (!root) {
    throw new Error(
      "Bundled till server missing. Run `pnpm desktop:prepare` before packaging, or `pnpm desktop:dev` with Next on :3000.",
    );
  }
  const serverJs = findServerJs(root);
  if (!serverJs) {
    throw new Error(`server.js not found under ${root}`);
  }
  const serverCwd = path.dirname(serverJs);
  const port = PACKAGED_LOCAL_PORT;
  const origin = PACKAGED_LOCAL_ORIGIN;
  await assertFixedPortAvailable(port);

  // pnpm standalone copies often lose top-level junctions; Next then cannot
  // resolve packages like `@swc/helpers`. Point NODE_PATH at the pnpm virtual
  // store so Electron-as-Node resolves the same graph as `node .next/standalone`.
  const pnpmNodeModules = path.join(root, "node_modules", ".pnpm", "node_modules");
  const nodePathParts = [
    pnpmNodeModules,
    path.join(root, "node_modules"),
    path.join(serverCwd, "node_modules"),
    ...(process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : []),
  ].filter((value, index, all) => Boolean(value) && fs.existsSync(value) && all.indexOf(value) === index);

  child = spawn(process.execPath, [serverJs], {
    cwd: serverCwd,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      HOST: "127.0.0.1",
      NODE_PATH: nodePathParts.join(path.delimiter),
    },
    stdio: app.isPackaged ? "pipe" : "inherit",
    windowsHide: true,
  });

  let serverErrorTail = "";
  if (child.stderr) {
    child.stderr.on("data", (chunk: Buffer | string) => {
      const text = String(chunk);
      serverErrorTail = `${serverErrorTail}${text}`.slice(-4000);
      if (!app.isPackaged) process.stderr.write(text);
    });
  }

  child.on("exit", (code, signal) => {
    if (running) {
      console.error(`[millies-local-server] exited code=${code} signal=${signal}`);
    }
    child = null;
    running = null;
  });

  try {
    await waitForHealth(origin);
  } catch (error) {
    const detail = serverErrorTail.trim();
    stopLocalServer();
    if (detail) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\n\nServer log:\n${detail}`,
      );
    }
    throw error;
  }

  running = { origin, port, root: serverCwd };
  return running;
}

export function stopLocalServer(): void {
  const proc = child;
  child = null;
  running = null;
  if (!proc || proc.killed) return;
  try {
    proc.kill();
  } catch {
    /* ignore */
  }
}

export function getRunningLocalServer(): LocalServerHandle | null {
  return running;
}
