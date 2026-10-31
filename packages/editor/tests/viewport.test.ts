import { describe, expect, it } from "vitest";
import {
  breakpointForWidth,
  fitScale,
  isViewportWidth,
  VIEWPORT_PRESETS,
} from "../src/shell/viewport.ts";

describe("viewport presets and width", () => {
  it("exposes the four specified preset widths as valid viewport widths", () => {
    expect(VIEWPORT_PRESETS).toEqual([
      { label: "Mobile", width: 390 },
      { label: "Tablet", width: 768 },
      { label: "Laptop", width: 1024 },
      { label: "Desktop", width: 1440 },
    ]);
    for (const preset of VIEWPORT_PRESETS) {
      expect(isViewportWidth(preset.width)).toBe(true);
    }
  });

  it.each([320, 390, 768, 1440, 2560])("accepts integer width %i", (width) => {
    expect(isViewportWidth(width)).toBe(true);
  });

  it.each([
    319,
    2561,
    320.5,
    768.25,
    NaN,
    Infinity,
    -Infinity,
    "768",
    null,
    undefined,
  ])("rejects invalid viewport width %s", (width) => {
    expect(isViewportWidth(width)).toBe(false);
  });
});

describe("breakpointForWidth", () => {
  it.each([
    [320, "base"],
    [639, "base"],
    [640, "sm"],
    [767, "sm"],
    [768, "md"],
    [1023, "md"],
    [1024, "lg"],
    [1279, "lg"],
    [1280, "xl"],
    [1535, "xl"],
    [1536, "2xl"],
    [2560, "2xl"],
  ] as const)("maps width %i to %s", (width, breakpoint) => {
    expect(breakpointForWidth(width)).toBe(breakpoint);
  });

  it.each([
    319,
    2561,
    640.5,
    NaN,
    Infinity,
    -Infinity,
  ])("throws for invalid width %s", (width) => {
    expect(() => breakpointForWidth(width)).toThrow(RangeError);
  });
});

describe("fitScale", () => {
  it("fits against the tighter width or height constraint", () => {
    expect(fitScale(1440, 900, 720, 900)).toBe(0.5);
    expect(fitScale(390, 844, 800, 400)).toBeCloseTo(400 / 844);
  });

  it("caps the result at one and floors it at one tenth", () => {
    expect(fitScale(390, 844, 800, 1000)).toBe(1);
    expect(fitScale(1000, 1000, 50, 50)).toBe(0.1);
  });

  it.each([
    [0, 100, 100, 100],
    [-1, 100, 100, 100],
    [NaN, 100, 100, 100],
    [Infinity, 100, 100, 100],
    [100, 0, 100, 100],
    [100, -1, 100, 100],
    [100, NaN, 100, 100],
    [100, Infinity, 100, 100],
    [100, 100, 0, 100],
    [100, 100, -1, 100],
    [100, 100, NaN, 100],
    [100, 100, Infinity, 100],
    [100, 100, 100, 0],
    [100, 100, 100, -1],
    [100, 100, 100, NaN],
    [100, 100, 100, Infinity],
  ])("returns null for invalid geometry %j", (width, height, availableWidth, availableHeight) => {
    expect(fitScale(width, height, availableWidth, availableHeight)).toBeNull();
  });
});
