/**
 * Typed messages between the editor window and the preview bridge that runs
 * inside the previewed project page (`client.ts`). The preview is untrusted:
 * every inbound message is checked for the expected origin, the expected
 * window, the session nonce, and a strict shape before the editor acts on it.
 */
export const PREVIEW_BRIDGE_VERSION = 1;
export const EDITOR_MESSAGE_SOURCE = "allstudio-editor";
export const PREVIEW_MESSAGE_SOURCE = "allstudio-preview";

/** Same alphabet as `createOid`; bounded so a hostile page cannot flood the editor. */
const OID_PATTERN = /^[a-z0-9\-._:]{1,64}$/;
const TAG_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const MAX_TEXT_LENGTH = 2000;
const MAX_INSTANCES = 10_000;

export interface PreviewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PreviewElementSnapshot {
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

export type PreviewMessage =
  | { type: "boot" }
  | { type: "ready"; nonce: string }
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
  | { type: "track"; nonce: string; oid: string | null };

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
  const { oid, tagName, text, className, instances } = value;
  if (
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
    !rect
  ) {
    return undefined;
  }
  return { oid, tagName, text, className, rect, instances };
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
  if (!["ready", "select", "element"].includes(data.type)) {
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
