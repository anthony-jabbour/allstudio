import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

describe("public/private boundary", () => {
  it("does not contain private pricing documents", () => {
    const forbidden = [
      "PRICING_STRATEGY.md",
      "CREDIT_ECONOMICS.md",
      "ENTITLEMENTS_AND_BILLING.md",
      "CREDIT_SYSTEM.md",
    ];
    for (const name of forbidden) {
      expect(existsSync(join(ROOT, name))).toBe(false);
      expect(existsSync(join(ROOT, "docs", "business", "pricing", name))).toBe(
        false,
      );
    }
  });

  it("passes the public-boundary scanner", () => {
    const result = spawnSync("bun", ["scripts/validate-public-boundary.ts"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(result.status, result.stderr || result.stdout).toBe(0);
  });
});
