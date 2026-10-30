import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  LayerTree,
  nearbyVisibleLayerId,
  restoreLayerTreeFocus,
  scrollLayerRowIntoView,
} from "../src/shell/layer-tree.tsx";

const layers = {
  generation: 1,
  truncated: false,
  nodes: [
    {
      id: "n1",
      parentId: null,
      oid: "same-source",
      tagName: "div",
      label: "<img src=x onerror=alert(1)>",
    },
    {
      id: "n2",
      parentId: "n1",
      oid: "same-source",
      tagName: "span",
      label: "second instance",
    },
  ],
};
const selected = {
  appearance: {
    backgroundColor: null,
    backgroundImage: null,
    borderRadius: null,
  },
  spacing: {
    display: null,
    paddingInlineStart: null,
    paddingInlineEnd: null,
    paddingBlockStart: null,
    paddingBlockEnd: null,
    marginInlineStart: null,
    marginInlineEnd: null,
    marginBlockStart: null,
    marginBlockEnd: null,
    rowGap: null,
    columnGap: null,
    flexDirection: null,
    flexWrap: null,
  },
  typography: {
    fontSize: null,
    fontWeight: null,
    lineHeight: null,
    textAlign: null,
    color: null,
    fontFamily: null,
  },
  nodeId: "n2",
  oid: "same-source",
  tagName: "span",
  text: "second instance",
  className: "",
  instances: 2,
  rect: { x: 0, y: 0, width: 10, height: 10 },
};
describe("LayerTree", () => {
  it("escapes untrusted DOM labels and distinguishes repeated rendered instances", () => {
    const html = renderToStaticMarkup(
      createElement(LayerTree, {
        layers,
        selected,
        selectionVersion: 1,
        onSelect: () => {},
        sourceLabel: "src/components/item.tsx:4",
      }),
    );
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html).toContain('data-layer-id="n2"');
    expect(html).toContain('role="group"');
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html).toContain("src/components/item.tsx:4");
  });
  it("states truncation and an outside-tree selection without inventing an active row", () => {
    const html = renderToStaticMarkup(
      createElement(LayerTree, {
        layers: { ...layers, truncated: true, nodes: layers.nodes.slice(0, 1) },
        selected,
        selectionVersion: 1,
        onSelect: () => {},
      }),
    );
    expect(html).toContain("Layer tree is partial");
    expect(html).toContain("outside the displayed layer tree");
    expect(html).not.toContain('aria-selected="true"');
  });
  it("scrolls the selected row into view without moving keyboard focus", () => {
    const focused: string[] = [];
    const scrolled: string[] = [];
    const row = {
      focus: () => focused.push("n2"),
      scrollIntoView: () => scrolled.push("n2"),
    };
    const root = {
      querySelector: (selector: string) =>
        selector === '[data-layer-id="n2"]' ? row : null,
    };
    scrollLayerRowIntoView(root as unknown as ParentNode, "n2");
    expect(scrolled).toEqual(["n2"]);
    expect(focused).toEqual([]);
  });
  it("restores keyboard focus to a nearby surviving row only when the tree had focus", () => {
    const visible = layers.nodes.filter((node) => node.id !== "n2");
    expect(nearbyVisibleLayerId(visible, "n2", layers.nodes)).toBe("n1");
    const restored: string[] = [];
    restoreLayerTreeFocus({
      visible,
      focusedId: "n2",
      nodes: layers.nodes,
      treeHasFocus: true,
      focus: (id) => restored.push(id),
    });
    expect(restored).toEqual(["n1"]);
    restored.length = 0;
    restoreLayerTreeFocus({
      visible,
      focusedId: "n2",
      nodes: layers.nodes,
      treeHasFocus: false,
      focus: (id) => restored.push(id),
    });
    expect(restored).toEqual([]);
  });
});
