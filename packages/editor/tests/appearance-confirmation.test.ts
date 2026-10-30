import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appearanceTargets,
  observesAppearance,
} from "../src/shell/appearance-confirmation.ts";

const measured = {
  backgroundColor: "rgb(2, 132, 199)",
  backgroundImage: "none",
  borderRadius: "33554400px",
};
const CTA = "rounded-full bg-sky-600 px-5 hover:bg-sky-500";

function targets(before: string, after: string, observed = measured) {
  const result = appearanceTargets(before, after, observed);
  if (!result.ok) throw new Error(result.message);
  return result.targets;
}

describe("appearance rendered confirmation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("targets only the changed property", () => {
    expect(
      targets(CTA, CTA.replace("rounded-full", "rounded-[12px]")).map(
        (item) => item.property,
      ),
    ).toEqual(["borderRadius"]);
    expect(
      targets(CTA, CTA.replace("bg-sky-600", "bg-white")).map(
        (item) => item.property,
      ),
    ).toEqual(["backgroundColor"]);
    expect(targets(CTA, CTA)).toEqual([]);
  });
  it("treats a normalized-equal hex as unchanged", () => {
    expect(targets("bg-[#ABC]", "bg-[#aabbcc]")).toEqual([]);
  });
  it("refuses a change it cannot verify or measure", () => {
    expect(appearanceTargets(CTA, "rounded-t-lg bg-sky-600", measured).ok).toBe(
      false,
    );
    expect(
      appearanceTargets(CTA, CTA.replace("bg-sky-600", "bg-brand"), measured)
        .ok,
    ).toBe(false);
    expect(
      appearanceTargets(CTA, CTA.replace("bg-sky-600", "bg-white"), {
        ...measured,
        backgroundColor: null,
      }).ok,
    ).toBe(false);
    expect(
      appearanceTargets(CTA, CTA.replace("rounded-full", "rounded-lg"), {
        ...measured,
        borderRadius: null,
      }).ok,
    ).toBe(false);
  });
  it("matches a literal radius and rejects nearby or per-corner output", () => {
    const list = targets(CTA, CTA.replace("rounded-full", "rounded-[12px]"));
    expect(
      observesAppearance({ ...measured, borderRadius: "12px" }, list),
    ).toBe(true);
    expect(
      observesAppearance({ ...measured, borderRadius: "12.5px" }, list),
    ).toBe(false);
    expect(
      observesAppearance({ ...measured, borderRadius: "12px 0px" }, list),
    ).toBe(false);
    expect(observesAppearance(measured, list)).toBe(false);
  });
  it("matches the none preset as a zero literal", () => {
    const list = targets(CTA, CTA.replace("rounded-full", "rounded-none"));
    expect(observesAppearance({ ...measured, borderRadius: "0px" }, list)).toBe(
      true,
    );
  });
  it("does not confirm a radius preset when rendered corners stay unequal", () => {
    const list = targets(CTA, CTA.replace("rounded-full", "rounded-lg"));
    expect(
      observesAppearance({ ...measured, borderRadius: "4px 8px 8px" }, list),
    ).toBe(false);
    expect(
      observesAppearance(
        { ...measured, borderRadius: "8px 8px 8px 8px" },
        list,
      ),
    ).toBe(true);
  });
  it("requires an actual change for project presets", () => {
    const list = targets(CTA, CTA.replace("rounded-full", "rounded-lg"));
    expect(observesAppearance(measured, list)).toBe(false);
    expect(observesAppearance({ ...measured, borderRadius: "8px" }, list)).toBe(
      true,
    );
    const bg = targets(CTA, CTA.replace("bg-sky-600", "bg-white"));
    expect(observesAppearance(measured, bg)).toBe(false);
    expect(
      observesAppearance(
        { ...measured, backgroundColor: "rgb(255, 255, 255)" },
        bg,
      ),
    ).toBe(true);
  });
  it("does not confirm a colour hidden behind a background image or gradient", () => {
    const list = targets(CTA, CTA.replace("bg-sky-600", "bg-white"));
    expect(
      observesAppearance(
        {
          ...measured,
          backgroundColor: "rgb(255, 255, 255)",
          backgroundImage: "linear-gradient(red, blue)",
        },
        list,
      ),
    ).toBe(false);
    expect(
      observesAppearance(
        {
          ...measured,
          backgroundColor: "rgb(255, 255, 255)",
          backgroundImage: null,
        },
        list,
      ),
    ).toBe(false);
  });
  it("compares literal colours as sRGB and rejects a wrong or unparsable result", () => {
    const table: Record<string, number[]> = {
      "#112233": [17, 34, 51, 255],
      "rgb(17, 34, 51)": [17, 34, 51, 255],
      "rgb(18, 34, 51)": [18, 34, 51, 255],
      "rgb(1, 2, 3)": [1, 2, 3, 255],
    };
    vi.stubGlobal("CSS", { supports: () => true });
    vi.stubGlobal("document", {
      createElement: () => ({
        getContext: () => {
          let current = "";
          return {
            clearRect() {},
            fillRect() {},
            set fillStyle(value: string) {
              current = value;
            },
            getImageData: () => ({ data: table[current] ?? [0, 0, 0, 0] }),
          };
        },
      }),
    });
    const list = targets(CTA, CTA.replace("bg-sky-600", "bg-[#112233]"));
    const observed = (backgroundColor: string) => ({
      ...measured,
      backgroundColor,
    });
    expect(observesAppearance(observed("rgb(17, 34, 51)"), list)).toBe(true);
    expect(observesAppearance(observed("rgb(18, 34, 51)"), list)).toBe(true);
    expect(observesAppearance(observed("rgb(1, 2, 3)"), list)).toBe(false);
    expect(observesAppearance(observed("rgb(2, 132, 199)"), list)).toBe(false);
  });
  it("never confirms a literal colour when no colour parser is available", () => {
    const list = targets(CTA, CTA.replace("bg-sky-600", "bg-[#112233]"));
    expect(
      observesAppearance(
        { ...measured, backgroundColor: "rgb(17, 34, 51)" },
        list,
      ),
    ).toBe(false);
  });
});
