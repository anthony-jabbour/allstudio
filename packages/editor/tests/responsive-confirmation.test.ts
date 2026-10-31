import { expect, it } from "vitest";
import {
  appearanceTargets,
  observesAppearance,
} from "../src/shell/appearance-confirmation.ts";
import {
  layoutTargets,
  observesLayout,
} from "../src/shell/layout-confirmation.ts";
import {
  observesSpacing,
  spacingTargets,
} from "../src/shell/spacing-confirmation.ts";
import {
  observesTypography,
  typographyTargets,
} from "../src/shell/typography-confirmation.ts";

it("verifies the selected scope, preserving inactive scopes and requiring a rendered change after removal", () => {
  const type = {
    fontSize: "48px",
    fontWeight: "600",
    lineHeight: "52px",
    textAlign: "left",
    color: "rgb(0, 0, 0)",
    fontFamily: "sans-serif",
  };
  const spacing = {
    paddingInlineStart: "24px",
    paddingInlineEnd: "24px",
    paddingBlockStart: "24px",
    paddingBlockEnd: "24px",
    marginInlineStart: "0px",
    marginInlineEnd: "0px",
    marginBlockStart: "0px",
    marginBlockEnd: "0px",
    columnGap: "16px",
    rowGap: "16px",
    display: "flex",
    flexDirection: "row",
    flexWrap: "nowrap",
  };
  const appearance = {
    backgroundColor: "rgb(255, 255, 255)",
    backgroundImage: "none",
    borderRadius: "8px",
  };
  const layout = {
    display: "flex",
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gridTemplateColumns: "none",
    gridTemplateRows: "none",
    width: "200px",
    height: "100px",
    minWidth: "0px",
    maxWidth: "none",
    minHeight: "0px",
    maxHeight: "none",
  };
  const t = typographyTargets(
    "text-xl md:text-5xl lg:text-6xl",
    "text-xl md:text-[36px] lg:text-6xl",
    type,
    "md",
  );
  expect(t.ok && t.targets.length).toBe(1);
  if (t.ok)
    expect(observesTypography({ ...type, fontSize: "36px" }, t.targets)).toBe(
      true,
    );
  const removed = typographyTargets(
    "text-xl md:text-5xl",
    "text-xl",
    type,
    "md",
  );
  expect(removed.ok && removed.targets.length).toBe(1);
  if (removed.ok) {
    expect(observesTypography(type, removed.targets)).toBe(false);
    expect(
      observesTypography({ ...type, fontSize: "20px" }, removed.targets),
    ).toBe(true);
  }
  const s = spacingTargets("p-2 md:p-6", "p-2 md:py-6", spacing, "md");
  expect(s.ok && s.targets.length).toBe(2);
  if (s.ok)
    expect(
      observesSpacing(
        { ...spacing, paddingInlineStart: "8px", paddingInlineEnd: "8px" },
        s.targets,
      ),
    ).toBe(true);
  const a = appearanceTargets(
    "rounded md:rounded-lg",
    "rounded",
    appearance,
    "md",
  );
  expect(a.ok && a.targets.length).toBe(1);
  if (a.ok)
    expect(
      observesAppearance({ ...appearance, borderRadius: "4px" }, a.targets),
    ).toBe(true);
  const l = layoutTargets("w-20 md:size-20", "w-20 md:h-20", layout, "md");
  expect(l.ok && l.targets.length).toBe(1);
  if (l.ok)
    expect(observesLayout({ ...layout, width: "80px" }, l.targets)).toBe(true);
  expect(typographyTargets("text-xl", "text-lg", type, "md")).toEqual({
    ok: true,
    targets: [],
  });
  expect(typographyTargets("text-xl", "", type).ok).toBe(false);
});
