import { parseProjectManifest } from "@allstudio/project";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  EDITOR_STATUS,
  EditorShell,
  type SourceEditWorkspace,
  sourceEditFailure,
} from "../src/index.ts";

const unusedWorkspace: SourceEditWorkspace = {
  locate: async () => sourceEditFailure("unavailable"),
  previewTextEdit: async () => sourceEditFailure("unavailable"),
  applyTextEdit: async () => sourceEditFailure("unavailable"),
  previewClassEdit: async () => sourceEditFailure("unavailable"),
  applyClassEdit: async () => sourceEditFailure("unavailable"),
};

describe("EditorShell", () => {
  it("states the slice scope and needs a workspace to edit", () => {
    expect(EDITOR_STATUS).toBe("text-and-class-edit-slice");
    const html = renderToStaticMarkup(createElement(EditorShell));
    expect(html).toContain("not implemented yet");
    expect(html).toContain("No preview workspace connected.");
    expect(html).not.toContain("<iframe");
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

  it("renders a sandboxed cross-origin preview with disabled edit controls", () => {
    const html = renderToStaticMarkup(
      createElement(EditorShell, {
        previewUrl: "http://localhost:3101",
        workspace: unusedWorkspace,
      }),
    );
    expect(html).toContain('src="http://localhost:3101"');
    expect(html).toContain(
      'sandbox="allow-scripts allow-same-origin allow-forms"',
    );
    expect(html).not.toContain("allow-top-navigation");
    expect(html).not.toContain("allow-popups");
    expect(html).toContain("Preview bridge: connecting");
    expect(html.match(/<input type="text"[^>]*disabled=""/g)).toHaveLength(2);
    expect(html).toContain(
      '<button type="button" disabled="">Apply text</button>',
    );
    expect(html).toContain(
      '<button type="button" disabled="">Apply classes</button>',
    );
    expect(html).toContain(
      '<button type="button" disabled="">Apply appearance</button>',
    );
    expect(html).toContain('aria-label="Appearance"');
  });
  it("provides a Studio toolbar, appearance and honest navigation before layers exist", () => {
    const html = renderToStaticMarkup(
      createElement(EditorShell, {
        previewUrl: "http://localhost:3101",
        workspace: unusedWorkspace,
      }),
    );
    expect(html).toContain('aria-label="Studio toolbar"');
    expect(html).toContain('aria-label="Appearance"');
    expect(html).toContain('value="system"');
    expect(html).toContain('value="light"');
    expect(html).toContain('value="dark"');
    expect(html).toContain('aria-label="Project navigator"');
    expect(html).toContain("Rendered source elements");
    expect(html).toContain('aria-label="Canvas"');
  });

  it("renders host project controls without granting preview privileges", () => {
    const html = renderToStaticMarkup(
      createElement(EditorShell, {
        projectControls: createElement(
          "button",
          { type: "button" },
          "Open project",
        ),
      }),
    );
    expect(html).toContain("Open project");
    expect(html).not.toContain("<iframe");
  });
});
