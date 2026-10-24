import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");
const SKIP_DIRECTORIES = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".git",
]);

const FORBIDDEN_FILENAMES = new Set([
  "PRICING_STRATEGY.md",
  "CREDIT_ECONOMICS.md",
  "ENTITLEMENTS_AND_BILLING.md",
  "CREDIT_SYSTEM.md",
  "Draft Pricing Strategy.md",
]);

const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "Stripe live secret", pattern: /sk_live_[A-Za-z0-9]{8,}/ },
  {
    name: "OpenRouter key assignment",
    pattern: /OPENROUTER_API_KEY\s*=\s*\S+/,
  },
  { name: "Clerk secret assignment", pattern: /CLERK_SECRET_KEY\s*=\s*\S+/ },
  { name: "Stripe secret assignment", pattern: /STRIPE_SECRET_KEY\s*=\s*\S+/ },
];

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (SKIP_DIRECTORIES.has(entry.name) || entry.name === ".DS_Store") {
      continue;
    }
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  const failures: string[] = [];
  const files = await walk(ROOT);

  for (const filePath of files) {
    const name = filePath.split("/").at(-1) ?? "";
    if (FORBIDDEN_FILENAMES.has(name)) {
      failures.push(
        `Private pricing document is present in the public tree: ${relative(ROOT, filePath)}`,
      );
    }
  }

  const textFiles = files.filter((filePath) =>
    /\.(md|ts|tsx|js|jsx|json|yml|yaml|env|txt|html|css)$/i.test(filePath),
  );

  for (const filePath of textFiles) {
    const relativePath = relative(ROOT, filePath);
    if (
      relativePath === "scripts/validate-public-boundary.ts" ||
      relativePath === "tests/security/public-boundary.test.ts"
    ) {
      continue;
    }
    const contents = await readFile(filePath, "utf8");
    if (
      contents.includes("file:../cloud") ||
      contents.includes("file:../../cloud")
    ) {
      failures.push(
        `Public package depends on sibling cloud path: ${relativePath}`,
      );
    }
    for (const secret of SECRET_PATTERNS) {
      if (secret.pattern.test(contents)) {
        failures.push(`${secret.name} found in ${relativePath}`);
      }
    }
  }

  const envStat = await stat(join(ROOT, ".env")).catch(() => null);
  if (envStat?.isFile()) {
    failures.push(
      "Tracked or present .env file is not allowed in the public repository.",
    );
  }

  if (failures.length > 0) {
    console.error("Public boundary check failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`Public boundary check passed (${files.length} files scanned).`);
}

await main();
