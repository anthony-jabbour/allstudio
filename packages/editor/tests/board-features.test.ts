import {
  type BoardFrameNode,
  type BoardPage,
  parseBoardDocument,
} from "@allstudio/project";
import { describe, expect, it } from "vitest";
import {
  COMMANDS,
  findCommand,
  formatKeys,
  matchesKeys,
} from "../src/board/editor/commands.ts";
import {
  copyStyle,
  createFromTemplate,
  distributeNodes,
  frameNode,
  inferLayout,
  layoutFrame,
  locate,
  measureDistances,
  normalizeLayouts,
  pasteStyle,
  shapeNode,
  stackInsertIndex,
  textNode,
} from "../src/board/index.ts";

const kids = () => [
  shapeNode("rect", { id: "a", x: 0, y: 0, width: 100, height: 40 }),
  shapeNode("rect", { id: "b", x: 0, y: 0, width: 60, height: 80 }),
  shapeNode("rect", { id: "c", x: 0, y: 0, width: 80, height: 20 }),
];
function stack(
  layout: Partial<BoardFrameNode["layout"]> & object,
): BoardFrameNode {
  return frameNode({
    id: "s",
    name: "Stack",
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    layout: {
      direction: "row",
      gap: 10,
      padding: [20, 20, 20, 20],
      align: "start",
      justify: "start",
      ...layout,
    },
    children: kids(),
  });
}
const pos = (f: BoardFrameNode) =>
  f.children.map((c) => [c.x, c.y, c.width, c.height]);

describe("auto layout", () => {
  it("stacks a row with gap and padding", () => {
    expect(pos(layoutFrame(stack({})))).toEqual([
      [20, 20, 100, 40],
      [130, 20, 60, 80],
      [200, 20, 80, 20],
    ]);
  });
  it("centers, stretches, justifies and hugs", () => {
    const centered = layoutFrame(stack({ align: "center", justify: "center" }));
    // content 260 in 360 → offset 50; cross 260 inner, child 40 high → (260-40)/2
    expect(centered.children[0]).toMatchObject({ x: 70, y: 130 });
    const stretched = layoutFrame(
      stack({ direction: "column", align: "stretch" }),
    );
    expect(stretched.children.map((c) => c.width)).toEqual([360, 360, 360]);
    expect(stretched.children.map((c) => c.y)).toEqual([20, 70, 160]);
    const between = layoutFrame(stack({ justify: "space-between" }));
    expect(between.children.at(-1)?.x).toBe(300);
    const hug = layoutFrame(stack({ hugWidth: true, hugHeight: true }));
    expect([hug.width, hug.height]).toEqual([300, 120]);
  });
  it("skips hidden children and is idempotent", () => {
    const f = stack({});
    f.children[1] = { ...f.children[1], hidden: true } as never;
    const once = layoutFrame(f);
    expect(once.children[2]?.x).toBe(130);
    expect(layoutFrame(once)).toBe(once);
  });
  it("lays out nested stacks innermost first", () => {
    const inner = {
      ...stack({ hugWidth: true, hugHeight: true }),
      id: "inner",
    };
    const outer = frameNode({
      id: "outer",
      name: "Outer",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      layout: {
        direction: "column",
        gap: 0,
        padding: [0, 0, 0, 0],
        align: "start",
        justify: "start",
        hugWidth: true,
        hugHeight: true,
      },
      children: [inner],
    });
    const page: BoardPage = {
      id: "p",
      name: "P",
      background: "transparent",
      nodes: [outer],
    };
    const out = normalizeLayouts(page).nodes[0] as BoardFrameNode;
    expect([out.width, out.height]).toEqual([300, 120]);
    expect(normalizeLayouts(normalizeLayouts(page))).toEqual(
      normalizeLayouts(page),
    );
  });
  it("infers a direction and computes insert indexes", () => {
    const f = frameNode({
      name: "F",
      x: 0,
      y: 0,
      width: 500,
      height: 100,
      children: [
        shapeNode("rect", { id: "a", x: 10, y: 10, width: 50, height: 50 }),
        shapeNode("rect", { id: "b", x: 90, y: 10, width: 50, height: 50 }),
      ],
    });
    expect(inferLayout(f)).toMatchObject({ direction: "row", gap: 30 });
    const laid = layoutFrame(stack({}));
    expect(stackInsertIndex(laid, "a", { x: 195, y: 30 })).toBe(1);
    expect(stackInsertIndex(laid, "a", { x: 5, y: 30 })).toBe(0);
    expect(stackInsertIndex(laid, "a", { x: 999, y: 30 })).toBe(2);
  });
  it("persists through the schema", () => {
    const doc = createFromTemplate("blank");
    doc.pages[0]?.nodes.push(layoutFrame(stack({ hugWidth: true })));
    expect(() =>
      parseBoardDocument(JSON.parse(JSON.stringify(doc))),
    ).not.toThrow();
    const bad = JSON.parse(JSON.stringify(doc));
    bad.pages[0].nodes[0].layout.direction = "diagonal";
    expect(() => parseBoardDocument(bad)).toThrow(/direction/);
  });
});

describe("measurement (rewrite of Onlook's measurement overlay)", () => {
  it("measures the gap between separate rectangles", () => {
    const m = measureDistances(
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 80, y: 0, width: 50, height: 50 },
    );
    expect(m.find((d) => d.axis === "x")).toEqual({
      axis: "x",
      value: 30,
      from: { x: 50, y: 25 },
      to: { x: 80, y: 25 },
    });
  });
  it("reports four inset distances when nested", () => {
    const m = measureDistances(
      { x: 10, y: 20, width: 30, height: 30 },
      { x: 0, y: 0, width: 100, height: 100 },
    );
    expect(m.map((d) => d.value).sort((a, b) => a - b)).toEqual([
      10, 20, 50, 60,
    ]);
  });
});

describe("distribute and style", () => {
  const page = (): BoardPage => ({
    id: "p",
    name: "P",
    background: "transparent",
    nodes: [
      shapeNode("rect", { id: "a", x: 0, y: 0, width: 10, height: 10 }),
      shapeNode("rect", { id: "b", x: 15, y: 0, width: 10, height: 10 }),
      shapeNode("rect", {
        id: "c",
        x: 100,
        y: 0,
        width: 10,
        height: 10,
        fill: "#ff0000",
        radius: 6,
        opacity: 0.5,
      }),
      textNode({
        id: "t",
        text: "Hi",
        x: 0,
        y: 0,
        fontSize: 40,
        color: "#00ff00",
      }),
    ],
  });
  it("evens out gaps", () => {
    const out = distributeNodes(page(), ["a", "b", "c"], "horizontal");
    expect(locate(out, "b")?.node.x).toBe(50);
    expect(distributeNodes(page(), ["a", "b"], "horizontal")).toEqual(page());
  });
  it("copies style without geometry; text props only onto text", () => {
    const p = page();
    const style = copyStyle(locate(p, "c")?.node as never);
    const out = pasteStyle(p, ["a", "t"], style);
    expect(locate(out, "a")?.node).toMatchObject({
      fill: "#ff0000",
      radius: 6,
      opacity: 0.5,
      x: 0,
    });
    expect(locate(out, "t")?.node).toMatchObject({
      fontSize: 40,
      color: "#00ff00",
    });
    const textStyle = copyStyle(locate(p, "t")?.node as never);
    expect(locate(pasteStyle(p, ["t"], textStyle), "t")?.node).toMatchObject({
      fontSize: 40,
    });
  });
});

describe("command registry", () => {
  const ev = (
    key: string,
    mods: Partial<
      Record<"metaKey" | "ctrlKey" | "shiftKey" | "altKey", boolean>
    > = {},
    code = "",
  ) =>
    ({
      key,
      code,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      ...mods,
    }) as KeyboardEvent;
  it("matches combos exactly", () => {
    expect(matchesKeys(ev("z", { metaKey: true }), "mod+z")).toBe(true);
    expect(
      matchesKeys(ev("z", { metaKey: true, shiftKey: true }), "mod+z"),
    ).toBe(false);
    expect(
      matchesKeys(ev("Z", { ctrlKey: true, shiftKey: true }), "mod+shift+z"),
    ).toBe(true);
    expect(matchesKeys(ev("!", { shiftKey: true }, "Digit1"), "shift+1")).toBe(
      true,
    );
    expect(matchesKeys(ev("å", { altKey: true }, "KeyA"), "alt+a")).toBe(true);
  });
  it("routes keys to the right command", () => {
    expect(findCommand(ev("z", { metaKey: true }))?.id).toBe("edit.undo");
    expect(findCommand(ev("a", { shiftKey: true }, "KeyA"))?.id).toBe(
      "layer.stack",
    );
    expect(findCommand(ev("k", { ctrlKey: true }))?.id).toBe("view.palette");
    expect(findCommand(ev("x"))).toBeUndefined();
  });
  it("has unique ids and no conflicting shortcuts", () => {
    const ids = COMMANDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = COMMANDS.flatMap((c) => c.keys ?? []);
    expect(new Set(keys).size).toBe(keys.length);
    expect(formatKeys("mod+shift+z", true)).toBe("⇧⌘Z");
    expect(formatKeys("mod+z", false)).toBe("Ctrl+Z");
  });
});

describe("stack reorder via reparent", () => {
  it("moves the first child to the end when dropped past the last", async () => {
    const { reparent } = await import("../src/board/index.ts");
    const laid = layoutFrame(stack({}));
    const page: BoardPage = {
      id: "p",
      name: "P",
      background: "transparent",
      nodes: [laid],
    };
    let index = stackInsertIndex(laid, "a", { x: 999, y: 30 });
    const found = locate(page, "a");
    if (found?.parent?.id === "s" && found.index <= index) index += 1;
    const out = normalizeLayouts(reparent(page, "a", "s", index));
    expect((out.nodes[0] as BoardFrameNode).children.map((c) => c.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });
});
