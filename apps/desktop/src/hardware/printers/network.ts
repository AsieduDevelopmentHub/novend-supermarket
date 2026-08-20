import net from "node:net";

export function sendTcp(host: string, portNum: number, data: Buffer): Promise<void> {
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
    socket.setTimeout(8_000);
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
