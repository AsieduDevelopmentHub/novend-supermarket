import { app } from "electron";
import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";

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

function allocatePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a local port."));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
    server.on("error", reject);
  });
}

function waitForHealth(origin: string, timeoutMs = 45_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const url = `${origin}/api/health`;

  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (Date.now() > deadline) {
        reject(new Error(`Local till server did not become healthy at ${url}`));
        return;
      }
      const req = http.get(url, { timeout: 2_000 }, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
          return;
        }
        setTimeout(attempt, 200);
      });
      req.on("error", () => setTimeout(attempt, 200));
      req.on("timeout", () => {
        req.destroy();
        setTimeout(attempt, 200);
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
  const port = await allocatePort();
  const origin = `http://127.0.0.1:${port}`;

  child = spawn(process.execPath, [serverJs], {
    cwd: serverCwd,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      HOST: "127.0.0.1",
    },
    stdio: app.isPackaged ? "ignore" : "inherit",
    windowsHide: true,
  });

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
    stopLocalServer();
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
