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
  spacing: {
    display: "grid",
    paddingInlineStart: "24px",
    paddingInlineEnd: "24px",
    paddingBlockStart: "80px",
    paddingBlockEnd: "80px",
    marginInlineStart: "0px",
    marginInlineEnd: "0px",
    marginBlockStart: "0px",
    marginBlockEnd: "0px",
    rowGap: "32px",
    columnGap: "32px",
    flexDirection: "row",
    flexWrap: "nowrap",
  },
  appearance: {
    backgroundColor: "rgb(2, 132, 199)",
    backgroundImage: "none",
    borderRadius: "9999px",
  },
  typography: {
    fontSize: "48px",
    fontWeight: "600",
    lineHeight: "60px",
    textAlign: "start",
    color: "rgb(0, 0, 0)",
    fontFamily: "Arial",
  },
  nodeId: "n1",
  oid: "5y3ukh6",
  tagName: "h1",
  text: "Aurora Atelier",
  className: "text-5xl font-semibold",
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
    ["wrong version", { version: PREVIEW_BRIDGE_VERSION + 1 }],
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
      "missing className",
      {
        type: "select",
        clickedTag: "h1",
        element: { ...element, className: undefined },
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

describe("measured typography snapshot", () => {
  it("accepts explicit unavailable values without fabricating defaults", () => {
    const typography = Object.fromEntries(
      Object.keys(element.typography).map((key) => [key, null]),
    );
    expect(
      parsePreviewMessage(
        event({
          type: "select",
          clickedTag: "h1",
          element: { ...element, typography },
        }),
        expected,
      ),
    ).toMatchObject({ ok: true, message: { element: { typography } } });
  });
  it("accepts the exact measurement length limit", () => {
    expect(
      parsePreviewMessage(
        event({
          type: "select",
          clickedTag: "h1",
          element: {
            ...element,
            typography: { ...element.typography, fontFamily: "x".repeat(256) },
          },
        }),
        expected,
      ).ok,
    ).toBe(true);
  });
  it.each([
    undefined,
    null,
    [],
    { ...element.typography, color: 1 },
    { ...element.typography, fontSize: undefined },
    { ...element.typography, fontFamily: "x".repeat(257) },
    { ...element.typography, path: "/private/file" },
  ])("rejects malformed measured records %j", (typography) => {
    expect(
      parsePreviewMessage(
        event({
          type: "select",
          clickedTag: "h1",
          element: { ...element, typography },
        }),
        expected,
      ),
    ).toEqual({ ok: false, reason: "malformed" });
  });
});

const layer = {
  id: "n1",
  parentId: null,
  oid: "heading1",
  tagName: "h1",
  label: "Hello",
};
const layers = {
  type: "layers",
  generation: 1,
  nodes: [layer],
  truncated: false,
};
const chain = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    ...layer,
    id: `n${i + 1}`,
    parentId: i === 0 ? null : `n${i}`,
  }));

describe("bounded rendered layers protocol", () => {
  it("accepts a source-backed hierarchy with separate rendered instance IDs", () => {
    const message = {
      ...layers,
      nodes: [layer, { ...layer, id: "n2", parentId: "n1" }],
    };
    expect(parsePreviewMessage(event(message), expected)).toEqual({
      ok: true,
      message: { ...message, nonce: expected.nonce },
    });
  });
  it("accepts an empty tree, explicit truncation and exact node/label/depth limits", () => {
    for (const nodes of [
      [],
      [{ ...layer, label: "x".repeat(80) }],
      chain(64),
      Array.from({ length: 1000 }, (_, i) => ({ ...layer, id: `n${i + 1}` })),
    ]) {
      expect(
        parsePreviewMessage(
          event({ ...layers, nodes, truncated: true }),
          expected,
        ).ok,
      ).toBe(true);
    }
  });
  it.each([
    [
      "oversized count",
      {
        nodes: Array.from({ length: 1001 }, (_, i) => ({
          ...layer,
          id: `n${i + 1}`,
        })),
      },
    ],
    ["oversized label", { nodes: [{ ...layer, label: "x".repeat(81) }] }],
    ["duplicate IDs", { nodes: [layer, layer] }],
    ["self parent", { nodes: [{ ...layer, parentId: "n1" }] }],
    ["missing parent", { nodes: [{ ...layer, parentId: "n2" }] }],
    [
      "forward parent/cycle",
      {
        nodes: [
          { ...layer, parentId: "n2" },
          { ...layer, id: "n2", parentId: "n1" },
        ],
      },
    ],
    ["depth limit", { nodes: chain(65) }],
    ["invalid instance ID", { nodes: [{ ...layer, id: "../file" }] }],
    ["invalid source ID", { nodes: [{ ...layer, oid: "../file" }] }],
    ["invalid tag", { nodes: [{ ...layer, tagName: "<script>" }] }],
    ["non-string label", { nodes: [{ ...layer, label: 1 }] }],
    [
      "unexpected node payload",
      { nodes: [{ ...layer, path: "/private/file" }] },
    ],
    ["missing truncation", { truncated: undefined }],
    ["zero generation", { generation: 0 }],
    ["fractional generation", { generation: 1.5 }],
    ["unsafe generation", { generation: Number.MAX_SAFE_INTEGER + 1 }],
    ["non-array tree", { nodes: {} }],
    ["unexpected message payload", { command: "write-file" }],
  ])("rejects %s", (_name, fields) => {
    expect(
      parsePreviewMessage(event({ ...layers, ...fields }), expected),
    ).toEqual({ ok: false, reason: "malformed" });
  });
  it.each([
    ["wrong frame", { source: {} }],
    ["wrong origin", { origin: "null" }],
  ])("keeps existing envelope checks for %s", (_name, overrides) => {
    expect(parsePreviewMessage(event(layers, overrides), expected).ok).toBe(
      false,
    );
  });
  it("rejects stale nonces and accepts only fixed layer errors", () => {
    expect(
      parsePreviewMessage(event({ ...layers, nonce: "old" }), expected),
    ).toEqual({ ok: false, reason: "stale-nonce" });
    expect(
      parsePreviewMessage(
        event({ type: "layer-error", reason: "stale-layer" }),
        expected,
      ),
    ).toEqual({
      ok: true,
      message: {
        type: "layer-error",
        nonce: expected.nonce,
        reason: "stale-layer",
      },
    });
    expect(
      parsePreviewMessage(
        event({ type: "layer-error", reason: "run-shell" }),
        expected,
      ),
    ).toEqual({ ok: false, reason: "malformed" });
  });
  it("requires a valid rendered identity on selected elements", () => {
    for (const nodeId of [undefined, "../file", "x".repeat(65)]) {
      expect(
        parsePreviewMessage(
          event({
            type: "select",
            clickedTag: "h1",
            element: { ...element, nodeId },
          }),
          expected,
        ),
      ).toEqual({ ok: false, reason: "malformed" });
    }
  });
});

describe("bounded selected spacing measurement", () => {
  it.each([
    ["missing", undefined],
    ["null", null],
    ["array", []],
    ["extra key", { ...element.spacing, path: "/private/file" }],
    ["oversized", { ...element.spacing, rowGap: "x".repeat(257) }],
    ["non-string", { ...element.spacing, columnGap: 3 }],
    ["missing field", { ...element.spacing, marginInlineStart: undefined }],
  ])("rejects %s spacing", (_label, spacing) => {
    expect(
      parsePreviewMessage(
        event({
          type: "select",
          clickedTag: "h1",
          element: { ...element, spacing },
        }),
        expected,
      ),
    ).toEqual({ ok: false, reason: "malformed" });
  });
  it("keeps unavailable fields null without fabricating zero", () => {
    const spacing = Object.fromEntries(
      Object.keys(element.spacing).map((key) => [key, null]),
    );
    const result = parsePreviewMessage(
      event({
        type: "select",
        clickedTag: "h1",
        element: { ...element, spacing },
      }),
      expected,
    );
    expect(result.ok).toBe(true);
    if (result.ok && result.message.type === "select")
      expect(result.message.element?.spacing).toEqual(spacing);
  });
});

describe("bounded selected appearance measurement", () => {
  it.each([
    ["missing", undefined],
    ["null", null],
    ["array", []],
    ["extra key", { ...element.appearance, path: "/private/file" }],
    ["oversized", { ...element.appearance, backgroundImage: "x".repeat(257) }],
    ["non-string", { ...element.appearance, borderRadius: 3 }],
    ["missing field", { ...element.appearance, backgroundColor: undefined }],
    ["missing context", { backgroundColor: "red", borderRadius: "1px" }],
  ])("rejects %s appearance", (_label, appearance) => {
    expect(
      parsePreviewMessage(
        event({
          type: "select",
          clickedTag: "a",
          element: { ...element, appearance },
        }),
        expected,
      ),
    ).toEqual({ ok: false, reason: "malformed" });
  });
  it("accepts the exact length limit", () => {
    expect(
      parsePreviewMessage(
        event({
          type: "select",
          clickedTag: "a",
          element: {
            ...element,
            appearance: {
              ...element.appearance,
              backgroundImage: "x".repeat(256),
            },
          },
        }),
        expected,
      ).ok,
    ).toBe(true);
  });
  it("keeps unavailable fields null without fabricating colours", () => {
    const appearance = Object.fromEntries(
      Object.keys(element.appearance).map((key) => [key, null]),
    );
    const result = parsePreviewMessage(
      event({
        type: "select",
        clickedTag: "a",
        element: { ...element, appearance },
      }),
      expected,
    );
    expect(result.ok).toBe(true);
    if (result.ok && result.message.type === "select")
      expect(result.message.element?.appearance).toEqual(appearance);
  });
  it("is part of the protocol version that the runtime copy reports", () => {
    expect(PREVIEW_BRIDGE_VERSION).toBe(6);
    expect(
      parsePreviewMessage(
        event({ type: "boot", version: PREVIEW_BRIDGE_VERSION - 1 }),
        expected,
      ),
    ).toEqual({ ok: false, reason: "malformed" });
  });
});
