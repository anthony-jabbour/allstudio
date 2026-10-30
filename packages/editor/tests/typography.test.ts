import { describe, expect, it } from "vitest";
import {
  inspectTypographyClasses,
  setTypographyClass,
} from "../src/site/typography.ts";

const updated = (
  before: string,
  property: Parameters<typeof setTypographyClass>[1],
  utility: string,
) => {
  const result = setTypographyClass(before, property, utility);
  expect(result.ok).toBe(true);
  return result.ok ? result.className : "REFUSED";
};
describe("scoped typography classes", () => {
  it("changes only base size and preserves explicit leading, variants, whitespace and unrelated duplicates", () => {
    const before =
      "  px-2  px-4 text-5xl\tleading-tight font-semibold text-zinc-950 sm:text-6xl hover:text-red-500  ";
    expect(updated(before, "fontSize", "text-[36px]")).toBe(
      before.replace("text-5xl", "text-[36px]"),
    );
  });
  it("preserves slash leading when setting size and preserves size when setting leading", () => {
    expect(updated("text-base/7 text-white", "fontSize", "text-[36px]")).toBe(
      "text-[36px]/7 text-white",
    );
    expect(
      updated("text-base/7 text-white", "lineHeight", "leading-[1.5]"),
    ).toBe("text-base leading-[1.5] text-white");
    expect(updated("text-[48px]/[1.25]", "fontSize", "text-4xl")).toBe(
      "text-4xl/[1.25]",
    );
  });
  it.each([
    [
      "fontWeight",
      "font-sans font-medium italic text-lg",
      "font-[650]",
      "font-sans font-[650] italic text-lg",
    ],
    [
      "fontFamily",
      "font-sans font-bold text-lg",
      "font-mono",
      "font-mono font-bold text-lg",
    ],
    [
      "lineHeight",
      "text-xl leading-tight",
      "leading-[32px]",
      "text-xl leading-[32px]",
    ],
    [
      "textAlign",
      "text-xl text-left text-red-500",
      "text-center",
      "text-xl text-center text-red-500",
    ],
    [
      "color",
      "text-xl text-red-500/50 md:text-white",
      "text-[#112233]",
      "text-xl text-[#112233]/50 md:text-white",
    ],
    ["color", "text-[#11223380]", "text-[#abcdef]", "text-[#abcdef80]"],
  ] as const)("updates %s without rewriting another group", (property, before, utility, after) => {
    expect(updated(before, property, utility)).toBe(after);
  });
  it("adds only the requested utility when no base setting exists", () => {
    expect(updated("grid gap-4 md:text-lg", "fontSize", "text-[20px]")).toBe(
      "grid gap-4 md:text-lg text-[20px]",
    );
    expect(inspectTypographyClasses("grid md:text-lg").fontSize.state).toBe(
      "unset",
    );
  });
  it("does not confuse arbitrary variant colons with base declarations", () => {
    const before =
      "[&:hover]:text-sm supports-[display:grid]:font-bold text-xl text-balance";
    expect(updated(before, "fontSize", "text-3xl")).toBe(
      before.replace("text-xl", "text-3xl"),
    );
  });
  it("preserves an unsupported colour alpha when changing the independent size", () => {
    expect(
      updated("text-xl text-red-500/[var(--alpha)]", "fontSize", "text-3xl"),
    ).toBe("text-3xl text-red-500/[var(--alpha)]");
    expect(
      inspectTypographyClasses("text-red-500/[var(--alpha)]").color.state,
    ).toBe("unsupported");
  });
  it.each([
    ["fontSize", "text-[var(--hero)]"],
    ["color", "text-[var(--hero)]"],
    ["fontSize", "[font-size:30px]"],
    ["fontWeight", "font-brand"],
    ["fontFamily", "font-brand"],
    ["lineHeight", "leading-[var(--leading)]"],
    ["fontSize", "text-sm!"],
    ["fontWeight", "!font-bold"],
  ] as const)("refuses unknown/important %s source %s", (property, before) => {
    expect(inspectTypographyClasses(before)[property].state).toBe(
      "unsupported",
    );
  });
  it("refuses conflicting base settings but does not normalize identical duplicates", () => {
    expect(
      setTypographyClass("text-sm text-xl", "fontSize", "text-4xl").ok,
    ).toBe(false);
    expect(updated(" text-sm  text-sm ", "fontSize", "text-sm")).toBe(
      " text-sm  text-sm ",
    );
    expect(updated("text-sm text-sm", "fontSize", "text-xl")).toBe(
      "text-xl text-xl",
    );
  });
  it("reports coupling in both inspected groups without inventing rendered defaults", () => {
    const result = inspectTypographyClasses("text-base/7 font-semibold");
    expect(result.fontSize).toMatchObject({
      state: "value",
      value: "text-base",
      utility: "text-base/7",
    });
    expect(result.lineHeight).toMatchObject({
      state: "value",
      value: "leading-7",
    });
    expect(result.color.state).toBe("unset");
    expect(result.fontFamily.state).toBe("unset");
  });
  it("leaves equivalent literal requests completely unchanged", () => {
    expect(
      updated(
        "text-[36.00px] leading-[1.50] text-[#aabbcc]",
        "fontSize",
        "text-[36px]",
      ),
    ).toBe("text-[36.00px] leading-[1.50] text-[#aabbcc]");
    expect(updated("text-[#abc]/50", "color", "text-[#AABBCC]")).toBe(
      "text-[#abc]/50",
    );
    expect(updated("text-base/7", "lineHeight", "leading-7")).toBe(
      "text-base/7",
    );
  });
  it.each([
    ["fontSize", "text-[0px]"],
    ["fontSize", "text-[513px]"],
    ["fontSize", "text-[NaNpx]"],
    ["fontSize", "text-[1.2345px]"],
    ["fontSize", "md:text-xl"],
    ["fontSize", "text-xl/8"],
    ["fontWeight", "font-[1001]"],
    ["lineHeight", "leading-[0]"],
    ["textAlign", "text-[url(x)]"],
    ["color", "text-[#zzzzzz]"],
    ["color", "text-red-500/25"],
    ["fontFamily", "font-[Remote_Font]"],
    ["fontSize", "text-xl bg-red-500"],
  ] as const)("rejects invalid %s target %s", (property, utility) => {
    expect(
      setTypographyClass("text-lg font-medium leading-tight", property, utility)
        .ok,
    ).toBe(false);
  });
});
