import { expect, it } from "vitest";
import {
  assetFromMetadata,
  assetPathFromUrl,
  assetUrl,
  isUsableAsset,
  MAX_ASSET_BYTES,
} from "../src/site/assets.ts";

it("derives only normalized project-owned image URLs and metadata", () => {
  const asset = assetFromMetadata("public/images/a b'c.svg", 120);
  expect(asset).toEqual({
    path: "public/images/a b'c.svg",
    url: "/images/a%20b%27c.svg",
    type: "image/svg+xml",
    size: 120,
  });
  expect(assetPathFromUrl("/images/a%20b%27c.svg")).toBe(
    "public/images/a b'c.svg",
  );
  expect(assetUrl("public/é.png")).toBe("/%C3%A9.png");
  expect(assetFromMetadata("public/photo.JPG", 20)?.type).toBe("image/jpeg");
});
it.each([
  "../private.svg",
  "/public/a.svg",
  "public/../a.svg",
  "public/a/./b.svg",
  "public//a.svg",
  "public/a%2fb.svg",
  "public/a.svg?x=1",
  "public/a.svg#x",
  "public/a\\b.svg",
  "public/a:part.svg",
  "public/a\n.svg",
  "public/code.js",
  "public/a.css",
  `public/${"x".repeat(1024)}.svg`,
])("refuses unsafe/unsupported asset path %s", (path) =>
  expect(assetUrl(path)).toBeNull());
it.each([
  "https://evil.test/a.svg",
  "//evil.test/a.svg",
  "/../a.svg",
  "/%2e%2e/a.svg",
  "/a%2fb.svg",
  "/a.svg?x=1",
  "/a.svg#x",
  "/a%252fb.svg",
])("refuses noncanonical/new remote URLs", (url) =>
  expect(assetPathFromUrl(url)).toBeNull());
it("lists known empty/oversized files but refuses their association and unsafe numeric metadata", () => {
  for (const size of [0, MAX_ASSET_BYTES + 1]) {
    const asset = assetFromMetadata("public/a.png", size);
    expect(asset).not.toBeNull();
    expect(asset && isUsableAsset(asset)).toBe(false);
  }
  const good = assetFromMetadata("public/a.png", MAX_ASSET_BYTES);
  expect(good && isUsableAsset(good)).toBe(true);
  for (const size of [-1, NaN, Infinity, 1.1, Number.MAX_SAFE_INTEGER + 1])
    expect(assetFromMetadata("public/a.png", size)).toBeNull();
});
