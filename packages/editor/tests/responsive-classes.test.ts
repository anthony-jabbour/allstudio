import { describe, expect, it } from "vitest";
import {
  clearAppearanceClass,
  inspectAppearanceClasses,
  setAppearanceClass,
} from "../src/site/appearance.ts";
import {
  clearLayoutClass,
  inspectLayoutClasses,
  setLayoutClass,
} from "../src/site/layout.ts";
import {
  clearSpacingClass,
  inspectSpacingClasses,
  setSpacingClass,
} from "../src/site/spacing.ts";
import {
  clearTypographyClass,
  inspectTypographyClasses,
  setTypographyClass,
} from "../src/site/typography.ts";

function value(
  result: { ok: true; className: string } | { ok: false; message: string },
) {
  expect(result.ok).toBe(true);
  return result.ok ? result.className : result.message;
}
describe("exact breakpoint source edits", () => {
  it("edits only md typography and preserves slash leading, whitespace and other scopes", () => {
    const source =
      "text-lg\tmd:text-4xl/7  md:hover:text-8xl lg:text-6xl dark:text-white";
    expect(
      value(setTypographyClass(source, "fontSize", "text-[36px]", "md")),
    ).toBe(source.replace("md:text-4xl/7", "md:text-[36px]/7"));
    expect(inspectTypographyClasses(source, "md").fontSize).toMatchObject({
      state: "value",
      utility: "md:text-4xl/7",
      value: "text-4xl",
    });
  });
  it("splits only the selected padding and gap shorthands", () => {
    expect(
      value(
        setSpacingClass(
          "p-2 md:p-6 lg:p-8 md:hover:px-4",
          "paddingInline",
          "px-8",
          "md",
        ),
      ),
    ).toBe("p-2 md:px-8 md:py-6 lg:p-8 md:hover:px-4");
    expect(
      value(setSpacingClass("gap-2 md:gap-6", "rowGap", "gap-y-[12px]", "md")),
    ).toBe("gap-2 md:gap-x-6 md:gap-y-[12px]");
    expect(
      inspectSpacingClasses("p-2 md:p-6", "md").paddingInline,
    ).toMatchObject({ state: "value", utility: "md:p-6", value: "px-6" });
  });
  it("retains selected colour alpha without touching image or state variants", () => {
    expect(
      value(
        setAppearanceClass(
          "bg-black md:bg-[#1234]/50 md:bg-cover md:hover:bg-white",
          "backgroundColor",
          "bg-[#aabbcc]",
          "md",
        ),
      ),
    ).toBe("bg-black md:bg-[#aabbcc44]/50 md:bg-cover md:hover:bg-white");
    expect(
      inspectAppearanceClasses("rounded-sm md:rounded-xl", "md").borderRadius,
    ).toMatchObject({ state: "value", utility: "md:rounded-xl" });
  });
  it("retains the selected size companion and other layout scopes", () => {
    expect(
      value(
        setLayoutClass(
          "w-4 md:size-20 lg:w-80 md:hover:w-96",
          "width",
          "w-[320px]",
          "md",
        ),
      ),
    ).toBe("w-4 md:w-[320px] md:h-20 lg:w-80 md:hover:w-96");
    expect(
      inspectLayoutClasses("grid-cols-1 md:grid-cols-2", "md").gridColumns,
    ).toMatchObject({ state: "value", utility: "md:grid-cols-2" });
  });
  it.each([
    "sm",
    "md",
    "lg",
    "xl",
    "2xl",
  ] as const)("can insert a missing %s token without guessing its inherited source", (scope) => {
    const source = " text-lg md:hover:text-xl ";
    expect(
      value(setTypographyClass(source, "fontWeight", "font-bold", scope)),
    ).toBe(`${source}${scope}:font-bold`);
    expect(inspectTypographyClasses("text-lg", scope).fontSize.state).toBe(
      "unset",
    );
  });
  it("retains Base behavior and exact scoped no-op bytes", () => {
    expect(
      value(setTypographyClass("text-lg md:text-4xl", "fontSize", "text-xl")),
    ).toBe("text-xl md:text-4xl");
    const source = " md:p-6\tmd:p-6 ";
    expect(value(setSpacingClass(source, "paddingInline", "px-6", "md"))).toBe(
      source,
    );
  });
  it("refuses unsafe selected groups without rejecting independent foreign scopes", () => {
    expect(
      setTypographyClass("md:text-[var(--size)]", "fontSize", "text-xl", "md")
        .ok,
    ).toBe(false);
    expect(
      setSpacingClass("md:p-6 md:px-8", "paddingInline", "px-4", "md").ok,
    ).toBe(false);
    expect(
      setAppearanceClass("md:rounded-lg!", "borderRadius", "rounded-xl", "md")
        .ok,
    ).toBe(false);
    expect(
      setLayoutClass("md:grid-cols-subgrid", "gridColumns", "grid-cols-2", "md")
        .ok,
    ).toBe(false);
    expect(
      value(
        setSpacingClass(
          "p-[var(--space)] md:p-6",
          "paddingInline",
          "px-8",
          "md",
        ),
      ),
    ).toBe("p-[var(--space)] md:px-8 md:py-6");
  });
  it("rejects invalid scope and prefixed targets", () => {
    expect(setSpacingClass("p-4", "padding", "p-6", "hover" as never).ok).toBe(
      false,
    );
    expect(
      setTypographyClass("md:text-lg", "fontSize", "lg:text-xl", "md").ok,
    ).toBe(false);
    expect(
      setLayoutClass("md:w-4", "width", "w-8", "md:hover" as never).ok,
    ).toBe(false);
  });
});

describe("clear a supported responsive override", () => {
  it("retains slash companions when clearing typography", () => {
    expect(
      value(
        clearTypographyClass(
          "text-lg md:text-4xl/7 lg:text-6xl",
          "fontSize",
          "md",
        ),
      ),
    ).toBe("text-lg md:leading-7 lg:text-6xl");
    expect(
      value(clearTypographyClass("text-lg md:text-4xl/7", "lineHeight", "md")),
    ).toBe("text-lg md:text-4xl");
  });
  it("retains box/gap companions and permits a known mixed All removal", () => {
    expect(
      value(clearSpacingClass("p-2 md:p-6 lg:p-8", "paddingInline", "md")),
    ).toBe("p-2 md:py-6 lg:p-8");
    expect(value(clearSpacingClass("gap-2 md:gap-6", "rowGap", "md"))).toBe(
      "gap-2 md:gap-x-6",
    );
    expect(
      value(clearSpacingClass("md:px-4 md:py-8 lg:p-8", "padding", "md")),
    ).toBe("  lg:p-8");
  });
  it("retains size companions when clearing sizing", () => {
    expect(
      value(clearLayoutClass("w-4 md:size-20 lg:w-80", "width", "md")),
    ).toBe("w-4 md:h-20 lg:w-80");
    expect(value(clearLayoutClass("h-4 md:size-20", "height", "md"))).toBe(
      "h-4 md:w-20",
    );
  });
  it("clears only appearance/display at the exact scope", () => {
    expect(
      value(
        clearAppearanceClass(
          "bg-black md:bg-[#112233]/50 md:bg-cover md:hover:bg-white",
          "backgroundColor",
          "md",
        ),
      ),
    ).toBe("bg-black  md:bg-cover md:hover:bg-white");
    expect(
      value(clearLayoutClass("flex md:grid lg:flex", "display", "md")),
    ).toBe("flex  lg:flex");
  });
  it("is no-op when absent and refuses Base/ambiguous/important targets", () => {
    expect(value(clearSpacingClass("p-6", "paddingInline", "md"))).toBe("p-6");
    expect(clearSpacingClass("p-6", "paddingInline", "base").ok).toBe(false);
    expect(clearLayoutClass("md:flex md:grid", "display", "md").ok).toBe(false);
    expect(clearTypographyClass("md:!text-lg", "fontSize", "md").ok).toBe(
      false,
    );
  });
});

it("does not exceed the full source class limit when prefixing or clearing companions", () => {
  expect(
    setLayoutClass(`${" ".repeat(1995)}w-4`, "width", "w-[4096px]", "md").ok,
  ).toBe(false);
  expect(
    clearSpacingClass(`${" ".repeat(1994)}md:p-6`, "paddingInline", "md").ok,
  ).toBe(false);
});

it("retains exact scoped alpha no-op source without doubling its prefix", () => {
  const text = "text-black md:text-[#1234]/50 lg:text-white";
  expect(value(setTypographyClass(text, "color", "text-[#112233]", "md"))).toBe(
    text,
  );
  const background = "bg-black md:bg-[#1234]/50 md:bg-cover";
  expect(
    value(
      setAppearanceClass(background, "backgroundColor", "bg-[#112233]", "md"),
    ),
  ).toBe(background);
});

it("names the ambiguous selected scope while preserving the existing Base message", () => {
  const scoped = inspectLayoutClasses("md:flex md:grid", "md").display;
  expect(scoped.state).toBe("ambiguous");
  if (scoped.state === "ambiguous")
    expect(scoped.message).toContain("Conflicting md utilities");
  const base = inspectLayoutClasses("flex grid").display;
  expect(base.state).toBe("ambiguous");
  if (base.state === "ambiguous")
    expect(base.message).toBe(
      "Conflicting base utilities make this property ambiguous. Resolve them in Classes first.",
    );
});
