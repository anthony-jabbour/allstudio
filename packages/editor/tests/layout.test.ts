import { describe, expect, it } from "vitest";
import {
  ALIGN_ITEMS_PRESETS,
  DISPLAY_PRESETS,
  FLEX_DIRECTION_PRESETS,
  GRID_COLUMNS_PRESETS,
  GRID_ROWS_PRESETS,
  HEIGHT_PRESETS,
  inspectLayoutClasses,
  inspectLayoutConstraints,
  JUSTIFY_CONTENT_PRESETS,
  LAYOUT_PROPERTIES,
  type LayoutProperty,
  MAX_SIZE_PX,
  MIN_SIZE_PX,
  setLayoutClass,
  WIDTH_PRESETS,
} from "../src/site/layout.ts";

const HERO_LAYOUT =
  "flex flex-col justify-between items-center w-full h-[320px] max-w-5xl md:flex-row lg:grid-cols-3 gap-6 px-4";

function applied(
  className: string,
  property: LayoutProperty,
  utility: string,
): string {
  const result = setLayoutClass(className, property, utility);
  if (!result.ok) throw new Error(result.message);
  return result.className;
}

describe("layout source inspection", () => {
  it("exports the canonical property order, presets and px bounds", () => {
    expect(LAYOUT_PROPERTIES).toEqual([
      "display",
      "flexDirection",
      "justifyContent",
      "alignItems",
      "gridColumns",
      "gridRows",
      "width",
      "height",
    ]);
    expect(MIN_SIZE_PX).toBe(1);
    expect(MAX_SIZE_PX).toBe(4096);
    expect(DISPLAY_PRESETS).toEqual([
      "block",
      "flex",
      "inline-flex",
      "grid",
      "inline-grid",
    ]);
    expect(FLEX_DIRECTION_PRESETS).toEqual([
      "flex-row",
      "flex-col",
      "flex-row-reverse",
      "flex-col-reverse",
    ]);
    expect(JUSTIFY_CONTENT_PRESETS).toEqual([
      "justify-start",
      "justify-end",
      "justify-center",
      "justify-between",
      "justify-around",
      "justify-evenly",
    ]);
    expect(ALIGN_ITEMS_PRESETS).toEqual([
      "items-start",
      "items-end",
      "items-center",
      "items-stretch",
      "items-baseline",
    ]);
    expect(GRID_COLUMNS_PRESETS).toHaveLength(12);
    expect(GRID_ROWS_PRESETS).toHaveLength(12);
    expect(WIDTH_PRESETS).toContain("w-auto");
    expect(WIDTH_PRESETS).toContain("w-1/2");
    expect(WIDTH_PRESETS).toContain("w-px");
    expect(WIDTH_PRESETS).toContain("w-96");
    expect(HEIGHT_PRESETS).toContain("h-full");
    expect(HEIGHT_PRESETS).toContain("h-11/12");
    expect(HEIGHT_PRESETS).toContain("h-96");
  });

  it("reads base layout utilities and ignores responsive variants", () => {
    const settings = inspectLayoutClasses(HERO_LAYOUT);
    expect(settings).toEqual({
      display: {
        state: "value",
        utility: "flex",
        value: "flex",
        expectation: { kind: "literal", value: "flex" },
      },
      flexDirection: {
        state: "value",
        utility: "flex-col",
        value: "flex-col",
        expectation: { kind: "literal", value: "column" },
      },
      justifyContent: {
        state: "value",
        utility: "justify-between",
        value: "justify-between",
        expectation: { kind: "literal", value: "space-between" },
      },
      alignItems: {
        state: "value",
        utility: "items-center",
        value: "items-center",
        expectation: { kind: "literal", value: "center" },
      },
      gridColumns: { state: "unset" },
      gridRows: { state: "unset" },
      width: {
        state: "value",
        utility: "w-full",
        value: "w-full",
        expectation: { kind: "project" },
      },
      height: {
        state: "value",
        utility: "h-[320px]",
        value: "h-[320px]",
        expectation: { kind: "px", value: 320 },
      },
    });
  });

  it("maps display, flexDirection, justifyContent and alignItems expectations", () => {
    for (const preset of DISPLAY_PRESETS) {
      expect(inspectLayoutClasses(preset).display).toEqual({
        state: "value",
        utility: preset,
        value: preset,
        expectation: { kind: "literal", value: preset },
      });
    }
    expect(inspectLayoutClasses("flex-row").flexDirection).toMatchObject({
      value: "flex-row",
      expectation: { kind: "literal", value: "row" },
    });
    expect(
      inspectLayoutClasses("flex-row-reverse").flexDirection,
    ).toMatchObject({
      value: "flex-row-reverse",
      expectation: { kind: "literal", value: "row-reverse" },
    });
    expect(
      inspectLayoutClasses("flex-col-reverse").flexDirection,
    ).toMatchObject({
      value: "flex-col-reverse",
      expectation: { kind: "literal", value: "column-reverse" },
    });
    expect(inspectLayoutClasses("justify-start").justifyContent).toMatchObject({
      expectation: { kind: "literal", value: "flex-start" },
    });
    expect(inspectLayoutClasses("justify-end").justifyContent).toMatchObject({
      expectation: { kind: "literal", value: "flex-end" },
    });
    expect(inspectLayoutClasses("justify-around").justifyContent).toMatchObject(
      {
        expectation: { kind: "literal", value: "space-around" },
      },
    );
    expect(inspectLayoutClasses("justify-evenly").justifyContent).toMatchObject(
      {
        expectation: { kind: "literal", value: "space-evenly" },
      },
    );
    expect(inspectLayoutClasses("items-start").alignItems).toMatchObject({
      expectation: { kind: "literal", value: "flex-start" },
    });
    expect(inspectLayoutClasses("items-end").alignItems).toMatchObject({
      expectation: { kind: "literal", value: "flex-end" },
    });
    expect(inspectLayoutClasses("items-stretch").alignItems).toMatchObject({
      expectation: { kind: "literal", value: "stretch" },
    });
    expect(inspectLayoutClasses("items-baseline").alignItems).toMatchObject({
      expectation: { kind: "literal", value: "baseline" },
    });
  });

  it("maps grid column and row presets 1..12 to track count expectations", () => {
    expect(inspectLayoutClasses("grid grid-cols-1 grid-rows-12")).toMatchObject(
      {
        gridColumns: {
          state: "value",
          utility: "grid-cols-1",
          value: "grid-cols-1",
          expectation: { kind: "tracks", value: 1 },
        },
        gridRows: {
          state: "value",
          utility: "grid-rows-12",
          value: "grid-rows-12",
          expectation: { kind: "tracks", value: 12 },
        },
      },
    );
  });

  it("models width, height and size-* companion shorthand expectations", () => {
    expect(inspectLayoutClasses("w-px h-[12.5px]")).toMatchObject({
      width: {
        state: "value",
        utility: "w-px",
        value: "w-px",
        expectation: { kind: "px", value: 1 },
      },
      height: {
        state: "value",
        utility: "h-[12.5px]",
        value: "h-[12.5px]",
        expectation: { kind: "px", value: 12.5 },
      },
    });
    expect(inspectLayoutClasses("w-[10.000px]").width).toEqual({
      state: "value",
      utility: "w-[10.000px]",
      value: "w-[10px]",
      expectation: { kind: "px", value: 10 },
    });
    expect(inspectLayoutClasses("w-1/2 h-96")).toMatchObject({
      width: {
        state: "value",
        utility: "w-1/2",
        value: "w-1/2",
        expectation: { kind: "project" },
      },
      height: {
        state: "value",
        utility: "h-96",
        value: "h-96",
        expectation: { kind: "project" },
      },
    });
    expect(inspectLayoutClasses("size-20")).toMatchObject({
      width: {
        state: "value",
        utility: "size-20",
        value: "w-20",
        expectation: { kind: "project" },
      },
      height: {
        state: "value",
        utility: "size-20",
        value: "h-20",
        expectation: { kind: "project" },
      },
    });
    expect(inspectLayoutClasses("size-[240px]")).toMatchObject({
      width: {
        state: "value",
        utility: "size-[240px]",
        value: "w-[240px]",
        expectation: { kind: "px", value: 240 },
      },
      height: {
        state: "value",
        utility: "size-[240px]",
        value: "h-[240px]",
        expectation: { kind: "px", value: 240 },
      },
    });
  });

  it("ignores non-conflicting sibling utilities and preserves min/max constraints", () => {
    const className = [
      "table-auto table-fixed",
      "flex-wrap flex-wrap-reverse flex-nowrap flex-1 flex-auto flex-initial flex-none flex-[2_2_0%] flex-(--flex) shrink shrink-0 grow grow-0 basis-1/2",
      "justify-items-center justify-self-end",
      "content-between self-stretch",
      "grid-flow-row-dense auto-cols-max auto-rows-min col-span-2 row-span-3",
      "min-w-0 max-w-4xl min-h-screen max-h-[80vh] [min-width:120px] [max-height:600px]",
    ].join(" ");
    const settings = inspectLayoutClasses(className);
    for (const property of LAYOUT_PROPERTIES) {
      expect(settings[property]).toEqual({ state: "unset" });
    }
    expect(
      inspectLayoutConstraints(`${className} md:max-w-lg hover:min-h-10`),
    ).toEqual({
      width: ["min-w-0", "max-w-4xl", "[min-width:120px]", "md:max-w-lg"],
      height: [
        "min-h-screen",
        "max-h-[80vh]",
        "[max-height:600px]",
        "hover:min-h-10",
      ],
    });
  });

  it.each([
    "inline",
    "inline-block",
    "flow-root",
    "contents",
    "list-item",
    "hidden",
    "table",
    "inline-table",
    "table-caption",
    "table-cell",
    "table-column",
    "table-column-group",
    "table-footer-group",
    "table-header-group",
    "table-row-group",
    "table-row",
    "[display:flex]",
    "!flex",
    "grid!",
  ])("fails closed on unsupported display token %s", (token) => {
    const settings = inspectLayoutClasses(`${token} w-20`);
    expect(settings.display.state).toBe("unsupported");
    expect(settings.width.state).toBe("value");
  });

  it.each([
    "[flex-direction:column]",
    "[flex-flow:row_wrap]",
    "!flex-row",
    "flex-col!",
    "flex-row-custom",
  ])("fails closed on unsupported flexDirection token %s", (token) => {
    const settings = inspectLayoutClasses(`flex ${token}`);
    expect(settings.flexDirection.state).toBe("unsupported");
    expect(settings.display.state).toBe("value");
  });

  it.each([
    "justify-normal",
    "justify-stretch",
    "justify-baseline",
    "justify-center-safe",
    "justify-end-safe",
    "justify-[space-between]",
    "justify-(--justify)",
    "place-content-center",
    "[justify-content:center]",
    "[place-content:space-between]",
    "!justify-center",
    "justify-between!",
  ])("fails closed on unsupported justifyContent token %s", (token) => {
    const settings = inspectLayoutClasses(`flex ${token}`);
    expect(settings.justifyContent.state).toBe("unsupported");
    expect(settings.display.state).toBe("value");
  });

  it.each([
    "items-center-safe",
    "items-end-safe",
    "items-baseline-last",
    "items-[center]",
    "items-(--align)",
    "place-items-center",
    "[align-items:center]",
    "[place-items:stretch]",
    "!items-center",
    "items-start!",
  ])("fails closed on unsupported alignItems token %s", (token) => {
    const settings = inspectLayoutClasses(`flex ${token}`);
    expect(settings.alignItems.state).toBe("unsupported");
    expect(settings.display.state).toBe("value");
  });

  it.each([
    "grid-cols-none",
    "grid-cols-subgrid",
    "grid-cols-0",
    "grid-cols-13",
    "grid-cols-[200px_1fr]",
    "grid-cols-(--cols)",
    "[grid-template-columns:1fr_1fr]",
    "[grid-template:auto/1fr]",
    "[grid:auto/1fr]",
    "!grid-cols-3",
    "grid-cols-4!",
  ])("fails closed on unsupported gridColumns token %s", (token) => {
    const settings = inspectLayoutClasses(`grid ${token}`);
    expect(settings.gridColumns.state).toBe("unsupported");
    expect(settings.display.state).toBe("value");
  });

  it.each([
    "grid-rows-none",
    "grid-rows-subgrid",
    "grid-rows-0",
    "grid-rows-13",
    "grid-rows-[auto_1fr]",
    "grid-rows-(--rows)",
    "[grid-template-rows:1fr_1fr]",
    "[grid-template:auto/1fr]",
    "[grid:auto/1fr]",
    "!grid-rows-2",
    "grid-rows-6!",
  ])("fails closed on unsupported gridRows token %s", (token) => {
    const settings = inspectLayoutClasses(`grid ${token}`);
    expect(settings.gridRows.state).toBe("unsupported");
    expect(settings.display.state).toBe("value");
  });

  it.each([
    "w-0",
    "w-[0px]",
    "w-[4097px]",
    "w-[1.2345px]",
    "-w-4",
    "w-[-10px]",
    "w-screen",
    "w-dvw",
    "w-svw",
    "w-lvw",
    "w-3xs",
    "w-md",
    "w-7xl",
    "w-[50%]",
    "w-[10rem]",
    "w-[var(--w)]",
    "w-(--w)",
    "[width:100px]",
    "[inline-size:100px]",
    "container",
    "!w-20",
    "w-full!",
  ])("fails closed on unsupported width token %s", (token) => {
    const settings = inspectLayoutClasses(`${token} h-20`);
    expect(settings.width.state).toBe("unsupported");
    expect(settings.height.state).toBe("value");
  });

  it.each([
    "h-0",
    "h-[0px]",
    "h-[4097px]",
    "h-[1.2345px]",
    "-h-4",
    "h-[-10px]",
    "h-screen",
    "h-dvh",
    "h-svh",
    "h-lvh",
    "h-[50%]",
    "h-[10rem]",
    "h-[var(--h)]",
    "h-(--h)",
    "[height:100px]",
    "[block-size:100px]",
    "!h-20",
    "h-full!",
  ])("fails closed on unsupported height token %s", (token) => {
    const settings = inspectLayoutClasses(`w-20 ${token}`);
    expect(settings.height.state).toBe("unsupported");
    expect(settings.width.state).toBe("value");
  });

  it.each([
    "size-0",
    "size-screen",
    "size-[50%]",
    "size-[0px]",
    "size-[4097px]",
    "-size-4",
    "!size-20",
    "size-20!",
    "sr-only",
    "not-sr-only",
  ])("marks both width and height unsupported for %s", (token) => {
    const settings = inspectLayoutClasses(`flex ${token}`);
    expect(settings.width.state).toBe("unsupported");
    expect(settings.height.state).toBe("unsupported");
    expect(settings.display.state).toBe("value");
  });

  it("reports conflicting base utilities and mixed size-* combinations as ambiguous", () => {
    expect(inspectLayoutClasses("flex grid").display.state).toBe("ambiguous");
    expect(inspectLayoutClasses("flex-row flex-col").flexDirection.state).toBe(
      "ambiguous",
    );
    expect(
      inspectLayoutClasses("justify-start justify-end").justifyContent.state,
    ).toBe("ambiguous");
    expect(
      inspectLayoutClasses("items-start items-center").alignItems.state,
    ).toBe("ambiguous");
    expect(
      inspectLayoutClasses("grid-cols-2 grid-cols-4").gridColumns.state,
    ).toBe("ambiguous");
    expect(inspectLayoutClasses("grid-rows-1 grid-rows-3").gridRows.state).toBe(
      "ambiguous",
    );

    const conflictingWidths = inspectLayoutClasses("w-10 w-20 h-16");
    expect(conflictingWidths.width.state).toBe("ambiguous");
    expect(conflictingWidths.height.state).toBe("value");

    for (const mixed of [
      "size-20 w-40",
      "size-20 w-20",
      "size-20 h-20",
      "size-20 h-40",
      "size-20 size-20",
      "size-20 size-40",
    ]) {
      const settings = inspectLayoutClasses(mixed);
      expect(settings.width.state).toBe("ambiguous");
      expect(settings.height.state).toBe("ambiguous");
    }

    expect(inspectLayoutClasses("w-20 w-20").width.state).toBe("value");
    expect(inspectLayoutClasses("flex flex").display.state).toBe("value");
  });

  it("refuses an oversized class value", () => {
    const settings = inspectLayoutClasses(`flex ${"p-1 ".repeat(600)}`);
    for (const property of LAYOUT_PROPERTIES) {
      expect(settings[property].state).toBe("unsupported");
    }
  });
});

describe("layout source updates", () => {
  it("replaces an existing base token while preserving variants and neighbours", () => {
    expect(applied(HERO_LAYOUT, "display", "grid")).toBe(
      HERO_LAYOUT.replace("flex ", "grid "),
    );
    expect(applied(HERO_LAYOUT, "flexDirection", "flex-row")).toBe(
      HERO_LAYOUT.replace("flex-col", "flex-row"),
    );
    expect(applied(HERO_LAYOUT, "justifyContent", "justify-center")).toBe(
      HERO_LAYOUT.replace("justify-between", "justify-center"),
    );
    expect(applied(HERO_LAYOUT, "alignItems", "items-stretch")).toBe(
      HERO_LAYOUT.replace("items-center", "items-stretch"),
    );
    expect(applied(HERO_LAYOUT, "width", "w-[640px]")).toBe(
      HERO_LAYOUT.replace("w-full", "w-[640px]"),
    );
    expect(applied(HERO_LAYOUT, "height", "h-auto")).toBe(
      HERO_LAYOUT.replace("h-[320px]", "h-auto"),
    );
  });

  it("expands size-* shorthand in-place when editing width or height", () => {
    expect(applied("flex size-20 items-center", "width", "w-[320px]")).toBe(
      "flex w-[320px] h-20 items-center",
    );
    expect(applied("flex size-20 items-center", "height", "h-full")).toBe(
      "flex w-20 h-full items-center",
    );
    expect(applied("size-[120.00px]", "height", "h-24")).toBe("w-[120px] h-24");
  });

  it("preserves exact original bytes on semantic no-ops including size-*", () => {
    expect(applied("  size-20\tp-4 ", "width", "w-20")).toBe("  size-20\tp-4 ");
    expect(applied("  size-20\tp-4 ", "height", "h-20")).toBe(
      "  size-20\tp-4 ",
    );
    expect(applied("w-[10.000px] p-4", "width", "w-[10px]")).toBe(
      "w-[10.000px] p-4",
    );
    expect(applied("w-20 w-20", "width", "w-20")).toBe("w-20 w-20");
  });

  it("replaces identical duplicate tokens of the edited property only", () => {
    expect(applied("w-20 p-4 w-20", "width", "w-40")).toBe("w-40 p-4 w-40");
    expect(applied("flex p-4 flex", "display", "grid")).toBe("grid p-4 grid");
  });

  it("appends an absent property with a single separating space", () => {
    expect(applied("grid", "gridColumns", "grid-cols-3")).toBe(
      "grid grid-cols-3",
    );
    expect(applied("grid ", "gridRows", "grid-rows-2")).toBe(
      "grid grid-rows-2",
    );
    expect(applied("", "display", "flex")).toBe("flex");
  });

  it("refuses invalid targets, size-* targets, and edits to unsupported or ambiguous properties", () => {
    for (const [property, badTarget] of [
      ["display", "inline-block"],
      ["display", "flex grid"],
      ["display", "!flex"],
      ["flexDirection", "flex-wrap"],
      ["justifyContent", "justify-normal"],
      ["alignItems", "items-baseline-last"],
      ["gridColumns", "grid-cols-13"],
      ["gridRows", "grid-rows-0"],
      ["width", "w-0"],
      ["width", "w-[0px]"],
      ["width", "w-[4097px]"],
      ["width", "w-[1.2345px]"],
      ["width", "size-20"],
      ["width", "h-20"],
      ["height", "h-screen"],
      ["height", ""],
    ] as const) {
      expect(setLayoutClass("p-4", property, badTarget).ok).toBe(false);
    }

    expect(setLayoutClass("size-20 w-40", "width", "w-10").ok).toBe(false);
    expect(setLayoutClass("size-20 w-40", "height", "h-10").ok).toBe(false);
    expect(setLayoutClass("hidden", "display", "flex").ok).toBe(false);
    expect(setLayoutClass("hidden w-20", "width", "w-40").ok).toBe(true);
    expect(
      setLayoutClass("p-1 ".repeat(499), "display", "inline-flex").ok,
    ).toBe(false);
    expect(setLayoutClass("p-4", "unknown" as never, "flex").ok).toBe(false);
  });
});
