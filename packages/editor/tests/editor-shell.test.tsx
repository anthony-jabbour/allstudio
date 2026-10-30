import { parseProjectManifest } from "@allstudio/project";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  EDITOR_STATUS,
  EditorShell,
  hasUnsavedInspectorDraft,
  type SourceEditWorkspace,
  type SourceElementInfo,
  sourceEditFailure,
} from "../src/index.ts";
import { LayoutInspector } from "../src/shell/layout-inspector.tsx";

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
    expect(html).toContain(
      '<button type="button" disabled="">Preview layout patch</button>',
    );
    expect(html).toContain(
      '<button type="button" disabled="">Apply layout</button>',
    );
    expect(html).toContain('aria-label="Layout"');
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

  it("renders LayoutInspector controls, rendered testids, and inactive/constraint notes", () => {
    const html = renderToStaticMarkup(
      createElement(LayoutInspector, {
        className:
          "mx-auto grid max-w-5xl w-[800px] size-20 gap-8 md:grid-cols-2",
        sourceKnown: true,
        disabled: false,
        rendered: {
          display: "grid",
          flexDirection: "row",
          justifyContent: "normal",
          alignItems: "normal",
          gridTemplateColumns: "480px 480px",
          gridTemplateRows: "200px",
          width: "800px",
          height: "80px",
          minWidth: "0px",
          maxWidth: "1024px",
          minHeight: "0px",
          maxHeight: "none",
        },
        onChange: () => {},
        onPreview: () => {},
        onApply: () => {},
        onValidityChange: () => {},
      }),
    );
    expect(html).toContain('aria-label="Layout"');
    expect(html).toContain('aria-label="Display preset"');
    expect(html).toContain('aria-label="Flex direction preset"');
    expect(html).toContain('aria-label="Justify content preset"');
    expect(html).toContain('aria-label="Align items preset"');
    expect(html).toContain('aria-label="Grid columns preset"');
    expect(html).toContain('aria-label="Grid rows preset"');
    expect(html).toContain('aria-label="Width preset"');
    expect(html).toContain('aria-label="Height preset"');
    expect(html).toContain(
      "Flex direction is inactive for rendered display grid",
    );
    expect(html).toContain('data-testid="constraint-width"');
    expect(html).toContain("source max-w-5xl · max 1024px");
    expect(html).toContain(
      "Conflicting base utilities make this property ambiguous. Resolve them in Classes first.",
    );
  });

  it("renders the discovered Pages list with eligible static routes and unsupported route badges", () => {
    const html = renderToStaticMarkup(
      createElement(EditorShell, {
        previewUrl: "http://localhost:3101/",
        workspace: unusedWorkspace,
        activeRoute: "/",
        routes: [
          { route: "/", sourcePath: "src/app/page.tsx" },
          { route: "/about", sourcePath: "src/app/about/page.tsx" },
        ],
        unsupportedRoutes: [
          {
            route: "/journal/[slug]",
            sourcePath: "src/app/journal/[slug]/page.tsx",
            reason: "dynamic-route",
            message:
              "Dynamic route /journal/[slug] (src/app/journal/[slug]/page.tsx) requires runtime parameters and cannot be previewed directly.",
          },
        ],
      }),
    );
    expect(html).toContain('aria-label="Pages"');
    expect(html).toContain('data-route="/"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("src/app/page.tsx");
    expect(html).toContain('data-route="/about"');
    expect(html).toContain("src/app/about/page.tsx");
    expect(html).toContain('data-unsupported-route="/journal/[slug]"');
    expect(html).toContain("Dynamic");
    expect(html).toContain(
      "Dynamic route /journal/[slug] (src/app/journal/[slug]/page.tsx) requires runtime parameters and cannot be previewed directly.",
    );
  });

  it("computes unsaved inspector draft state accurately for route navigation guards", () => {
    const baseSource: SourceElementInfo = {
      path: "src/app/page.tsx",
      sha256: "a".repeat(64),
      location: {
        oid: "hero-heading",
        path: "src/app/page.tsx",
        start: { line: 7, column: 6 },
        end: { line: 12, column: 11 },
        component: "Home",
      },
      text: { ok: true, text: "Aurora Atelier" },
      className: { ok: true, value: "text-5xl font-semibold" },
    };
    const cleanInput = {
      source: baseSource,
      draft: "Aurora Atelier",
      classDraft: "text-5xl font-semibold",
      typographyValid: true,
      spacingValid: true,
      appearanceValid: true,
      layoutValid: true,
      hasPendingRefresh: false,
    };

    expect(
      hasUnsavedInspectorDraft({
        ...cleanInput,
        source: null,
        draft: "Modified without selection",
      }),
    ).toBe(false);
    expect(hasUnsavedInspectorDraft(cleanInput)).toBe(false);
    expect(
      hasUnsavedInspectorDraft({
        ...cleanInput,
        draft: "Unsaved heading draft",
      }),
    ).toBe(true);
    expect(
      hasUnsavedInspectorDraft({
        ...cleanInput,
        classDraft: "text-5xl font-bold",
      }),
    ).toBe(true);
    expect(
      hasUnsavedInspectorDraft({
        ...cleanInput,
        typographyValid: false,
      }),
    ).toBe(true);
    expect(
      hasUnsavedInspectorDraft({
        ...cleanInput,
        spacingValid: false,
      }),
    ).toBe(true);
    expect(
      hasUnsavedInspectorDraft({
        ...cleanInput,
        appearanceValid: false,
      }),
    ).toBe(true);
    expect(
      hasUnsavedInspectorDraft({
        ...cleanInput,
        layoutValid: false,
      }),
    ).toBe(true);
    expect(
      hasUnsavedInspectorDraft({
        ...cleanInput,
        hasPendingRefresh: true,
      }),
    ).toBe(true);
  });
});
