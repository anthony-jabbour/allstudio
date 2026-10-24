import { parseProjectManifest } from "@allstudio/project";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EDITOR_STATUS, EditorShell } from "../src/index.ts";

describe("EditorShell", () => {
  it("renders as a scaffold, not a working editor", () => {
    expect(EDITOR_STATUS).toBe("scaffold");
    const html = renderToStaticMarkup(createElement(EditorShell));
    expect(html).toContain("Editor scaffold");
    expect(html).toContain("not implemented yet");
  });

  it("displays a parsed project manifest name", () => {
    const manifest = parseProjectManifest({
      schemaVersion: 1,
      projectId: "22222222-2222-4222-8222-222222222222",
      name: "Fixture Site",
      artifacts: [{ id: "site", kind: "site", path: "src/app/page.tsx" }],
      createdAt: "2026-10-24T00:00:00.000Z",
    });
    const html = renderToStaticMarkup(createElement(EditorShell, { manifest }));
    expect(html).toContain("Fixture Site");
  });
});
