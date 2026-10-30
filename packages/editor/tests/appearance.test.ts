import { describe, expect, it } from "vitest";
import {
  type APPEARANCE_PROPERTIES,
  inspectAppearanceClasses,
  setAppearanceClass,
} from "../src/site/appearance.ts";

const CTA =
  "rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-500 focus-visible:outline-2 focus-visible:outline-sky-600";

function applied(
  className: string,
  property: (typeof APPEARANCE_PROPERTIES)[number],
  utility: string,
): string {
  const result = setAppearanceClass(className, property, utility);
  if (!result.ok) throw new Error(result.message);
  return result.className;
}

describe("appearance source inspection", () => {
  it("reads the static Harbor call-to-action base settings", () => {
    const settings = inspectAppearanceClasses(CTA);
    expect(settings.backgroundColor).toEqual({
      state: "value",
      utility: "bg-sky-600",
      value: "bg-sky-600",
      expectation: { kind: "project" },
    });
    expect(settings.borderRadius).toEqual({
      state: "value",
      utility: "rounded-full",
      value: "rounded-full",
      expectation: { kind: "project" },
    });
  });
  it("does not treat text colours, variants or outline colours as background", () => {
    expect(
      inspectAppearanceClasses(
        "text-white hover:bg-red-500 dark:bg-[#000000] md:rounded-lg outline-sky-600",
      ),
    ).toEqual({
      backgroundColor: { state: "unset" },
      borderRadius: { state: "unset" },
    });
  });
  it("normalizes hex literals and models alpha as a rendered expectation", () => {
    expect(inspectAppearanceClasses("bg-[#ABC]").backgroundColor).toMatchObject(
      {
        state: "value",
        value: "bg-[#aabbcc]",
        expectation: { kind: "color", value: "#aabbcc" },
      },
    );
    expect(
      inspectAppearanceClasses("bg-[#112233]/50").backgroundColor,
    ).toMatchObject({
      state: "value",
      value: "bg-[#112233]/50",
      expectation: {
        kind: "color",
        value: "color-mix(in oklab, #112233 50%, transparent)",
      },
    });
  });
  it("models radius literals, the none preset and project presets", () => {
    expect(
      inspectAppearanceClasses("rounded-[12px]").borderRadius,
    ).toMatchObject({
      state: "value",
      expectation: { kind: "literal", value: 12 },
    });
    expect(
      inspectAppearanceClasses("rounded-[0.5px]").borderRadius,
    ).toMatchObject({ expectation: { kind: "literal", value: 0.5 } });
    expect(inspectAppearanceClasses("rounded-none").borderRadius).toMatchObject(
      { expectation: { kind: "literal", value: 0 } },
    );
    expect(inspectAppearanceClasses("rounded").borderRadius).toMatchObject({
      value: "rounded",
      expectation: { kind: "project" },
    });
    expect(inspectAppearanceClasses("rounded-2xl").borderRadius).toMatchObject({
      expectation: { kind: "project" },
    });
  });
  it("ignores background images, gradients, sizing and position utilities", () => {
    const settings = inspectAppearanceClasses(
      "bg-linear-to-r from-sky-500 to-sky-700 bg-cover bg-center bg-no-repeat bg-[url(/hero.png)] bg-fixed bg-clip-text bg-origin-border bg-none bg-size-[10px_20px] bg-[position:10px_20px] bg-[image:linear-gradient(red,blue)] bg-blend-multiply bg-sky-600",
    );
    expect(settings.backgroundColor).toMatchObject({
      state: "value",
      value: "bg-sky-600",
    });
    expect(
      inspectAppearanceClasses("bg-[url(/a.png)] bg-cover").backgroundColor,
    ).toEqual({ state: "unset" });
  });
  it.each([
    ["project token", "bg-brand"],
    ["variable", "bg-[var(--surface)]"],
    ["variable shorthand", "bg-(--surface)"],
    ["typed colour", "bg-[color:red]"],
    ["function colour", "bg-[rgb(1,2,3)]"],
    ["named arbitrary", "bg-[red]"],
    ["important prefix", "!bg-red-500"],
    ["important suffix", "bg-red-500!"],
    ["arbitrary property", "[background-color:red]"],
    ["arbitrary background property", "[background:red]"],
    ["bad alpha", "bg-sky-600/150"],
    ["bad hex", "bg-[#12]"],
  ])("fails closed on unsupported background: %s", (_label, className) => {
    const settings = inspectAppearanceClasses(`rounded-lg ${className}`);
    expect(settings.backgroundColor.state).toBe("unsupported");
    expect(settings.borderRadius.state).toBe("value");
  });
  it.each([
    ["side", "rounded-t-lg"],
    ["corner", "rounded-tl-xl"],
    ["logical side", "rounded-s-lg"],
    ["logical corner", "rounded-ee-lg"],
    ["bare side", "rounded-b"],
    ["arbitrary property", "[border-radius:4px]"],
    ["arbitrary corner property", "[border-top-left-radius:4px]"],
    ["variable", "rounded-(--radius)"],
    ["unit", "rounded-[1em]"],
    ["percent", "rounded-[50%]"],
    ["out of range", "rounded-[2049px]"],
    ["precision", "rounded-[1.2345px]"],
    ["negative", "rounded-[-1px]"],
    ["important", "!rounded-lg"],
    ["unknown preset", "rounded-huge"],
  ])("fails closed on unsupported radius: %s", (_label, className) => {
    const settings = inspectAppearanceClasses(`bg-white ${className}`);
    expect(settings.borderRadius.state).toBe("unsupported");
    expect(settings.backgroundColor.state).toBe("value");
  });
  it("reports conflicting base settings as ambiguous without ordering guesses", () => {
    expect(
      inspectAppearanceClasses("bg-white bg-black").backgroundColor.state,
    ).toBe("ambiguous");
    expect(
      inspectAppearanceClasses("rounded-lg rounded-xl").borderRadius.state,
    ).toBe("ambiguous");
    expect(
      inspectAppearanceClasses("bg-white bg-white").backgroundColor.state,
    ).toBe("value");
  });
  it("refuses an oversized class value", () => {
    const settings = inspectAppearanceClasses(`bg-white ${"p-1 ".repeat(600)}`);
    expect(settings.backgroundColor.state).toBe("unsupported");
    expect(settings.borderRadius.state).toBe("unsupported");
  });
});

describe("appearance source updates", () => {
  it("changes only the base background token and keeps hover and focus bytes", () => {
    expect(applied(CTA, "backgroundColor", "bg-[#112233]")).toBe(
      CTA.replace("bg-sky-600", "bg-[#112233]"),
    );
  });
  it("changes only the radius token", () => {
    expect(applied(CTA, "borderRadius", "rounded-[12px]")).toBe(
      CTA.replace("rounded-full", "rounded-[12px]"),
    );
  });
  it("applies both groups to the same source without disturbing neighbours", () => {
    const first = applied(CTA, "backgroundColor", "bg-white");
    expect(applied(first, "borderRadius", "rounded-none")).toBe(
      CTA.replace("bg-sky-600", "bg-white").replace(
        "rounded-full",
        "rounded-none",
      ),
    );
  });
  it("returns exact original bytes for a semantic no-op", () => {
    expect(
      applied("bg-[#AABBCC]  p-4", "backgroundColor", "bg-[#aabbcc]"),
    ).toBe("bg-[#AABBCC]  p-4");
    expect(applied(CTA, "borderRadius", "rounded-full")).toBe(CTA);
    expect(applied("bg-white bg-white", "backgroundColor", "bg-white")).toBe(
      "bg-white bg-white",
    );
  });
  it("appends an absent group once with a single space", () => {
    expect(applied("p-4", "backgroundColor", "bg-white")).toBe("p-4 bg-white");
    expect(applied("p-4 ", "borderRadius", "rounded-lg")).toBe(
      "p-4 rounded-lg",
    );
    expect(applied("", "backgroundColor", "bg-black")).toBe("bg-black");
    expect(
      applied("hover:bg-red-500 md:rounded-lg", "backgroundColor", "bg-white"),
    ).toBe("hover:bg-red-500 md:rounded-lg bg-white");
  });
  it("preserves images and gradients when adding or replacing a colour", () => {
    expect(
      applied("bg-[url(/a.png)] bg-cover", "backgroundColor", "bg-white"),
    ).toBe("bg-[url(/a.png)] bg-cover bg-white");
    expect(
      applied(
        "bg-linear-to-r from-sky-500 bg-sky-600",
        "backgroundColor",
        "bg-white",
      ),
    ).toBe("bg-linear-to-r from-sky-500 bg-white");
  });
  it("retains an existing slash alpha when only the colour changes", () => {
    expect(
      applied("bg-sky-600/50 p-4", "backgroundColor", "bg-[#112233]"),
    ).toBe("bg-[#112233]/50 p-4");
    expect(applied("bg-[#112233]/50", "backgroundColor", "bg-white")).toBe(
      "bg-white/50",
    );
  });
  it("retains literal hex alpha and refuses a preset that would drop it", () => {
    expect(applied("bg-[#11223380]", "backgroundColor", "bg-[#445566]")).toBe(
      "bg-[#44556680]",
    );
    const refused = setAppearanceClass(
      "bg-[#11223380]",
      "backgroundColor",
      "bg-white",
    );
    expect(refused.ok).toBe(false);
  });
  it("replaces every identical duplicate of the edited property only", () => {
    expect(
      applied("bg-white p-4 bg-white", "backgroundColor", "bg-black"),
    ).toBe("bg-black p-4 bg-black");
  });
  it("accepts every supported radius preset and range boundary", () => {
    for (const utility of [
      "rounded",
      "rounded-none",
      "rounded-xs",
      "rounded-sm",
      "rounded-md",
      "rounded-lg",
      "rounded-xl",
      "rounded-2xl",
      "rounded-3xl",
      "rounded-4xl",
      "rounded-full",
      "rounded-[0px]",
      "rounded-[2048px]",
      "rounded-[0.125px]",
    ])
      expect(setAppearanceClass("p-4", "borderRadius", utility).ok).toBe(true);
  });
  it.each([
    ["rounded-[2049px]"],
    ["rounded-[1.2345px]"],
    ["rounded-[-1px]"],
    ["rounded-[12em]"],
    ["rounded-t-lg"],
    ["rounded-huge"],
    ["rounded-lg p-4"],
    ["rounded-lg/50"],
    ["!rounded-lg"],
    ["rounded-lg\nfixed"],
    ["bg-white"],
    [""],
  ])("refuses an invalid radius target %j", (utility) => {
    expect(setAppearanceClass("p-4", "borderRadius", utility).ok).toBe(false);
  });
  it.each([
    ["bg-[#12]"],
    ["bg-[#112233]/50"],
    ["bg-brand"],
    ["bg-[var(--x)]"],
    ["bg-[url(/x.png)]"],
    ["bg-cover"],
    ["bg-white p-4"],
    ["bg-white\nfixed"],
    ["!bg-white"],
    ["text-white"],
    [""],
  ])("refuses an invalid background target %j", (utility) => {
    expect(setAppearanceClass("p-4", "backgroundColor", utility).ok).toBe(
      false,
    );
  });
  it("refuses edits to unsupported or ambiguous groups with a reason", () => {
    for (const [className, property, target] of [
      ["rounded-t-lg", "borderRadius", "rounded-xl"],
      ["bg-brand", "backgroundColor", "bg-white"],
      ["bg-white bg-black", "backgroundColor", "bg-red-500"],
      ["rounded-lg rounded-xl", "borderRadius", "rounded-none"],
    ] as const) {
      const result = setAppearanceClass(className, property, target);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message.length).toBeGreaterThan(10);
    }
  });
  it("leaves an unaffected group editable when its sibling is unsupported", () => {
    expect(applied("bg-brand rounded-lg", "borderRadius", "rounded-none")).toBe(
      "bg-brand rounded-none",
    );
    expect(
      applied("rounded-t-lg bg-white", "backgroundColor", "bg-black"),
    ).toBe("rounded-t-lg bg-black");
  });
  it("refuses a result that would exceed the supported class size", () => {
    expect(
      setAppearanceClass("p-1 ".repeat(499), "borderRadius", "rounded-lg").ok,
    ).toBe(false);
  });
  it("rejects an unknown property key", () => {
    expect(setAppearanceClass("p-4", "color" as never, "bg-white").ok).toBe(
      false,
    );
  });
});
