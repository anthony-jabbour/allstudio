import { describe, expect, it } from "vitest";
import {
  isSafeRelativePath,
  PROJECT_SCHEMA_VERSION,
  parseProjectManifest,
} from "../src/index.ts";

const validManifest = {
  schemaVersion: PROJECT_SCHEMA_VERSION,
  projectId: "11111111-1111-4111-8111-111111111111",
  name: "Aurora Atelier",
  artifacts: [
    {
      id: "site-root",
      kind: "site",
      path: "examples/nextjs-site-fixture",
    },
  ],
  sourceFramework: "nextjs-react",
  createdAt: "2026-10-24T00:00:00.000Z",
};

describe("parseProjectManifest", () => {
  it("parses a supported v1 fixture manifest", () => {
    const parsed = parseProjectManifest(validManifest);
    expect(parsed.name).toBe("Aurora Atelier");
    expect(parsed.artifacts[0]?.path).toBe("examples/nextjs-site-fixture");
  });

  it("rejects path traversal in artifact paths", () => {
    expect(() =>
      parseProjectManifest({
        ...validManifest,
        artifacts: [
          {
            id: "escape",
            kind: "site",
            path: "../cloud/docs/business/pricing/PRICING_STRATEGY.md",
          },
        ],
      }),
    ).toThrow(/safe relative path/);
  });

  it("rejects an unsupported schema version", () => {
    expect(() =>
      parseProjectManifest({
        ...validManifest,
        schemaVersion: 99,
      }),
    ).toThrow(/Unsupported schemaVersion/);
  });
});

describe("isSafeRelativePath", () => {
  it("accepts nested relative files", () => {
    expect(isSafeRelativePath("src/app/page.tsx")).toBe(true);
  });

  it("rejects absolute, parent, and empty segments", () => {
    expect(isSafeRelativePath("/etc/passwd")).toBe(false);
    expect(isSafeRelativePath("..")).toBe(false);
    expect(isSafeRelativePath("foo/../bar")).toBe(false);
    expect(isSafeRelativePath("")).toBe(false);
  });
});
