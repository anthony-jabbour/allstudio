// Proves that the edited fixture copies still build: runs `next build` in
// each playground workspace and checks the prerendered HTML contains the
// edits made by text-edit.e2e.mjs.
//
// Run after text-edit.e2e.mjs, with `bun run dev` STOPPED (the dev server
// and `next build` must not share a workspace at the same time).
//
// Usage: node scripts/e2e/build-edited-workspaces.mjs
import { strict as assert } from "node:assert";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const workspaceRoot = join(repoRoot, "apps/playground/.workspace");

// Strings the E2E writes into source and that must reach the built page.
const EXPECTED = {
  "aurora-atelier": ["Start a new project", "text-emerald-700", "gap-10"],
  "lumen-notes": ["Lumen Notebook", "Write a note", "Up to date"],
  "harbor-studio": ["Harbor &amp; Co", "md:grid-cols-3", "bg-indigo-600"],
};

for (const [id, needles] of Object.entries(EXPECTED)) {
  const dir = join(workspaceRoot, id);
  const nextBin = createRequire(join(dir, "package.json")).resolve(
    "next/dist/bin/next",
  );
  const started = Date.now();
  await run(process.execPath, [nextBin, "build"], {
    cwd: dir,
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    maxBuffer: 32 * 1024 * 1024,
  });
  const html = await readFile(join(dir, ".next/server/app/index.html"), "utf8");
  for (const needle of needles) {
    assert.ok(html.includes(needle), `${id}: built HTML contains ${needle}`);
  }
  console.log(
    `PASS ${id} — next build ok in ${Date.now() - started} ms; built HTML contains ${needles.join(", ")}`,
  );
}
console.log("\nAll edited workspaces build and contain their edits.");
