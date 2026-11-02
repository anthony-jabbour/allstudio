import { expect, it } from "vitest";
import { parseAssetEditBody } from "../src/site/requests.ts";

const request = {
  path: "src/app/page.tsx",
  oid: "image",
  expectedSha256: "a".repeat(64),
  assetPath: "public/studio.svg",
};
it("accepts only a bounded asset path and source revision", () => {
  expect(parseAssetEditBody(request)).toEqual(request);
  for (const body of [
    { ...request, root: "/tmp" },
    { ...request, url: "https://evil.test/a.svg" },
    { ...request, assetPath: "public/../private.svg" },
    { ...request, assetPath: "public/a.svg?x" },
    { ...request, assetPath: "/etc/a.svg" },
    { ...request, expectedSha256: "stale" },
    { ...request, oid: "x".repeat(65) },
    { ...request, assetPath: "public/a.js" },
  ])
    expect(parseAssetEditBody(body)).toBeNull();
});
