/**
 * allstudio preview bridge — runs inside the previewed project page.
 *
 * This file is copied verbatim into a development workspace and bundled by
 * the project's own toolchain, so it must stay self-contained (no imports).
 * Its constants mirror `protocol.ts`; `tests/preview-bridge.test.ts` keeps
 * them in sync.
 *
 * The bridge exposes nothing to the page. It only talks to the parent window
 * at one fixed editor origin: it reports which `data-oid` element was clicked
 * and the rendered state of one tracked element. Clicks are swallowed while
 * connected so the preview does not navigate away.
 */
export interface PreviewBridgeConfig {
  editorOrigin: string;
}

const EDITOR_SOURCE = "allstudio-editor";
const PREVIEW_SOURCE = "allstudio-preview";
const VERSION = 1;
const OID_ATTRIBUTE = "data-oid";
const MAX_TEXT_LENGTH = 2000;

export function installPreviewBridge(config: PreviewBridgeConfig): void {
  if (typeof window === "undefined" || window.parent === window) {
    return;
  }
  const parent = window.parent;
  let nonce: string | null = null;
  let tracked: string | null = null;
  let reportScheduled = false;

  const post = (message: Record<string, unknown>) => {
    parent.postMessage(
      { source: PREVIEW_SOURCE, version: VERSION, ...message },
      config.editorOrigin,
    );
  };

  const snapshot = (oid: string) => {
    const matches = document.querySelectorAll(
      `[${OID_ATTRIBUTE}="${CSS.escape(oid)}"]`,
    );
    const element = matches[0];
    if (!element) {
      return null;
    }
    const rect = element.getBoundingClientRect();
    return {
      oid,
      tagName: element.tagName.toLowerCase(),
      text: (element.textContent ?? "").slice(0, MAX_TEXT_LENGTH),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      instances: matches.length,
    };
  };

  const reportTracked = () => {
    reportScheduled = false;
    if (nonce && tracked) {
      post({
        type: "element",
        nonce,
        oid: tracked,
        element: snapshot(tracked),
      });
    }
  };

  const scheduleReport = () => {
    if (!reportScheduled && tracked) {
      reportScheduled = true;
      requestAnimationFrame(reportTracked);
    }
  };

  window.addEventListener("message", (event) => {
    if (event.source !== parent || event.origin !== config.editorOrigin) {
      return;
    }
    const data: unknown = event.data;
    if (typeof data !== "object" || data === null) {
      return;
    }
    const message = data as Record<string, unknown>;
    if (
      message.source !== EDITOR_SOURCE ||
      message.version !== VERSION ||
      typeof message.nonce !== "string"
    ) {
      return;
    }
    if (message.type === "hello") {
      nonce = message.nonce;
      tracked = null;
      post({ type: "ready", nonce });
      return;
    }
    if (message.nonce !== nonce) {
      return;
    }
    if (message.type === "track") {
      tracked = typeof message.oid === "string" ? message.oid : null;
      reportTracked();
    }
  });

  document.addEventListener(
    "click",
    (event) => {
      if (!nonce) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const target = event.target instanceof Element ? event.target : null;
      const owner = target?.closest(`[${OID_ATTRIBUTE}]`) ?? null;
      const oid = owner?.getAttribute(OID_ATTRIBUTE) ?? null;
      tracked = oid;
      post({
        type: "select",
        nonce,
        clickedTag: target ? target.tagName.toLowerCase() : "",
        element: oid ? snapshot(oid) : null,
      });
    },
    true,
  );

  window.addEventListener("scroll", scheduleReport, true);
  window.addEventListener("resize", scheduleReport);
  new MutationObserver(scheduleReport).observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  });

  post({ type: "boot" });
}
