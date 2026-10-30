import { describe, expect, it } from "vitest";
import {
  layoutTargets,
  observesLayout,
} from "../src/shell/layout-confirmation.ts";

const measured = {
  display: "flex",
  flexDirection: "row",
  justifyContent: "flex-start",
  alignItems: "stretch",
  gridTemplateColumns: "none",
  gridTemplateRows: "none",
  width: "640px",
  height: "240px",
  minWidth: "0px",
  maxWidth: "none",
  minHeight: "0px",
  maxHeight: "none",
};

function targets(before: string, after: string, observed = measured) {
  const result = layoutTargets(before, after, observed);
  if (!result.ok) throw new Error(result.message);
  return result.targets;
}

describe("layout rendered confirmation", () => {
  it("targets only the changed property including size-* shorthand decomposition", () => {
    expect(
      targets("size-20", "w-[320px] h-20").map((item) => [
        item.property,
        item.key,
      ]),
    ).toEqual([["width", "width"]]);
    expect(
      targets("size-20", "w-20 h-[180px]").map((item) => [
        item.property,
        item.key,
      ]),
    ).toEqual([["height", "height"]]);
    expect(
      targets("grid grid-cols-2", "grid grid-cols-3").map((item) => [
        item.property,
        item.key,
      ]),
    ).toEqual([["gridColumns", "gridTemplateColumns"]]);
    expect(targets("w-[20.0px] gap-4", "w-[20px] gap-6")).toEqual([]);
  });

  it("refuses a change it cannot verify or measure", () => {
    expect(layoutTargets("flex", "inline-block", measured).ok).toBe(false);
    expect(layoutTargets("w-20", "w-20 w-24", measured).ok).toBe(false);
    expect(layoutTargets("w-20", "", measured).ok).toBe(false);
    expect(
      layoutTargets("w-20", "w-[320px]", { ...measured, width: null }).ok,
    ).toBe(false);
    expect(
      layoutTargets("grid grid-cols-2", "grid grid-cols-3", {
        ...measured,
        gridTemplateColumns: null,
      }).ok,
    ).toBe(false);
  });

  it("confirms display, flex direction, justify-content, and align-items literals only when active", () => {
    const displayList = targets("flex", "grid");
    expect(observesLayout(measured, displayList)).toBe(false);
    expect(observesLayout({ ...measured, display: "grid" }, displayList)).toBe(
      true,
    );

    const directionList = targets("flex flex-row", "flex flex-col");
    expect(
      observesLayout(
        { ...measured, display: "flex", flexDirection: "column" },
        directionList,
      ),
    ).toBe(true);
    expect(
      observesLayout(
        { ...measured, display: "inline-flex", flexDirection: "column" },
        directionList,
      ),
    ).toBe(true);
    expect(
      observesLayout(
        { ...measured, display: "block", flexDirection: "column" },
        directionList,
      ),
    ).toBe(false);
    expect(
      observesLayout(
        { ...measured, display: "grid", flexDirection: "column" },
        directionList,
      ),
    ).toBe(false);

    const alignmentList = targets(
      "flex justify-start items-stretch",
      "flex justify-between items-center",
    );
    expect(
      observesLayout(
        {
          ...measured,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        },
        alignmentList,
      ),
    ).toBe(true);
    expect(
      observesLayout(
        {
          ...measured,
          display: "grid",
          justifyContent: "space-between",
          alignItems: "center",
        },
        alignmentList,
      ),
    ).toBe(true);
    expect(
      observesLayout(
        {
          ...measured,
          display: "block",
          justifyContent: "space-between",
          alignItems: "center",
        },
        alignmentList,
      ),
    ).toBe(false);
  });

  it("confirms resolved grid track counts only when rendered as a grid", () => {
    const gridBefore = {
      ...measured,
      display: "grid",
      gridTemplateColumns: "320px 320px",
      gridTemplateRows: "120px",
    };
    const cols = targets("grid grid-cols-2", "grid grid-cols-3", gridBefore);
    expect(
      observesLayout(
        { ...gridBefore, gridTemplateColumns: "200px 200px 200px" },
        cols,
      ),
    ).toBe(true);
    expect(
      observesLayout(
        { ...gridBefore, gridTemplateColumns: "200px 200px" },
        cols,
      ),
    ).toBe(false);
    expect(
      observesLayout({ ...gridBefore, gridTemplateColumns: "none" }, cols),
    ).toBe(false);
    expect(
      observesLayout({ ...gridBefore, gridTemplateColumns: "subgrid" }, cols),
    ).toBe(false);
    expect(
      observesLayout(
        {
          ...gridBefore,
          display: "flex",
          gridTemplateColumns: "200px 200px 200px",
        },
        cols,
      ),
    ).toBe(false);

    const rows = targets("grid grid-rows-1", "grid grid-rows-2", gridBefore);
    expect(
      observesLayout(
        {
          ...gridBefore,
          display: "inline-grid",
          gridTemplateRows: "120px 120px",
        },
        rows,
      ),
    ).toBe(true);
  });

  it("confirms width and height presets and pixel literals while failing closed when clamped or inline", () => {
    const pxWidth = targets("w-full", "w-[320px]");
    expect(observesLayout({ ...measured, width: "320px" }, pxWidth)).toBe(true);
    expect(observesLayout({ ...measured, width: "320.01px" }, pxWidth)).toBe(
      true,
    );
    // Clamped by max-w-* or parent constraint: rendered width did not reach 320px
    expect(observesLayout({ ...measured, width: "280px" }, pxWidth)).toBe(
      false,
    );
    expect(observesLayout(measured, pxWidth)).toBe(false);
    // Inactive on inline / contents / none elements
    expect(
      observesLayout(
        { ...measured, display: "inline", width: "320px" },
        pxWidth,
      ),
    ).toBe(false);
    expect(
      observesLayout(
        { ...measured, display: "contents", width: "320px" },
        pxWidth,
      ),
    ).toBe(false);
    expect(
      observesLayout({ ...measured, display: "none", width: "320px" }, pxWidth),
    ).toBe(false);

    const presetHeight = targets("h-40", "h-64");
    expect(observesLayout({ ...measured, height: "256px" }, presetHeight)).toBe(
      true,
    );
    expect(observesLayout(measured, presetHeight)).toBe(false);
    expect(observesLayout({ ...measured, height: "auto" }, presetHeight)).toBe(
      false,
    );
  });
});
