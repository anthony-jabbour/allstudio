import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";

await mkdir("out/runtime", { recursive: true });
execFileSync(
  "cc",
  [
    "-std=c11",
    "-Wall",
    "-Wextra",
    "-Werror",
    "-O2",
    "native/files.c",
    "-o",
    "out/runtime/files",
  ],
  { stdio: "inherit" },
);
for (const name of ["preview-loader", "preview-runner"]) {
  execFileSync(
    "bun",
    [
      "build",
      `src/main/${name}.ts`,
      "--target=node",
      "--format=cjs",
      `--outfile=out/runtime/${name}.cjs`,
    ],
    { stdio: "inherit" },
  );
}
execFileSync(
  "bun",
  [
    "build",
    "src/main/preview-bridge-entry.ts",
    "--target=browser",
    "--format=iife",
    "--outfile=out/runtime/preview-bridge.js",
  ],
  { stdio: "inherit" },
);
