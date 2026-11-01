import { expect, it } from "vitest";
import { parseReorderBody } from "../src/site/requests.ts";

const request = {
  path: "src/app/page.tsx",
  oid: "a",
  siblingOid: "b",
  direction: "up",
  expectedSha256: "a".repeat(64),
};
it("accepts exactly the bounded adjacent sibling request", () => {
  expect(parseReorderBody(request)).toEqual(request);
  expect(parseReorderBody({ ...request, direction: "down" })).toMatchObject({
    direction: "down",
  });
});
it.each([
  null,
  [],
  {},
  { ...request, path: "a".repeat(1025) },
  { ...request, siblingOid: "a" },
  { ...request, siblingOid: "<script>" },
  { ...request, direction: "left" },
  { ...request, expectedSha256: "stale" },
  { ...request, source: "arbitrary" },
  { ...request, path: 3 },
])("refuses malformed, oversized, ambiguous or privileged fields", (body) =>
  expect(parseReorderBody(body)).toBeNull());
