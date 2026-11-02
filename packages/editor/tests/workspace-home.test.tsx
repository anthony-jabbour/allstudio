import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkspaceHome } from "../src/shell/workspace-home.tsx";

describe("WorkspaceHome", () => {
  it("renders host-provided cards without exposing search-only paths", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceHome, {
        sidebarLabel: "Workspace navigation",
        sidebarHeader: createElement("div", null, "Local workspace"),
        sections: [
          {
            label: "Primary",
            items: [{ label: "Recents", current: true }],
          },
        ],
        search: "",
        searchLabel: "Search projects",
        searchPlaceholder: "Search projects…",
        onSearchChange: () => {},
        title: "Recents",
        regionLabel: "Recent local projects",
        actions: createElement("button", { type: "button" }, "Open project"),
        items: [
          {
            id: "local-site",
            name: "Marketing site",
            detail: "client-site",
            searchText: "/Users/jabbo/sites/client-site",
            preview: createElement("span", null, "Project preview"),
            onOpen: () => {},
          },
        ],
        view: "grid",
        onViewChange: () => {},
        busy: false,
        emptyMessage: "Open a project to start editing.",
        noResultsMessage: "No projects match your search.",
      }),
    );

    expect(html).toContain('aria-label="Recent local projects"');
    expect(html).toContain("Marketing site");
    expect(html).toContain("client-site");
    expect(html).toContain("Project preview");
    expect(html).not.toContain("/Users/jabbo/sites/client-site");
  });
});
