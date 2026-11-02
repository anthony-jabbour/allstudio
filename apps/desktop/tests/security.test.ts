import { describe, expect, it } from "vitest";
import { assetPath, isTrustedRequest } from "../src/main/security.ts";
import { isPreviewBounds } from "../src/shared/desktop-api.ts";

describe("desktop trust boundary", () => {
  const mainFrame = { url: "app://editor/index.html" };
  const editor = { mainFrame };
  it("accepts only the exact trusted top frame and zero arguments", () => {
    expect(
      isTrustedRequest({ sender: editor, senderFrame: mainFrame }, editor, []),
    ).toBe(true);
    expect(
      isTrustedRequest(
        { sender: editor, senderFrame: { ...mainFrame } },
        editor,
        [],
      ),
    ).toBe(false);
    expect(
      isTrustedRequest(
        { sender: { mainFrame }, senderFrame: mainFrame },
        editor,
        [],
      ),
    ).toBe(false);
    expect(
      isTrustedRequest({ sender: editor, senderFrame: mainFrame }, editor, [
        "extra",
      ]),
    ).toBe(false);
    expect(
      isTrustedRequest({ sender: editor, senderFrame: null }, editor, []),
    ).toBe(false);
    mainFrame.url = "https://example.com";
    expect(
      isTrustedRequest({ sender: editor, senderFrame: mainFrame }, editor, []),
    ).toBe(false);
    mainFrame.url = "app://editor/index.html";
  });
  it("confines app assets to the renderer directory", () => {
    expect(assetPath("app://editor/index.html", "/renderer")).toBe(
      "/renderer/index.html",
    );
    expect(assetPath("app://editor/assets/main.js", "/renderer")).toBe(
      "/renderer/assets/main.js",
    );
    for (const url of [
      "app://other/index.html",
      "file:///etc/passwd",
      "app://editor/%2e%2e%2fsecret",
      "app://editor/%5csecret",
      "app://editor/%00",
      "app://editor/%zz",
      "app://user@editor/index.html",
    ]) {
      expect(assetPath(url, "/renderer")).toBeNull();
    }
  });
});
it("accepts only bounded thumbnail rectangles with no extra IPC fields", () => {
  expect(isPreviewBounds({ x: 20, y: 80, width: 800, height: 450 })).toBe(true);
  for (const bounds of [
    { x: -1, y: 0, width: 800, height: 450 },
    { x: 0, y: 0, width: Infinity, height: 450 },
    { x: 0, y: 0, width: 2050, height: 450 },
    { x: 0, y: 0, width: 800, height: 1600 },
    { x: 0, y: 0, width: 800, height: 450, path: "/tmp/private" },
    null,
  ])
    expect(isPreviewBounds(bounds)).toBe(false);
});
