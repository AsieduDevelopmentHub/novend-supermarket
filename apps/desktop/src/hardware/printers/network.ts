import net from "node:net";

/** Send raw ESC/POS over TCP :9100 (or custom port). */
export function sendTcp(
  host: string,
  portNum: number,
  data: Buffer,
  timeoutMs = 3_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port: portNum }, () => {
      socket.write(data, (err) => {
        if (err) {
          reject(err);
          return;
        }
        socket.end();
        resolve();
      });
    });
    socket.setTimeout(timeoutMs);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error(`Network printer unreachable at ${host}:${portNum} (timeout)`));
    });
    socket.on("error", (err) => {
      reject(
        new Error(
          `Network printer unreachable at ${host}:${portNum} (${err.message || "connection failed"})`,
        ),
      );
    });
  });
}
