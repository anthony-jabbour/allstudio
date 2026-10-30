import { describe, expect, it } from "vitest";
import { inspectSpacingClasses, setSpacingClass } from "../src/site/spacing.ts";

function change(
  source: string,
  property: Parameters<typeof setSpacingClass>[1],
  value: string,
) {
  const result = setSpacingClass(source, property, value);
  expect(result.ok).toBe(true);
  return result.ok ? result.className : result.message;
}

describe("source-backed Base spacing", () => {
  it("preserves the other padding axis when expanding a shorthand", () => {
    expect(change("p-6", "paddingInline", "px-8")).toBe("px-8 py-6");
    expect(change("p-6", "paddingBlock", "py-[12px]")).toBe("px-6 py-[12px]");
  });
  it("preserves column gap when editing row gap", () => {
    expect(change("gap-6", "rowGap", "gap-y-[12px]")).toBe(
      "gap-x-6 gap-y-[12px]",
    );
    expect(change("gap-6", "columnGap", "gap-x-4")).toBe("gap-x-4 gap-y-6");
  });
  it("replaces a valid explicit pair with All without rewriting other bytes", () => {
    expect(change("  px-6\tpy-4  text-lg", "padding", "p-8")).toBe(
      "  p-8\t  text-lg",
    );
    expect(change("gap-x-6 gap-y-4", "gap", "gap-8")).toBe("gap-8 ");
  });
  it("retains unrelated duplicates, order, whitespace and variant scopes", () => {
    const source =
      " grid\tpx-6 py-20  lg:py-28 md:grid-cols-2 text-lg text-lg hover:px-8 ";
    expect(change(source, "paddingInline", "px-[32px]")).toBe(
      source.replace("px-6", "px-[32px]"),
    );
  });
  it("treats a missing Base utility as unset, never as zero", () => {
    expect(inspectSpacingClasses("md:p-8").padding.state).toBe("unset");
    expect(change("md:p-8", "paddingInline", "px-[0px]")).toBe(
      "md:p-8 px-[0px]",
    );
  });
  it("projects shorthand values into axis controls and explicit unequal axes as mixed", () => {
    const result = inspectSpacingClasses("p-6 gap-x-4 gap-y-8");
    expect(result.paddingInline).toMatchObject({
      state: "value",
      value: "px-6",
      utility: "p-6",
    });
    expect(result.gap.state).toBe("mixed");
  });
  it("supports auto and negative margin while preserving its companion", () => {
    expect(change("m-auto", "marginInline", "mx-4")).toBe("mx-4 my-auto");
    expect(change("-m-6", "marginBlock", "my-[12px]")).toBe("-mx-6 my-[12px]");
    expect(change("mx-auto", "marginBlock", "-my-[8px]")).toBe(
      "mx-auto -my-[8px]",
    );
  });
  it.each([
    "p-6 px-8",
    "px-6 px-8",
    "p-6!",
    "!px-6",
    "ps-4 px-6",
    "pt-4",
    "p-[var(--space)]",
    "[padding:8px]",
    "p-(--space)",
    "p-brand",
  ])("refuses unsafe padding representation %s", (source) => {
    expect(setSpacingClass(source, "paddingInline", "px-8").ok).toBe(false);
    expect(setSpacingClass(source, "gap", "gap-4").ok).toBe(true);
  });
  it("retains a no-op shorthand and identical duplicates without normalization", () => {
    expect(change(" p-6\tp-6 ", "paddingInline", "px-6")).toBe(" p-6\tp-6 ");
    expect(change("px-[6.000px]", "paddingInline", "px-[6px]")).toBe(
      "px-[6.000px]",
    );
    expect(change("p-0", "padding", "p-[0px]")).toBe("p-0");
  });
  it.each([
    "px-[-1px]",
    "-px-4",
    "px-auto",
    "px-[2049px]",
    "px-[1.0001px]",
    "px-[calc(4px+8px)]",
    "px-4 hover:px-8",
    "md:px-4",
    "px-[NaNpx]",
    "py-4",
  ])("rejects invalid padding target %s", (target) => {
    expect(setSpacingClass("px-6", "paddingInline", target).ok).toBe(false);
  });
  it("rejects out-of-range negative margin and negative gap", () => {
    expect(setSpacingClass("m-4", "margin", "-m-[2049px]").ok).toBe(false);
    expect(setSpacingClass("gap-4", "gap", "-gap-4").ok).toBe(false);
    expect(change("m-4", "margin", "-m-[2048px]")).toBe("-m-[2048px]");
  });
  it("refuses arbitrary physical/logical spacing properties without affecting typography", () => {
    expect(
      inspectSpacingClasses("[margin-inline-start:4px]").marginInline.state,
    ).toBe("unsupported");
    expect(inspectSpacingClasses("[row-gap:4px]").rowGap.state).toBe(
      "unsupported",
    );
    expect(setSpacingClass("gap-x-4 gap-y-8", "rowGap", "gap-y-6").ok).toBe(
      true,
    );
  });
});
