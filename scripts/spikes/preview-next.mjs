/** Bounded feasibility proof on the repository-owned fixture only. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join, relative, resolve } from "node:path";

const fixture = resolve("examples/nextjs-site-fixture");
const requireFixture = createRequire(join(fixture, "package.json"));
const next = requireFixture("next");
const scratch = resolve("apps/desktop/dist/spikes");
await mkdir(scratch, { recursive: true });
const output = await mkdtemp(join(scratch, "preview-"));
execFileSync(
  "bun",
  [
    "build",
    "scripts/spikes/preview-loader.ts",
    "--target=node",
    "--format=cjs",
    `--outfile=${output}/preview-loader.cjs`,
  ],
  { stdio: "inherit" },
);
const loader = join(output, "loader.cjs");
await writeFile(
  loader,
  'module.exports = require("./preview-loader.cjs").default;\n',
);
async function snapshot(directory, root = directory) {
  const hashes = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) Object.assign(hashes, await snapshot(path, root));
    else if (entry.isFile())
      hashes[relative(root, path)] = createHash("sha256")
        .update(await readFile(path))
        .digest("hex");
  }
  return hashes;
}

function renderedIds(html) {
  const elements = [
    ...html.matchAll(
      /<([a-z][a-z0-9-]*)\b[^>]*\bdata-oid="(p:[a-f0-9]{32})"[^>]*>/g,
    ),
  ].map((match) => ({ tag: match[1], oid: match[2] }));
  assert.deepEqual(
    elements.map((element) => element.tag),
    ["html", "body", "main", "p", "h1", "p", "button"],
    "Both layout elements and every page element must carry a preview ID",
  );
  assert.equal(
    new Set(elements.map((element) => element.oid)).size,
    7,
    "All seven rendered preview IDs must be unique",
  );
  return elements;
}
const before = await snapshot(join(fixture, "src"));
const configBefore = await readFile(join(fixture, "next.config.ts"), "utf8");
// This disposable repository-owned fixture proves the loader, not transparent
// integration into arbitrary user projects. Only its copied config is changed.
const copy = join(output, "project");
await mkdir(copy, { recursive: true });
for (const entry of [
  "src",
  "public",
  "package.json",
  "tsconfig.json",
  "next-env.d.ts",
]) {
  try {
    await cp(join(fixture, entry), join(copy, entry), { recursive: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
try {
  await symlink(
    join(fixture, "node_modules"),
    join(copy, "node_modules"),
    "dir",
  );
} catch (error) {
  if (error.code !== "EEXIST") throw error;
}
await writeFile(
  join(copy, "next.config.ts"),
  configBefore.replace(
    "export default nextConfig;",
    `export default { ...nextConfig, turbopack: { ...nextConfig.turbopack, rules: { ...nextConfig.turbopack?.rules, "*.tsx": { loaders: [${JSON.stringify(loader)}], as: "*.tsx" }, "*.jsx": { loaders: [${JSON.stringify(loader)}], as: "*.jsx" } } } };`,
  ),
);
const copiedBefore = await snapshot(join(copy, "src"));
assert.deepEqual(
  copiedBefore,
  before,
  "Copied source must exactly match the current original fixture.",
);
const runtime = next({ dev: true, dir: copy, turbopack: true });
const server = createServer(runtime.getRequestHandler());
try {
  await runtime.prepare();
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const first = await fetch(url);
  const html = await first.text();
  assert.equal(first.status, 200, html.slice(0, 1000));
  await writeFile(join(output, "page.html"), html);
  const ids = renderedIds(html);
  const second = await (await fetch(url)).text();
  assert.deepEqual(renderedIds(second), ids);
  assert.deepEqual(await snapshot(join(fixture, "src")), before);
  assert.deepEqual(await snapshot(join(copy, "src")), copiedBefore);
  assert.equal(
    await readFile(join(fixture, "next.config.ts"), "utf8"),
    configBefore,
  );
  console.log(
    `PASS Next.js preview-only transform: ${ids.length} stable rendered IDs; original source/config and copied source hashes unchanged (copied config explicitly integrates the loader).`,
  );
} catch (error) {
  process.exitCode = 1;
  throw error;
} finally {
  const cleanupDeadline = setTimeout(() => {
    console.error(
      "Next custom-server cleanup did not drain; exiting the isolated spike process.",
    );
    process.exit(process.exitCode ?? 0);
  }, 3000);
  cleanupDeadline.unref();
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  await runtime.close();
}
