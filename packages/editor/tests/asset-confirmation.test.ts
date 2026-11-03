import { expect, it } from "vitest";
import type { PreviewElementSnapshot } from "../src/preview-bridge/protocol.ts";
import { observesAsset } from "../src/shell/asset-confirmation.ts";

const image = {
  currentSrc: "http://localhost:3101/gallery/a.png",
  complete: true,
  visible: true,
  naturalWidth: 64,
  naturalHeight: 64,
};
const element = {
  image,
  rect: { x: 0, y: 0, width: 64, height: 64 },
  layout: { display: "block" },
} as PreviewElementSnapshot;
it("confirms a loaded local image or matching Next optimizer URL", () => {
  expect(
    observesAsset(element, "http://localhost:3101", "/gallery/a.png"),
  ).toBe(true);
  expect(
    observesAsset(
      {
        ...element,
        image: {
          ...image,
          currentSrc:
            "http://localhost:3101/_next/image?url=%2Fgallery%2Fa.png&w=256&q=75",
        },
      },
      "http://localhost:3101",
      "/gallery/a.png",
    ),
  ).toBe(true);
});
it("refuses failed, stale, foreign and ambiguous rendered images", () => {
  expect(
    observesAsset(
      {
        ...element,
        image: { ...image, visible: false },
        rect: { x: 0, y: 0, width: 0, height: 0 },
        layout: { ...element.layout, display: "none" },
      },
      "http://localhost:3101",
      "/gallery/a.png",
    ),
  ).toBe(false);
  for (const currentSrc of [
    "http://evil.test/gallery/a.png",
    "http://localhost:3101/gallery/b.png",
    "http://localhost:3101/_next/image?url=%2Fgallery%2Fb.png&w=256",
    "http://localhost:3101/_next/image?url=%2Fgallery%2Fa.png&url=%2Fgallery%2Fb.png",
    "http://localhost:3101/gallery/a.png#other",
  ])
    expect(
      observesAsset(
        { ...element, image: { ...image, currentSrc } },
        "http://localhost:3101",
        "/gallery/a.png",
      ),
    ).toBe(false);
  expect(
    observesAsset(
      { ...element, image: { ...image, complete: false } },
      "http://localhost:3101",
      "/gallery/a.png",
    ),
  ).toBe(false);
  expect(
    observesAsset(
      { ...element, image: { ...image, naturalWidth: 0 } },
      "http://localhost:3101",
      "/gallery/a.png",
    ),
  ).toBe(false);
});
