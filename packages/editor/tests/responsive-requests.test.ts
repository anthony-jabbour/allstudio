import { describe, expect, it } from "vitest";
import { parseClassEditBody } from "../src/site/requests.ts";

const request = {
  path: "src/app/page.tsx",
  oid: "abc",
  expectedSha256: "a".repeat(64),
  className: "text-lg md:text-xl",
};
describe("responsive property request schema", () => {
  it("preserves legacy class requests and accepts only a fixed optional breakpoint", () => {
    expect(parseClassEditBody(request)).toEqual(request);
    for (const breakpoint of ["base", "sm", "md", "lg", "xl", "2xl"]) {
      expect(parseClassEditBody({ ...request, breakpoint })).toEqual({
        ...request,
        breakpoint,
      });
    }
  });
  it.each([
    undefined,
    null,
    "",
    "hover",
    "md:hover",
    "../md",
    {},
    [],
  ])("rejects invalid supplied breakpoint %s", (breakpoint) => {
    expect(parseClassEditBody({ ...request, breakpoint })).toBeNull();
  });
  it("keeps existing payload limits and rejects additional metadata/path commands", () => {
    expect(
      parseClassEditBody({ ...request, breakpoint: "md", css: "private" }),
    ).toBeNull();
    expect(
      parseClassEditBody({
        ...request,
        breakpoint: "md",
        className: "x".repeat(1001),
      }),
    ).toBeNull();
  });
});
