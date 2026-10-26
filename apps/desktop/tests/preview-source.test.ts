import { describe, expect, it } from "vitest";
import {
  editElementClassName,
  editElementText,
  listOids,
} from "../../../packages/editor/src/source-mapper/index.ts";
import {
  preparePreviewSource,
  stripPreviewOids,
} from "../../../scripts/spikes/preview-source.ts";

describe("preview-only instrumentation feasibility", () => {
  const source =
    'export default function Page() { return <main><h1 className="old">Hello</h1><p data-oid="user-id">Keep</p></main>; }';
  it("creates stable preview IDs without modifying original source or existing IDs", () => {
    const first = preparePreviewSource("src/app/page.tsx", source);
    expect(first.content).toBe(
      preparePreviewSource("src/app/page.tsx", source).content,
    );
    expect(first.content).not.toBe(
      preparePreviewSource("src/app/other.tsx", source).content,
    );
    expect(stripPreviewOids(first.content, first)).toBe(source);
    expect(first.content).not.toContain('data-oid="user-id"');
  });
  it("uses the existing mapper to patch original text and classes without persisting preview IDs", () => {
    const preview = preparePreviewSource("src/app/page.tsx", source);
    const oid = listOids(preview.content)?.[1];
    expect(oid).toBeDefined();
    if (!oid) throw new Error("Heading ID missing");
    const text = editElementText(preview.content, oid, "Changed");
    expect(text.ok).toBe(true);
    if (!text.ok) throw new Error(text.reason);
    const result = stripPreviewOids(text.generated, preview);
    expect(result).toBe(source.replace("Hello", "Changed"));
    expect(
      listOids(preparePreviewSource("src/app/page.tsx", result).content),
    ).not.toEqual(listOids(preview.content));
    const classes = editElementClassName(preview.content, oid, "new");
    expect(classes.ok).toBe(true);
    if (!classes.ok) throw new Error(classes.reason);
    expect(stripPreviewOids(classes.generated, preview)).toBe(
      source.replace('className="old"', 'className="new"'),
    );
  });
  it("fails closed if instrumentation would repair or rewrite existing source", () => {
    expect(() =>
      preparePreviewSource(
        "src/app/page.tsx",
        '<div data-oid="same"><p data-oid="same" /></div>',
      ),
    ).toThrow();
    expect(() => preparePreviewSource("src/app/page.tsx", "<broken")).toThrow();
  });
  it("versions existing IDs too and restores their exact quote and spacing", () => {
    const source = "<main><h1\ndata-oid = 'user-heading'>Hello</h1></main>";
    const preview = preparePreviewSource("src/page.tsx", source);
    const changed = preparePreviewSource(
      "src/page.tsx",
      source.replace("<h1", "<p>New</p><h1"),
    );
    expect(
      preview.injectedOids.every((oid) => !changed.injectedOids.includes(oid)),
    ).toBe(true);
    expect(stripPreviewOids(preview.content, preview)).toBe(source);
    expect(listOids(preview.content)).toEqual(preview.injectedOids);
  });
});
