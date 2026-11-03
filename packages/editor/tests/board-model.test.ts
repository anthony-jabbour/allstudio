import { type BoardPage, parseBoardDocument } from "@allstudio/project";
import { describe, expect, it } from "vitest";
import {
  absoluteBounds,
  addPage,
  alignNodes,
  copyNodes,
  createFromTemplate,
  deletePage,
  duplicateNodes,
  frameAt,
  frameNode,
  frameSelection,
  historyReducer,
  initialHistory,
  locate,
  nodesInRect,
  pasteNodes,
  reorderNodes,
  reparent,
  resizeBounds,
  shapeNode,
  snapBounds,
  unframe,
  updateNodes,
  updatePage,
  wheelViewport,
  zoomAt,
} from "../src/board/index.ts";

function fixture(): BoardPage {
  return {
    id: "p",
    name: "P",
    background: "transparent",
    nodes: [
      frameNode({
        id: "f",
        name: "Frame",
        x: 100,
        y: 100,
        width: 400,
        height: 300,
        children: [
          shapeNode("rect", { id: "a", x: 10, y: 10, width: 50, height: 50 }),
          shapeNode("rect", { id: "b", x: 100, y: 40, width: 50, height: 50 }),
        ],
      }),
      shapeNode("ellipse", { id: "c", x: 700, y: 100, width: 80, height: 80 }),
    ],
  };
}

describe("board model", () => {
  it("computes absolute bounds through ancestor frames", () => {
    expect(absoluteBounds(fixture(), "b")).toEqual({
      x: 200,
      y: 140,
      width: 50,
      height: 50,
    });
  });

  it("reparents while keeping the on-canvas position and refuses cycles", () => {
    const out = reparent(fixture(), "c", "f");
    expect(locate(out, "c")?.parent?.id).toBe("f");
    expect(absoluteBounds(out, "c")).toEqual({
      x: 700,
      y: 100,
      width: 80,
      height: 80,
    });
    const back = reparent(out, "c", null);
    expect(absoluteBounds(back, "c")?.x).toBe(700);
    const nested = reparent(fixture(), "a", "f");
    expect(reparent(nested, "f", "f")).toBe(nested);
  });

  it("updates immutably and returns the same page for no-op patches", () => {
    const page = fixture();
    expect(updateNodes(page, ["a"], { x: 10 })).toBe(page);
    const moved = updateNodes(page, ["a"], { x: 20 });
    expect(moved).not.toBe(page);
    expect(locate(page, "a")?.node.x).toBe(10);
  });

  it("duplicates with fresh ids and copy/paste keeps absolute positions", () => {
    const page = fixture();
    const dup = duplicateNodes(page, ["a"]);
    expect(dup.ids).toHaveLength(1);
    expect(dup.ids[0]).not.toBe("a");
    expect(locate(dup.page, dup.ids[0] as string)?.parent?.id).toBe("f");
    const clip = copyNodes(page, ["b"]);
    expect(clip[0]?.x).toBe(200);
    const pasted = pasteNodes(page, clip, null, { x: 0, y: 0 });
    expect(absoluteBounds(pasted.page, pasted.ids[0] as string)?.x).toBe(200);
  });

  it("reorders, frames, unframes and aligns", () => {
    const page = fixture();
    const front = reorderNodes(page, ["a"], "front");
    expect(
      (locate(front, "f")?.node as { children: { id: string }[] }).children.map(
        (n) => n.id,
      ),
    ).toEqual(["b", "a"]);
    const framed = frameSelection(page, ["a", "b"]);
    expect(framed).not.toBeNull();
    const inner = locate(framed?.page as BoardPage, "a");
    expect(inner?.parent?.id).toBe(framed?.id);
    expect(absoluteBounds(framed?.page as BoardPage, "a")).toEqual(
      absoluteBounds(page, "a"),
    );
    expect(frameSelection(page, ["a", "c"])).toBeNull();
    const undone = unframe(framed?.page as BoardPage, framed?.id as string);
    expect(absoluteBounds(undone?.page as BoardPage, "b")).toEqual(
      absoluteBounds(page, "b"),
    );
    const aligned = alignNodes(page, ["a", "b"], "top");
    expect(locate(aligned, "b")?.node.y).toBe(10);
  });

  it("finds frames and marquee hits", () => {
    expect(frameAt(fixture(), { x: 150, y: 150 })?.id).toBe("f");
    expect(frameAt(fixture(), { x: 650, y: 150 })).toBeNull();
    expect(
      nodesInRect(fixture(), { x: 600, y: 0, width: 200, height: 200 }),
    ).toEqual(["c"]);
  });

  it("keeps documents valid through page operations", () => {
    let doc = createFromTemplate("responsive");
    const added = addPage(doc);
    doc = added.doc;
    doc = updatePage(doc, added.id, (p) => ({ ...p, nodes: fixture().nodes }));
    expect(() =>
      parseBoardDocument(JSON.parse(JSON.stringify(doc))),
    ).not.toThrow();
    const one = deletePage(
      deletePage(doc, added.id),
      doc.pages[0]?.id as string,
    );
    expect(one.pages).toHaveLength(1);
  });
});

describe("geometry (adapted from Onlook snapping/zoom)", () => {
  it("snaps edges and centers within the threshold", () => {
    const result = snapBounds(
      { x: 103, y: 0, width: 50, height: 50 },
      [{ x: 100, y: 200, width: 50, height: 50 }],
      5,
    );
    expect(result.dx).toBe(-3);
    expect(result.lines[0]?.orientation).toBe("vertical");
    expect(
      snapBounds(
        { x: 120, y: 0, width: 10, height: 10 },
        [{ x: 0, y: 500, width: 10, height: 10 }],
        5,
      ).lines,
    ).toEqual([]);
  });

  it("zooms around the cursor and pans on plain wheel", () => {
    const v = zoomAt({ x: 0, y: 0, zoom: 1 }, 2, { x: 100, y: 100 });
    expect(v).toEqual({ x: -100, y: -100, zoom: 2 });
    const panned = wheelViewport(
      v,
      {
        deltaX: 10,
        deltaY: 20,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      },
      { x: 0, y: 0 },
    );
    expect(panned).toEqual({ x: -110, y: -120, zoom: 2 });
  });

  it("resizes from handles, flips past the opposite edge and keeps aspect", () => {
    const start = { x: 0, y: 0, width: 100, height: 50 };
    expect(resizeBounds(start, "se", 20, 10, false)).toEqual({
      x: 0,
      y: 0,
      width: 120,
      height: 60,
    });
    expect(resizeBounds(start, "e", -150, 0, false)).toEqual({
      x: -50,
      y: 0,
      width: 50,
      height: 50,
    });
    expect(resizeBounds(start, "se", 100, 0, true)).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    });
  });
});

describe("history", () => {
  it("records commits, collapses gestures into one step, and redoes", () => {
    const a = createFromTemplate("blank");
    const b = { ...a, name: "b" };
    const c = { ...a, name: "c" };
    const d = { ...a, name: "d" };
    let s = initialHistory(a);
    s = historyReducer(s, { type: "set", doc: b });
    s = historyReducer(s, { type: "set", doc: c, transient: true });
    s = historyReducer(s, { type: "set", doc: d, transient: true });
    s = historyReducer(s, { type: "commitGesture" });
    expect(s.past).toEqual([a, b]);
    s = historyReducer(s, { type: "undo" });
    expect(s.doc).toBe(b);
    s = historyReducer(s, { type: "redo" });
    expect(s.doc).toBe(d);
    s = historyReducer(s, { type: "set", doc: c, transient: true });
    s = historyReducer(s, { type: "cancelGesture" });
    expect(s.doc).toBe(d);
  });
});
