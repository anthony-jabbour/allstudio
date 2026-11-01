import { describe, expect, it } from "vitest";
import {
  inspectSiblingReorder,
  reorderSibling,
} from "../src/source-mapper/reorder.ts";

const first =
  '<section data-oid="a" key="first">\n  <h2 data-oid="heading">First</h2>\n</section>';
const second =
  '<section data-oid="b" key="second"><p data-oid="body">Second</p></section>';
const gap = "\n\t  ";
const page = (children: string) =>
  `// untouched\nexport default function Page(){return <main data-oid="root">${children}</main>;}\n`;

describe("bounded static sibling source reorder", () => {
  it.each([
    '<section data-oid="a" value={nextValue()}>A</section>',
    '<section data-oid="a">{items.map(item=><span>{item}</span>)}</section>',
    '<section data-oid="a" {...props}>A</section>',
  ])("refuses evaluated attributes or dynamic descendants rather than changing their evaluation order", (first) => {
    expect(
      reorderSibling(page(first + gap + second), "a", "b", "down"),
    ).toMatchObject({ ok: false, reason: "unsupported-reorder" });
  });
  it("swaps whole keyed subtrees and preserves the exact surrounding bytes and whitespace", () => {
    const before = page(first + gap + second);
    expect(inspectSiblingReorder(before, "a")).toEqual({
      ok: true,
      up: null,
      down: { oid: "b", tagName: "section" },
    });
    const result = reorderSibling(before, "a", "b", "down");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.generated).toBe(page(second + gap + first));
    expect(result.oidOrder).toEqual(["root", "b", "body", "a", "heading"]);
    expect(result.movedOrdinal).toBe(3);
    expect(result.siblingOrdinal).toBe(1);
    const restored = reorderSibling(result.generated, "a", "b", "up");
    expect(restored.ok && restored.generated).toBe(before);
  });
  it("refuses stale/missing, ambiguous, cross-parent and wrong-direction targets", () => {
    const before = page(first + gap + second);
    for (const [oid, sibling, direction] of [
      ["a", "b", "up"],
      ["b", "a", "down"],
      ["a", "missing", "down"],
      ["a", "heading", "down"],
      ["a", "a", "down"],
    ] as const) {
      expect(reorderSibling(before, oid, sibling, direction).ok).toBe(false);
    }
    expect(
      reorderSibling(
        page(first + second.replace('data-oid="b"', 'data-oid="a"')),
        "a",
        "a",
        "down",
      ),
    ).toMatchObject({ ok: false, reason: "oid-ambiguous" });
    expect(inspectSiblingReorder(before, "missing")).toMatchObject({
      ok: false,
      reason: "oid-not-found",
    });
  });
  it.each([
    "{/* attached comment */}",
    "meaningful text",
    '{condition && <aside data-oid="condition"/>}',
    '{items.map(x=><p data-oid="mapped"/>)}',
  ])("refuses an intervening unsupported child: %s", (between) => {
    expect(
      reorderSibling(page(first + between + second), "a", "b", "down").ok,
    ).toBe(false);
  });
  it.each([
    `export default function Page(){if(condition){return <main>${first}${second}</main>;}return null;}`,
    `export default function Page(){if(!condition)return null;return <main>${first}${second}</main>;}`,
    `export default function Page(){let view;for(const item of items){view=<main>${first}${second}</main>;}return view;}`,
    `export default function Page(){const view=<main>${first}${second}</main>;if(condition)return view;return null;}`,
    `export default function Page(){const unused=<main>${first}${second}</main>;return <article>Different output</article>;}`,
    `export default function Page(){return condition?<main data-oid="root">${first}${second}</main>:null;}`,
    `export default function Page(){return <main>{items.map(item=><article>${first}${second}</article>)}</main>;}`,
    `export default function Page(){const Helper=()=> <main>${first}${second}</main>;return <Helper/>;}`,
    `function Helper(){return <main>${first}${second}</main>} export default function Page(){return <Helper/>;}`,
    `export default function Page(){return <>${first}${second}</>;}`,
    `export default wrap(()=> <main>${first}${second}</main>);`,
  ])("refuses conditional/mapped/helper/fragment/unknown root contexts", (before) =>
    expect(reorderSibling(before, "a", "b", "down")).toMatchObject({
      ok: false,
      reason: "unsupported-reorder",
    }));
  it("supports a directly exported static arrow root, but never skips comments or crosses parents", () => {
    const before = `const Page=()=> <main>${first}${gap}${second}</main>;export default Page;`;
    expect(reorderSibling(before, "b", "a", "up").ok).toBe(true);
    expect(
      reorderSibling(
        page(`<div data-oid="wrapper">${first}</div>${second}`),
        "a",
        "b",
        "down",
      ).ok,
    ).toBe(false);
    expect(inspectSiblingReorder("not JSX {", "a")).toMatchObject({
      ok: false,
      reason: "parse-failed",
    });
  });
});
