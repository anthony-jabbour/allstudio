import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join } from "node:path";

const [root] = process.argv.slice(2);
if (!root || process.argv.length !== 3)
  throw new Error("Invalid preview arguments");
const projectRequire = createRequire(join(root, "package.json"));
const next = projectRequire("next");
const server = createServer();
let closeRuntime: (() => Promise<void>) | undefined;
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string")
    return fail("Invalid preview address");
  const runtime = next({
    dev: true,
    dir: root,
    hostname: "127.0.0.1",
    port: address.port,
    turbopack: true,
  });
  closeRuntime = () => runtime.close();
  server.on("request", runtime.getRequestHandler());
  runtime
    .prepare()
    .then(() => {
      process.stdout.write(`ALLSTUDIO_PREVIEW_READY:${address.port}\n`);
    })
    .catch(fail);
});
function fail(error: unknown) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
server.on("error", fail);
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  server.closeAllConnections();
  server.close();
  void closeRuntime?.().catch(() => {});
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
