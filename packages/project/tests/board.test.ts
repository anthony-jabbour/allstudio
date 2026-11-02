import { describe, expect, it } from "vitest";
import {
  BOARD_LIMITS,
  BoardDocumentError,
  countBoardNodes,
  createBoardDocument,
  parseBoardDocument,
} from "../src/index.ts";

function doc(nodes: unknown[]) {
  return {
    schemaVersion: 1,
    id: "b1",
    name: "Board",
    createdAt: "2026-11-02T00:00:00.000Z",
    updatedAt: "2026-11-02T00:00:00.000Z",
    pages: [{ id: "p1", name: "Page", background: "#1e1e1e", nodes }],
  };
}

const rect = {
  id: "r1",
  type: "rect",
  name: "R",
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  fill: "#fff",
};

describe("parseBoardDocument", () => {
  it("accepts a nested frame/text/image document", () => {
    const parsed = parseBoardDocument(
      doc([
        {
          id: "f1",
          type: "frame",
          name: "Frame",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          fill: "#ffffff",
          gradient: [90, "#000", "rgba(0,0,0,0.5)"],
          children: [
            rect,
            {
              id: "t1",
              type: "text",
              name: "T",
              x: 1,
              y: 1,
              width: 50,
              height: 20,
              text: "<script>alert(1)</script>",
              color: "#111",
              fontFamily: "Inter",
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.2,
              letterSpacing: 0,
              textAlign: "left",
            },
            {
              id: "i1",
              type: "image",
              name: "I",
              x: 0,
              y: 0,
              width: 10,
              height: 10,
              src: "data:image/png;base64,iVBORw0KGgo=",
              fit: "cover",
            },
          ],
        },
      ]),
    );
    expect(countBoardNodes(parsed)).toBe(4);
  });

  it.each([
    ["unknown node type", [{ ...rect, type: "svg" }]],
    ["non-finite numbers", [{ ...rect, x: Number.NaN }]],
    [
      "remote image URLs",
      [
        {
          ...rect,
          type: "image",
          src: "https://example.com/a.png",
          fit: "cover",
        },
      ],
    ],
    [
      "svg data URLs",
      [
        {
          ...rect,
          type: "image",
          src: "data:image/svg+xml;base64,PHN2Zz4=",
          fit: "cover",
        },
      ],
    ],
    [
      "CSS injection in colors",
      [{ ...rect, fill: "red; background:url(https://x)" }],
    ],
    ["duplicate ids", [rect, rect]],
    ["negative sizes", [{ ...rect, width: -1 }]],
  ])("rejects %s", (_label, nodes) => {
    expect(() => parseBoardDocument(doc(nodes))).toThrow(BoardDocumentError);
  });

  it("rejects unsupported versions and over-deep nesting", () => {
    expect(() => parseBoardDocument({ ...doc([]), schemaVersion: 2 })).toThrow(
      /version/,
    );
    let node: Record<string, unknown> = { ...rect, id: "leaf" };
    for (let depth = 0; depth <= BOARD_LIMITS.maxDepth + 1; depth++) {
      node = { ...rect, id: `f${depth}`, type: "frame", children: [node] };
    }
    expect(() => parseBoardDocument(doc([node]))).toThrow(/deep/);
  });

  it("round-trips a created document", () => {
    const created = createBoardDocument("New");
    expect(parseBoardDocument(JSON.parse(JSON.stringify(created)))).toEqual(
      created,
    );
  });
});
