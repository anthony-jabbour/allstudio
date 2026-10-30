import { describe, expect, it } from "vitest";
import {
  observesSpacing,
  spacingTargets,
} from "../src/shell/spacing-confirmation.ts";

const measured = {
  display: "grid",
  paddingInlineStart: "24px",
  paddingInlineEnd: "24px",
  paddingBlockStart: "24px",
  paddingBlockEnd: "24px",
  marginInlineStart: "20px",
  marginInlineEnd: "20px",
  marginBlockStart: "0px",
  marginBlockEnd: "0px",
  rowGap: "24px",
  columnGap: "24px",
};
describe("spacing rendered confirmation", () => {
  it("targets only the changed axis after shorthand expansion", () => {
    const result = spacingTargets(
      "p-6 gap-6",
      "px-[32px] py-6 gap-6",
      measured,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.targets.map((item) => item.key)).toEqual([
      "paddingInlineStart",
      "paddingInlineEnd",
    ]);
    expect(
      observesSpacing(
        { ...measured, paddingInlineStart: "32px", paddingInlineEnd: "32px" },
        result.targets,
      ),
    ).toBe(true);
    expect(
      observesSpacing(
        { ...measured, paddingInlineStart: "32px" },
        result.targets,
      ),
    ).toBe(false);
  });
  it("does not confirm same-value source changes or responsive overrides", () => {
    const result = spacingTargets(
      "px-6 lg:px-[24px]",
      "px-[24px] lg:px-[24px]",
      measured,
    );
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(observesSpacing(measured, result.targets)).toBe(false);
  });
  it("matches negative margin literals and rejects a nearby incorrect result", () => {
    const result = spacingTargets("my-4", "-my-[8px]", measured);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      observesSpacing(
        { ...measured, marginBlockStart: "-8px", marginBlockEnd: "-8px" },
        result.targets,
      ),
    ).toBe(true);
    expect(
      observesSpacing(
        { ...measured, marginBlockStart: "-8.1px", marginBlockEnd: "-8px" },
        result.targets,
      ),
    ).toBe(false);
  });
  it("does not guess the pixels of project presets or auto margins", () => {
    const result = spacingTargets("mx-auto", "mx-4", measured);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(observesSpacing(measured, result.targets)).toBe(false);
    expect(
      observesSpacing(
        { ...measured, marginInlineStart: "16px", marginInlineEnd: "16px" },
        result.targets,
      ),
    ).toBe(true);
  });
  it("does not require an unchanged gap companion to change", () => {
    const result = spacingTargets("gap-6", "gap-x-6 gap-y-[12px]", measured);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.targets.map((item) => item.key)).toEqual(["rowGap"]);
    expect(
      observesSpacing({ ...measured, rowGap: "12px" }, result.targets),
    ).toBe(true);
  });
  it("keeps inactive block gap visually unconfirmed even if its computed value changes", () => {
    const result = spacingTargets("gap-6", "gap-y-[12px] gap-x-6", {
      ...measured,
      display: "block",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      observesSpacing(
        { ...measured, display: "block", rowGap: "12px" },
        result.targets,
      ),
    ).toBe(false);
  });
  it("refuses missing baseline/unsupported output and ignores unrelated classes", () => {
    expect(
      spacingTargets("px-6", "px-8", { ...measured, paddingInlineEnd: null })
        .ok,
    ).toBe(false);
    expect(spacingTargets("px-6", "px-[var(--pad)]", measured).ok).toBe(false);
    expect(spacingTargets("px-6 text-lg", "px-6 text-xl", measured)).toEqual({
      ok: true,
      targets: [],
    });
  });
});
