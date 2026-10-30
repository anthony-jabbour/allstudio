import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LayerTree } from "../src/shell/layer-tree.tsx";

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
});
