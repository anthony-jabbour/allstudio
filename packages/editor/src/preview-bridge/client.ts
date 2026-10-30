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
const VERSION = 4;
const OID_ATTRIBUTE = "data-oid";
const MAX_TEXT_LENGTH = 2000;
const MAX_LAYER_NODES = 1000;
const MAX_LAYER_DEPTH = 64;
const MAX_LAYER_LABEL_LENGTH = 80;
const MAX_LAYER_VISITS = 10000;
const TYPOGRAPHY_KEYS = [
  "fontSize",
  "fontWeight",
  "lineHeight",
  "textAlign",
  "color",
  "fontFamily",
] as const;
const SPACING_KEYS = [
  "display",
  "paddingInlineStart",
  "paddingInlineEnd",
  "paddingBlockStart",
  "paddingBlockEnd",
  "marginInlineStart",
  "marginInlineEnd",
  "marginBlockStart",
  "marginBlockEnd",
  "rowGap",
  "columnGap",
] as const;

export function installPreviewBridge(config: PreviewBridgeConfig): void {
  if (typeof window === "undefined" || window.parent === window) return;
  const parent = window.parent;
  let nonce: string | null = null;
  let tracked: string | null = null;
  let trackedElement: Element | null = null;
  let reportScheduled = false;
  let layersDirty = false;
  let generation = 0;
  let previousTree = "";
  let nextId = 1;
  const ids = new WeakMap<Element, string>();
  let layerTargets = new Map<string, { element: Element; oid: string }>();
  const validOid = (value: unknown): value is string =>
    typeof value === "string" && /^[a-z0-9\-._:]{1,64}$/.test(value);
  const nodeId = (element: Element) => {
    let id = ids.get(element);
    if (!id) {
      id = `n${nextId++}`;
      ids.set(element, id);
    }
    return id;
  };
  const post = (message: Record<string, unknown>) => {
    parent.postMessage(
      { source: PREVIEW_SOURCE, version: VERSION, ...message },
      config.editorOrigin,
    );
  };
  const snapshot = (element: Element | null) => {
    const oid = element?.getAttribute(OID_ATTRIBUTE);
    if (!element?.isConnected || !validOid(oid)) return null;
    // This existing whole-document count is deliberately independent of tree truncation.
    const instances = document.querySelectorAll(
      `[${OID_ATTRIBUTE}="${CSS.escape(oid)}"]`,
    ).length;
    const rect = element.getBoundingClientRect();
    const typography = Object.fromEntries(
      TYPOGRAPHY_KEYS.map((key) => [key, null]),
    ) as Record<(typeof TYPOGRAPHY_KEYS)[number], string | null>;
    const spacing = Object.fromEntries(
      SPACING_KEYS.map((key) => [key, null]),
    ) as Record<(typeof SPACING_KEYS)[number], string | null>;
    try {
      const style = getComputedStyle(element);
      for (const key of TYPOGRAPHY_KEYS) {
        const observed = style[key];
        typography[key] = observed && observed.length <= 256 ? observed : null;
      }
      for (const key of SPACING_KEYS) {
        const observed = style[key];
        spacing[key] = observed && observed.length <= 256 ? observed : null;
      }
    } catch {
      // A detached/unavailable measurement is not a default property value.
    }
    return {
      spacing,
      typography,
      nodeId: nodeId(element),
      oid,
      tagName: element.tagName.toLowerCase(),
      text: (element.textContent ?? "").slice(0, MAX_TEXT_LENGTH),
      className: (element.getAttribute("class") ?? "").slice(
        0,
        MAX_TEXT_LENGTH,
      ),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      instances,
    };
  };
  const uniqueElement = (oid: string) => {
    const matches = document.querySelectorAll(
      `[${OID_ATTRIBUTE}="${CSS.escape(oid)}"]`,
    );
    return matches.length === 1 ? (matches[0] ?? null) : null;
  };
  const labelFor = (element: Element) => {
    const named =
      element.getAttribute("aria-label") || element.getAttribute("alt");
    if (named) return named.slice(0, MAX_LAYER_LABEL_LENGTH);
    let text = "";
    for (
      let i = 0;
      i < Math.min(element.childNodes.length, 20) &&
      text.length < MAX_LAYER_LABEL_LENGTH;
      i++
    ) {
      const child = element.childNodes[i];
      if (child?.nodeType === Node.TEXT_NODE)
        text += `${(child.textContent ?? "").slice(0, MAX_LAYER_LABEL_LENGTH)} `;
    }
    return text.replace(/\s+/g, " ").trim().slice(0, MAX_LAYER_LABEL_LENGTH);
  };
  const collectLayers = () => {
    const nodes: Array<{
      id: string;
      parentId: string | null;
      oid: string;
      tagName: string;
      label: string;
    }> = [];
    const targets = new Map<string, { element: Element; oid: string }>();
    const stack: Array<{
      next: Element | null;
      parentId: string | null;
      depth: number;
    }> = [];
    let element: Element | null = document.body;
    let parentId: string | null = null;
    let depth = 1;
    let visits = 0;
    let truncated = false;
    while (element && visits < MAX_LAYER_VISITS) {
      visits++;
      const tagName = element.tagName.toLowerCase();
      const skip = [
        "script",
        "style",
        "template",
        "noscript",
        "nextjs-portal",
        "next-route-announcer",
      ].includes(tagName);
      let includedParent: string | null = parentId;
      const oid = element.getAttribute(OID_ATTRIBUTE);
      if (!skip && validOid(oid)) {
        if (nodes.length === MAX_LAYER_NODES) {
          truncated = true;
          break;
        }
        const id = nodeId(element);
        nodes.push({ id, parentId, oid, tagName, label: labelFor(element) });
        targets.set(id, { element, oid });
        includedParent = id;
      }
      const child: Element | null = skip ? null : element.firstElementChild;
      if (child && depth < MAX_LAYER_DEPTH) {
        stack.push({ next: element.nextElementSibling, parentId, depth });
        element = child;
        parentId = includedParent;
        depth++;
      } else {
        if (child) truncated = true;
        let next: Element | null = element.nextElementSibling;
        while (!next && stack.length) {
          const frame = stack.pop();
          if (!frame) break;
          next = frame.next;
          parentId = frame.parentId;
          depth = frame.depth;
        }
        element = next;
      }
    }
    if (element) truncated = true;
    layerTargets = targets;
    return { nodes, truncated };
  };
  const reportLayers = (force = false) => {
    if (!nonce) return;
    layersDirty = false;
    const tree = collectLayers();
    const serialized = JSON.stringify(tree);
    if (serialized !== previousTree) {
      previousTree = serialized;
      generation++;
      force = true;
    }
    if (force) post({ type: "layers", nonce, generation, ...tree });
  };
  const reportTracked = () => {
    if (!nonce || !tracked) return;
    if (
      !trackedElement?.isConnected ||
      trackedElement.getAttribute(OID_ATTRIBUTE) !== tracked
    ) {
      trackedElement = uniqueElement(tracked);
    }
    post({
      type: "element",
      nonce,
      oid: tracked,
      element: snapshot(trackedElement),
    });
  };
  const scheduleReport = (inspectLayers = false) => {
    if (!nonce) return;
    layersDirty ||= inspectLayers;
    if (reportScheduled) return;
    reportScheduled = true;
    requestAnimationFrame(() => {
      reportScheduled = false;
      if (layersDirty) reportLayers();
      reportTracked();
    });
  };
  const select = (element: Element | null, clickedTag: string) => {
    trackedElement = element;
    const oid = element?.getAttribute(OID_ATTRIBUTE);
    tracked = validOid(oid) ? oid : null;
    post({ type: "select", nonce, clickedTag, element: snapshot(element) });
  };

  window.addEventListener("message", (event) => {
    if (event.source !== parent || event.origin !== config.editorOrigin) return;
    const data: unknown = event.data;
    if (typeof data !== "object" || data === null || Array.isArray(data))
      return;
    const message = data as Record<string, unknown>;
    if (
      message.source !== EDITOR_SOURCE ||
      message.version !== VERSION ||
      typeof message.nonce !== "string"
    )
      return;
    if (message.type === "hello") {
      nonce = message.nonce;
      tracked = null;
      trackedElement = null;
      post({ type: "ready", nonce });
      reportLayers(true);
      return;
    }
    if (!nonce || message.nonce !== nonce) return;
    if (message.type === "track") {
      if (message.oid !== null && !validOid(message.oid)) return;
      tracked = message.oid;
      trackedElement = tracked ? uniqueElement(tracked) : null;
      reportTracked();
    } else if (message.type === "select-layer") {
      if (
        Object.keys(message).some(
          (key) =>
            ![
              "source",
              "version",
              "type",
              "nonce",
              "generation",
              "nodeId",
            ].includes(key),
        ) ||
        !Number.isSafeInteger(message.generation) ||
        (message.generation as number) < 1 ||
        typeof message.nodeId !== "string" ||
        !/^n[1-9][0-9]{0,15}$/.test(message.nodeId)
      )
        return;
      // Recollect synchronously: a mutation may precede this event's scheduled report.
      reportLayers();
      if (message.generation !== generation) {
        post({ type: "layer-error", nonce, reason: "stale-layer" });
        return;
      }
      const target = layerTargets.get(message.nodeId);
      if (
        !target?.element.isConnected ||
        target.element.getAttribute(OID_ATTRIBUTE) !== target.oid
      ) {
        post({ type: "layer-error", nonce, reason: "missing-layer" });
        return;
      }
      target.element.scrollIntoView({ block: "nearest", inline: "nearest" });
      select(target.element, target.element.tagName.toLowerCase());
    }
  });
  document.addEventListener(
    "click",
    (event) => {
      if (!nonce) return;
      event.preventDefault();
      event.stopPropagation();
      const target = event.target instanceof Element ? event.target : null;
      select(
        target?.closest(`[${OID_ATTRIBUTE}]`) ?? null,
        target?.tagName.toLowerCase() ?? "",
      );
    },
    true,
  );
  window.addEventListener("scroll", () => scheduleReport(), true);
  window.addEventListener("resize", () => scheduleReport());
  document.addEventListener("load", () => scheduleReport(), true);
  document.fonts?.addEventListener("loadingdone", () => scheduleReport());
  new MutationObserver((records) =>
    scheduleReport(
      records.some(
        (record) =>
          record.type !== "attributes" ||
          [OID_ATTRIBUTE, "aria-label", "alt"].includes(
            record.attributeName ?? "",
          ),
      ),
    ),
  ).observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  });
  post({ type: "boot" });
}
