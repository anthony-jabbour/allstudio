/**
 * Typed messages between the editor window and the preview bridge that runs
 * inside the previewed project page (`client.ts`). The preview is untrusted:
 * every inbound message is checked for the expected origin, the expected
 * window, the session nonce, and a strict shape before the editor acts on it.
 */
export const PREVIEW_BRIDGE_VERSION = 5;
export const EDITOR_MESSAGE_SOURCE = "allstudio-editor";
export const PREVIEW_MESSAGE_SOURCE = "allstudio-preview";

/** Same alphabet as `createOid`; bounded so a hostile page cannot flood the editor. */
const OID_PATTERN = /^[a-z0-9\-._:]{1,64}$/;
const TAG_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const MAX_TEXT_LENGTH = 2000;
const MAX_INSTANCES = 10_000;
const NODE_ID_PATTERN = /^n[1-9][0-9]{0,15}$/;
export const MAX_LAYER_NODES = 1000;
export const MAX_LAYER_DEPTH = 64;
export const MAX_LAYER_LABEL_LENGTH = 80;

export interface PreviewLayerNode {
  id: string;
  parentId: string | null;
  oid: string;
  tagName: string;
  label: string;
}

export interface PreviewLayersSnapshot {
  generation: number;
  nodes: PreviewLayerNode[];
  truncated: boolean;
}

export interface PreviewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PreviewElementSnapshot {
  appearance: PreviewAppearance;
  spacing: PreviewSpacing;
  typography: PreviewTypography;
  nodeId: string;
  oid: string;
  tagName: string;
  /** Rendered `textContent`, truncated by the bridge. */
  text: string;
  /** Rendered `class` attribute, truncated by the bridge. */
  className: string;
  rect: PreviewRect;
  /** Number of rendered elements sharing this oid (e.g. `.map()` items). */
  instances: number;
}

export interface PreviewTypography {
  fontSize: string | null;
  fontWeight: string | null;
  lineHeight: string | null;
  textAlign: string | null;
  color: string | null;
  fontFamily: string | null;
}
export const SPACING_KEYS = [
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
export type PreviewSpacing = Record<
  (typeof SPACING_KEYS)[number],
  string | null
>;

/** Fixed selected-element appearance measurement; each value is bounded or null. */
export const APPEARANCE_KEYS = [
  "backgroundColor",
  "backgroundImage",
  "borderRadius",
] as const;
export type PreviewAppearance = Record<
  (typeof APPEARANCE_KEYS)[number],
  string | null
>;

function parseAppearance(value: unknown): PreviewAppearance | null {
  if (!isRecord(value) || !hasOnlyKeys(value, APPEARANCE_KEYS)) return null;
  for (const key of APPEARANCE_KEYS) {
    if (
      value[key] !== null &&
      (typeof value[key] !== "string" || value[key].length > 256)
    )
      return null;
  }
  return Object.fromEntries(
    APPEARANCE_KEYS.map((key) => [key, value[key]]),
  ) as PreviewAppearance;
}

function parseSpacing(value: unknown): PreviewSpacing | null {
  if (!isRecord(value) || !hasOnlyKeys(value, SPACING_KEYS)) return null;
  for (const key of SPACING_KEYS) {
    if (
      value[key] !== null &&
      (typeof value[key] !== "string" || value[key].length > 256)
    )
      return null;
  }
  return Object.fromEntries(
    SPACING_KEYS.map((key) => [key, value[key]]),
  ) as PreviewSpacing;
}
const TYPOGRAPHY_KEYS = [
  "fontSize",
  "fontWeight",
  "lineHeight",
  "textAlign",
  "color",
  "fontFamily",
] as const;

function parseTypography(value: unknown): PreviewTypography | null {
  if (!isRecord(value) || !hasOnlyKeys(value, TYPOGRAPHY_KEYS)) return null;
  for (const key of TYPOGRAPHY_KEYS) {
    if (
      value[key] !== null &&
      (typeof value[key] !== "string" || value[key].length > 256)
    )
      return null;
  }
  return Object.fromEntries(
    TYPOGRAPHY_KEYS.map((key) => [key, value[key]]),
  ) as unknown as PreviewTypography;
}

export type PreviewMessage =
  | { type: "boot" }
  | { type: "ready"; nonce: string }
  | ({ type: "layers"; nonce: string } & PreviewLayersSnapshot)
  | {
      type: "layer-error";
      nonce: string;
      reason: "stale-layer" | "missing-layer";
    }
  | {
      type: "select";
      nonce: string;
      clickedTag: string;
      element: PreviewElementSnapshot | null;
    }
  | {
      type: "element";
      nonce: string;
      oid: string;
      element: PreviewElementSnapshot | null;
    };

export type EditorMessage =
  | { type: "hello"; nonce: string }
  | { type: "track"; nonce: string; oid: string | null }
  | { type: "select-layer"; nonce: string; generation: number; nodeId: string };

export interface InboundMessageEvent {
  origin: string;
  source: unknown;
  data: unknown;
}

export interface PreviewExpectation {
  previewOrigin: string;
  previewWindow: unknown;
  /** Nonce of the current handshake, or null before `hello` was sent. */
  nonce: string | null;
}

export type PreviewMessageRejection =
  | "unexpected-origin"
  | "unexpected-source"
  | "malformed"
  | "not-connected"
  | "stale-nonce";

export type ParsedPreviewMessage =
  | { ok: true; message: PreviewMessage }
  | { ok: false; reason: PreviewMessageRejection };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isValidOid(value: unknown): value is string {
  return typeof value === "string" && OID_PATTERN.test(value);
}

function parseRect(value: unknown): PreviewRect | null {
  if (!isRecord(value)) {
    return null;
  }
  const { x, y, width, height } = value;
  if (
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isFiniteNumber(width) ||
    !isFiniteNumber(height) ||
    width < 0 ||
    height < 0
  ) {
    return null;
  }
  return { x, y, width, height };
}

/** `undefined` means malformed; `null` is a valid "no element". */
function parseSnapshot(
  value: unknown,
): PreviewElementSnapshot | null | undefined {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const rect = parseRect(value.rect);
  const typography = parseTypography(value.typography);
  const spacing = parseSpacing(value.spacing);
  const appearance = parseAppearance(value.appearance);
  const { nodeId, oid, tagName, text, className, instances } = value;
  if (
    typeof nodeId !== "string" ||
    !NODE_ID_PATTERN.test(nodeId) ||
    !isValidOid(oid) ||
    typeof tagName !== "string" ||
    !TAG_PATTERN.test(tagName) ||
    typeof text !== "string" ||
    text.length > MAX_TEXT_LENGTH ||
    typeof className !== "string" ||
    className.length > MAX_TEXT_LENGTH ||
    typeof instances !== "number" ||
    !Number.isInteger(instances) ||
    instances < 1 ||
    instances > MAX_INSTANCES ||
    !rect ||
    !typography ||
    !spacing ||
    !appearance
  ) {
    return undefined;
  }
  return {
    nodeId,
    oid,
    tagName,
    text,
    className,
    rect,
    instances,
    typography,
    spacing,
    appearance,
  };
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function parseLayers(
  value: Record<string, unknown>,
): PreviewLayersSnapshot | null {
  if (
    !hasOnlyKeys(value, [
      "source",
      "version",
      "type",
      "nonce",
      "generation",
      "nodes",
      "truncated",
    ]) ||
    !Number.isSafeInteger(value.generation) ||
    (value.generation as number) < 1 ||
    typeof value.truncated !== "boolean" ||
    !Array.isArray(value.nodes) ||
    value.nodes.length > MAX_LAYER_NODES
  )
    return null;
  const nodes: PreviewLayerNode[] = [];
  const depths = new Map<string, number>();
  for (const node of value.nodes) {
    if (
      !isRecord(node) ||
      !hasOnlyKeys(node, ["id", "parentId", "oid", "tagName", "label"])
    )
      return null;
    const { id, parentId, oid, tagName, label } = node;
    if (
      typeof id !== "string" ||
      !NODE_ID_PATTERN.test(id) ||
      depths.has(id) ||
      !isValidOid(oid) ||
      typeof tagName !== "string" ||
      !TAG_PATTERN.test(tagName) ||
      typeof label !== "string" ||
      label.length > MAX_LAYER_LABEL_LENGTH ||
      (parentId !== null &&
        (typeof parentId !== "string" || !depths.has(parentId)))
    )
      return null;
    const depth =
      parentId === null ? 1 : (depths.get(parentId as string) ?? 0) + 1;
    if (depth > MAX_LAYER_DEPTH) return null;
    depths.set(id, depth);
    nodes.push({
      id,
      parentId: parentId as string | null,
      oid,
      tagName,
      label,
    });
  }
  return {
    generation: value.generation as number,
    nodes,
    truncated: value.truncated,
  };
}

export function parsePreviewMessage(
  event: InboundMessageEvent,
  expected: PreviewExpectation,
): ParsedPreviewMessage {
  if (event.origin !== expected.previewOrigin) {
    return { ok: false, reason: "unexpected-origin" };
  }
  if (event.source === null || event.source !== expected.previewWindow) {
    return { ok: false, reason: "unexpected-source" };
  }
  const data = event.data;
  if (
    !isRecord(data) ||
    data.source !== PREVIEW_MESSAGE_SOURCE ||
    data.version !== PREVIEW_BRIDGE_VERSION ||
    typeof data.type !== "string"
  ) {
    return { ok: false, reason: "malformed" };
  }
  if (data.type === "boot") {
    return { ok: true, message: { type: "boot" } };
  }
  if (
    !["ready", "select", "element", "layers", "layer-error"].includes(data.type)
  ) {
    return { ok: false, reason: "malformed" };
  }
  if (expected.nonce === null) {
    return { ok: false, reason: "not-connected" };
  }
  if (data.nonce !== expected.nonce) {
    return { ok: false, reason: "stale-nonce" };
  }
  const nonce = expected.nonce;

  if (data.type === "ready") {
    return { ok: true, message: { type: "ready", nonce } };
  }
  if (data.type === "layers") {
    const layers = parseLayers(data);
    return layers
      ? { ok: true, message: { type: "layers", nonce, ...layers } }
      : { ok: false, reason: "malformed" };
  }
  if (data.type === "layer-error") {
    if (
      !hasOnlyKeys(data, ["source", "version", "type", "nonce", "reason"]) ||
      (data.reason !== "stale-layer" && data.reason !== "missing-layer")
    )
      return { ok: false, reason: "malformed" };
    return {
      ok: true,
      message: { type: "layer-error", nonce, reason: data.reason },
    };
  }
  const element = parseSnapshot(data.element);
  if (element === undefined) {
    return { ok: false, reason: "malformed" };
  }
  if (data.type === "select") {
    const { clickedTag } = data;
    if (
      typeof clickedTag !== "string" ||
      (clickedTag !== "" && !TAG_PATTERN.test(clickedTag))
    ) {
      return { ok: false, reason: "malformed" };
    }
    return {
      ok: true,
      message: { type: "select", nonce, clickedTag, element },
    };
  }
  const { oid } = data;
  if (!isValidOid(oid) || (element !== null && element.oid !== oid)) {
    return { ok: false, reason: "malformed" };
  }
  return { ok: true, message: { type: "element", nonce, oid, element } };
}

export function createEditorMessage(
  message: EditorMessage,
): EditorMessage & { source: string; version: number } {
  return {
    source: EDITOR_MESSAGE_SOURCE,
    version: PREVIEW_BRIDGE_VERSION,
    ...message,
  };
}

export function createBridgeNonce(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
