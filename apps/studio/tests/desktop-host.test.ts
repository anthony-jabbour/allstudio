import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WebsiteEditorEntry } from "../src/home/home.tsx";

describe("shared Studio Electron host", () => {
  it("renders an accessible website-editor entry for the desktop host", () => {
    const html = renderToStaticMarkup(
      createElement(WebsiteEditorEntry, { onOpen: () => {} }),
    );

    expect(html).toContain('aria-label="Website projects"');
    expect(html).toContain("Website projects");
  });
});
