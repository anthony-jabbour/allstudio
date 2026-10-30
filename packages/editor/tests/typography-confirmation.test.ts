import { describe, expect, it } from "vitest";
import {
  observesTypography,
  typographyTargets,
} from "../src/shell/typography-confirmation.ts";

const style = {
  fontSize: "36px",
  fontWeight: "650",
  lineHeight: "54px",
  textAlign: "center",
  color: "rgb(0, 0, 0)",
  fontFamily: "Arial",
};
describe("typography observation", () => {
  it("requires measured literal values rather than just a changed class", () => {
    const targets = typographyTargets(
      "text-lg font-medium text-left",
      "text-[36px] font-[650] text-center",
      { ...style, fontSize: "18px", fontWeight: "500", textAlign: "left" },
    );
    expect(targets.ok).toBe(true);
    if (!targets.ok) return;
    expect(observesTypography(style, targets.targets)).toBe(true);
    expect(
      observesTypography({ ...style, fontWeight: "650.1" }, targets.targets),
    ).toBe(false);
    expect(
      observesTypography({ ...style, fontSize: "36.1px" }, targets.targets),
    ).toBe(false);
  });
  it("uses the currently observed size for a requested line-height ratio", () => {
    const targets = typographyTargets(
      "text-4xl leading-tight",
      "text-[36px] leading-[1.5]",
      { ...style, fontSize: "48px", lineHeight: "60px" },
    );
    expect(targets.ok).toBe(true);
    if (!targets.ok) return;
    expect(observesTypography(style, targets.targets)).toBe(true);
    expect(
      observesTypography({ ...style, lineHeight: "60px" }, targets.targets),
    ).toBe(false);
  });
  it("does not confirm an unchanged rendered value hidden by a responsive override", () => {
    const result = typographyTargets(
      "text-lg md:text-[36px]",
      "text-[36px] md:text-[36px]",
      style,
    );
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(observesTypography(style, result.targets)).toBe(false);
  });
  it("does not guess a project preset definition or an unavailable baseline", () => {
    const target = typographyTargets("font-sans", "font-mono", style);
    expect(target.ok).toBe(true);
    if (!target.ok) return;
    expect(observesTypography(style, target.targets)).toBe(false);
    expect(
      observesTypography(
        { ...style, fontFamily: "Geist Mono" },
        target.targets,
      ),
    ).toBe(true);
    expect(
      typographyTargets("font-sans", "font-mono", {
        ...style,
        fontFamily: null,
      }).ok,
    ).toBe(false);
  });
  it("does not create typography verification for unrelated draft classes", () => {
    expect(typographyTargets("px-2 text-lg", "px-4 text-lg", style)).toEqual({
      ok: true,
      targets: [],
    });
    expect(typographyTargets("text-lg", "text-[var(--size)]", style).ok).toBe(
      false,
    );
  });
});
