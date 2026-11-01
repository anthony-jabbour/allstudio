import { expect, it } from "vitest";
import { observesReorder } from "../src/shell/reorder-confirmation.ts";

const element = {
  oid: "moved",
  instances: 1,
  neighbors: {
    previous: null,
    next: { oid: "peer", nodeId: "n3", instances: 1 },
  },
};
const receipt = { oid: "moved", siblingOid: "peer", direction: "up" as const };
it("confirms identity and reversed direct adjacency, never geometry or arbitrary tree order alone", () => {
  expect(observesReorder(element, receipt)).toBe(true);
  expect(
    observesReorder(
      {
        ...element,
        neighbors: { previous: element.neighbors.next, next: null },
      },
      { ...receipt, direction: "down" },
    ),
  ).toBe(true);
  for (const actual of [
    { ...element, oid: "other" },
    { ...element, instances: 2 },
    { ...element, neighbors: { previous: element.neighbors.next, next: null } },
    {
      ...element,
      neighbors: {
        previous: null,
        next: { ...element.neighbors.next, instances: 2 },
      },
    },
    { ...element, neighbors: { previous: null, next: null } },
  ])
    expect(observesReorder(actual, receipt)).toBe(false);
});
