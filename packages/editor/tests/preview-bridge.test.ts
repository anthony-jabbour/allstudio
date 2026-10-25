import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createBridgeNonce,
  createEditorMessage,
  parsePreviewMessage,
} from "../src/index.ts";
import {
  EDITOR_MESSAGE_SOURCE,
  PREVIEW_BRIDGE_VERSION,
  PREVIEW_MESSAGE_SOURCE,
} from "../src/preview-bridge/protocol.ts";

const previewWindow = { name: "preview" };
const expected = {
  previewOrigin: "http://localhost:3101",
  previewWindow,
  nonce: "n".repeat(48),
};
const element = {
  oid: "5y3ukh6",
  tagName: "h1",
  text: "Aurora Atelier",
  rect: { x: 10, y: 20, width: 300, height: 60 },
  instances: 1,
};

function event(data: Record<string, unknown>, overrides = {}) {
  return {
    origin: expected.previewOrigin,
    source: previewWindow,
    data: {
      source: PREVIEW_MESSAGE_SOURCE,
      version: PREVIEW_BRIDGE_VERSION,
      nonce: expected.nonce,
      ...data,
    },
    ...overrides,
  };
}

describe("preview bridge protocol", () => {
  it("accepts a well-formed selection from the preview window", () => {
    expect(
      parsePreviewMessage(
        event({ type: "select", clickedTag: "h1", element }),
        expected,
      ),
    ).toEqual({
      ok: true,
      message: {
        type: "select",
        nonce: expected.nonce,
        clickedTag: "h1",
        element,
      },
    });
  });

  it("accepts boot before a handshake and nothing else", () => {
    const disconnected = { ...expected, nonce: null };
    expect(parsePreviewMessage(event({ type: "boot" }), disconnected)).toEqual({
      ok: true,
      message: { type: "boot" },
    });
    expect(
      parsePreviewMessage(
        event({ type: "select", clickedTag: "h1", element }),
        disconnected,
      ),
    ).toEqual({ ok: false, reason: "not-connected" });
  });

  it.each([
    [
      "another origin",
      { origin: "http://localhost:5174" },
      "unexpected-origin",
    ],
    ["a null origin", { origin: "null" }, "unexpected-origin"],
    ["another window", { source: { name: "other" } }, "unexpected-source"],
    ["no window", { source: null }, "unexpected-source"],
  ])("rejects messages from %s", (_label, overrides, reason) => {
    expect(
      parsePreviewMessage(
        event({ type: "select", clickedTag: "h1", element }, overrides),
        expected,
      ),
    ).toEqual({ ok: false, reason });
  });

  it("rejects a stale or forged nonce", () => {
    expect(
      parsePreviewMessage(
        event({ type: "select", clickedTag: "h1", element, nonce: "forged" }),
        expected,
      ),
    ).toEqual({ ok: false, reason: "stale-nonce" });
  });

  it.each([
    ["non-object data", "hello"],
    ["wrong source tag", { source: "someone-else" }],
    ["wrong version", { version: 2 }],
    ["unknown type", { type: "write-file" }],
    [
      "invalid oid",
      {
        type: "select",
        clickedTag: "h1",
        element: { ...element, oid: '"><img' },
      },
    ],
    [
      "oversized text",
      {
        type: "select",
        clickedTag: "h1",
        element: { ...element, text: "x".repeat(2001) },
      },
    ],
    [
      "non-finite rect",
      {
        type: "select",
        clickedTag: "h1",
        element: {
          ...element,
          rect: { x: Number.NaN, y: 0, width: 1, height: 1 },
        },
      },
    ],
    [
      "zero instances",
      {
        type: "select",
        clickedTag: "h1",
        element: { ...element, instances: 0 },
      },
    ],
    ["bad tag", { type: "select", clickedTag: "<script>", element }],
    ["element oid mismatch", { type: "element", oid: "other12", element }],
  ])("rejects malformed messages: %s", (_label, data) => {
    const payload =
      typeof data === "string"
        ? { ...event({}), data }
        : event({ type: "select", clickedTag: "h1", element, ...data });
    expect(parsePreviewMessage(payload, expected)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("creates tagged editor messages and unguessable nonces", () => {
    expect(
      createEditorMessage({ type: "track", nonce: "abc", oid: null }),
    ).toEqual({
      source: EDITOR_MESSAGE_SOURCE,
      version: PREVIEW_BRIDGE_VERSION,
      type: "track",
      nonce: "abc",
      oid: null,
    });
    const nonce = createBridgeNonce();
    expect(nonce).toMatch(/^[0-9a-f]{48}$/);
    expect(createBridgeNonce()).not.toBe(nonce);
  });

  it("keeps the self-contained preview client in sync with the protocol", () => {
    const client = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../src/preview-bridge/client.ts",
      ),
      "utf8",
    );
    expect(client).not.toMatch(/^import /m);
    expect(client).toContain(
      `const EDITOR_SOURCE = "${EDITOR_MESSAGE_SOURCE}";`,
    );
    expect(client).toContain(
      `const PREVIEW_SOURCE = "${PREVIEW_MESSAGE_SOURCE}";`,
    );
    expect(client).toContain(`const VERSION = ${PREVIEW_BRIDGE_VERSION};`);
    // Replies go only to the configured editor origin, never "*".
    expect(client).toContain("config.editorOrigin,");
    expect(client).not.toContain('"*"');
  });
});
