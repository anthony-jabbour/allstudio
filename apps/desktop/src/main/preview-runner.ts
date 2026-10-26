import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join } from "node:path";

const [root, portText] = process.argv.slice(2);
const port = Number(portText);
if (!root || !Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid preview arguments");
const projectRequire = createRequire(join(root, "package.json"));
const next = projectRequire("next");
const runtime = next({
  dev: true,
  dir: root,
  hostname: "127.0.0.1",
  port,
  turbopack: true,
});
const server = createServer(runtime.getRequestHandler());
runtime
  .prepare()
  .then(() => {
    server.listen(port, "127.0.0.1", () =>
      process.stdout.write("ALLSTUDIO_PREVIEW_READY\n"),
    );
  })
  .catch(() => process.exit(1));
server.on("error", () => process.exit(1));
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  server.closeAllConnections();
  server.close();
  void runtime.close().catch(() => {});
  setTimeout(() => {
    try {
      process.kill(-process.pid, "SIGKILL");
    } catch {
      /* Process group already ended. */
    }
    process.exit(0);
  }, 1500);
}
process.once("SIGTERM", stop);
// The owning Electron process holds this pipe open; EOF also stops an orphan after a crash.
process.stdin.on("end", stop);
process.stdin.resume();
