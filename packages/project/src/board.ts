/**
 * Portable board document (`.allstudio/boards/*.board.json`), schema v1.
 *
 * Boards are the exploratory, Paper-style surface. They are canonical JSON,
 * not React source; there is no claim of lossless conversion to a site.
 * Parsing is strict and bounded because board files can be imported from
 * anywhere: unknown node kinds, non-finite numbers, remote image URLs and
 * oversized documents are rejected instead of guessed.
 */

export const BOARD_SCHEMA_VERSION = 1 as const;

export const BOARD_LIMITS = {
  maxPages: 64,
  maxNodes: 5_000,
  maxDepth: 12,
  maxTextLength: 20_000,
  maxNameLength: 200,
  /** Embedded raster images are stored inline as data URLs. */
  maxImageBytes: 4 * 1024 * 1024,
  maxCoordinate: 1_000_000,
} as const;

export type BoardNodeType = "frame" | "rect" | "ellipse" | "text" | "image";

export type TextAlign = "left" | "center" | "right";
export type ImageFit = "cover" | "contain" | "fill";

export interface BoardStroke {
  color: string;
  width: number;
}

export interface BoardShadow {
  color: string;
  x: number;
  y: number;
  blur: number;
}

interface BoardNodeBase {
  id: string;
  type: BoardNodeType;
  name: string;
  /** Relative to the parent frame, or to the page for top-level nodes. */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  hidden?: boolean;
  locked?: boolean;
  fill?: string | null;
  /** Optional CSS-style linear gradient: [angleDeg, fromColor, toColor]. */
  gradient?: [number, string, string] | null;
  stroke?: BoardStroke | null;
  radius?: number;
  shadow?: BoardShadow | null;
}

export interface BoardFrameNode extends BoardNodeBase {
  type: "frame";
  clip?: boolean;
  children: BoardNode[];
}

export interface BoardShapeNode extends BoardNodeBase {
  type: "rect" | "ellipse";
}

export interface BoardTextNode extends BoardNodeBase {
  type: "text";
  text: string;
  color: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  textAlign: TextAlign;
}

export interface BoardImageNode extends BoardNodeBase {
  type: "image";
  /** `data:image/(png|jpeg|gif|webp);base64,…` only — no remote fetches. */
  src: string;
  fit: ImageFit;
}

export type BoardNode =
  | BoardFrameNode
  | BoardShapeNode
  | BoardTextNode
  | BoardImageNode;

export interface BoardPage {
  id: string;
  name: string;
  background: string;
  nodes: BoardNode[];
}

export interface BoardDocumentV1 {
  schemaVersion: typeof BOARD_SCHEMA_VERSION;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  pages: BoardPage[];
}

export class BoardDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BoardDocumentError";
  }
}

const COLOR =
  /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+%?\s*)?\)|transparent)$/i;
const DATA_IMAGE = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+=*$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function isBoardColor(value: unknown): value is string {
  return typeof value === "string" && value.length <= 64 && COLOR.test(value);
}

export function isSafeImageSource(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= BOARD_LIMITS.maxImageBytes * 1.4 &&
    DATA_IMAGE.test(value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface ParseState {
  nodes: number;
  ids: Set<string>;
}

function fail(path: string, message: string): never {
  throw new BoardDocumentError(`${path}: ${message}`);
}

function text(value: unknown, path: string, max: number): string {
  if (typeof value !== "string" || value.length > max) {
    fail(path, `must be a string of at most ${max} characters.`);
  }
  return value;
}

function name(value: unknown, path: string): string {
  const result = text(value, path, BOARD_LIMITS.maxNameLength);
  if (result.trim().length === 0) fail(path, "must not be empty.");
  return result;
}

function id(value: unknown, path: string, state: ParseState): string {
  if (typeof value !== "string" || !ID.test(value)) {
    fail(path, "must be 1-64 characters of A-Z, a-z, 0-9, _ or -.");
  }
  if (state.ids.has(value)) fail(path, `duplicate id "${value}".`);
  state.ids.add(value);
  return value;
}

function num(
  value: unknown,
  path: string,
  min: number = -BOARD_LIMITS.maxCoordinate,
  max: number = BOARD_LIMITS.maxCoordinate,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(path, "must be a finite number.");
  }
  if (value < min || value > max) fail(path, `must be in [${min}, ${max}].`);
  return value;
}

function optional<T>(
  source: Record<string, unknown>,
  key: string,
  read: (value: unknown, path: string) => T,
  path: string,
): T | undefined {
  return source[key] === undefined
    ? undefined
    : read(source[key], `${path}.${key}`);
}

function color(value: unknown, path: string): string {
  if (!isBoardColor(value))
    fail(path, "must be a hex, rgb(a) or transparent color.");
  return value;
}

function nullableColor(value: unknown, path: string): string | null {
  return value === null ? null : color(value, path);
}

function parseNode(
  value: unknown,
  path: string,
  depth: number,
  state: ParseState,
): BoardNode {
  if (!isRecord(value)) fail(path, "must be an object.");
  if (depth > BOARD_LIMITS.maxDepth) fail(path, "is nested too deeply.");
  state.nodes += 1;
  if (state.nodes > BOARD_LIMITS.maxNodes) {
    fail(path, `document exceeds ${BOARD_LIMITS.maxNodes} nodes.`);
  }
  const type = value.type;
  if (
    type !== "frame" &&
    type !== "rect" &&
    type !== "ellipse" &&
    type !== "text" &&
    type !== "image"
  ) {
    fail(`${path}.type`, "must be frame, rect, ellipse, text or image.");
  }
  const base: BoardNodeBase = {
    id: id(value.id, `${path}.id`, state),
    type,
    name: name(value.name, `${path}.name`),
    x: num(value.x, `${path}.x`),
    y: num(value.y, `${path}.y`),
    width: num(value.width, `${path}.width`, 0),
    height: num(value.height, `${path}.height`, 0),
  };
  const rotation = optional(
    value,
    "rotation",
    (v, p) => num(v, p, -360, 360),
    path,
  );
  if (rotation !== undefined) base.rotation = rotation;
  const opacity = optional(value, "opacity", (v, p) => num(v, p, 0, 1), path);
  if (opacity !== undefined) base.opacity = opacity;
  for (const flag of ["hidden", "locked"] as const) {
    if (value[flag] !== undefined) {
      if (typeof value[flag] !== "boolean") {
        fail(`${path}.${flag}`, "must be a boolean.");
      }
      base[flag] = value[flag] as boolean;
    }
  }
  const fill = optional(value, "fill", nullableColor, path);
  if (fill !== undefined) base.fill = fill;
  if (value.gradient !== undefined) {
    const g = value.gradient;
    if (g === null) base.gradient = null;
    else if (Array.isArray(g) && g.length === 3) {
      base.gradient = [
        num(g[0], `${path}.gradient[0]`, -360, 360),
        color(g[1], `${path}.gradient[1]`),
        color(g[2], `${path}.gradient[2]`),
      ];
    } else fail(`${path}.gradient`, "must be [angle, from, to] or null.");
  }
  if (value.stroke !== undefined) {
    const s = value.stroke;
    if (s === null) base.stroke = null;
    else if (isRecord(s)) {
      base.stroke = {
        color: color(s.color, `${path}.stroke.color`),
        width: num(s.width, `${path}.stroke.width`, 0, 1000),
      };
    } else fail(`${path}.stroke`, "must be an object or null.");
  }
  const radius = optional(
    value,
    "radius",
    (v, p) => num(v, p, 0, 100_000),
    path,
  );
  if (radius !== undefined) base.radius = radius;
  if (value.shadow !== undefined) {
    const s = value.shadow;
    if (s === null) base.shadow = null;
    else if (isRecord(s)) {
      base.shadow = {
        color: color(s.color, `${path}.shadow.color`),
        x: num(s.x, `${path}.shadow.x`, -1000, 1000),
        y: num(s.y, `${path}.shadow.y`, -1000, 1000),
        blur: num(s.blur, `${path}.shadow.blur`, 0, 1000),
      };
    } else fail(`${path}.shadow`, "must be an object or null.");
  }

  switch (type) {
    case "frame": {
      if (!Array.isArray(value.children)) {
        fail(`${path}.children`, "must be an array.");
      }
      const node: BoardFrameNode = {
        ...base,
        type,
        children: value.children.map((child, index) =>
          parseNode(child, `${path}.children[${index}]`, depth + 1, state),
        ),
      };
      if (value.clip !== undefined) {
        if (typeof value.clip !== "boolean") {
          fail(`${path}.clip`, "must be a boolean.");
        }
        node.clip = value.clip;
      }
      return node;
    }
    case "rect":
    case "ellipse":
      return { ...base, type };
    case "text": {
      const align = value.textAlign;
      if (align !== "left" && align !== "center" && align !== "right") {
        fail(`${path}.textAlign`, "must be left, center or right.");
      }
      return {
        ...base,
        type,
        text: text(value.text, `${path}.text`, BOARD_LIMITS.maxTextLength),
        color: color(value.color, `${path}.color`),
        fontFamily: name(value.fontFamily, `${path}.fontFamily`),
        fontSize: num(value.fontSize, `${path}.fontSize`, 1, 2000),
        fontWeight: num(value.fontWeight, `${path}.fontWeight`, 100, 900),
        lineHeight: num(value.lineHeight, `${path}.lineHeight`, 0.5, 5),
        letterSpacing: num(
          value.letterSpacing,
          `${path}.letterSpacing`,
          -50,
          200,
        ),
        textAlign: align,
      };
    }
    case "image": {
      if (!isSafeImageSource(value.src)) {
        fail(
          `${path}.src`,
          "must be an inline png, jpeg, gif or webp data URL within the size limit.",
        );
      }
      const fit = value.fit;
      if (fit !== "cover" && fit !== "contain" && fit !== "fill") {
        fail(`${path}.fit`, "must be cover, contain or fill.");
      }
      return { ...base, type, src: value.src, fit };
    }
  }
}

function timestamp(value: unknown, path: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    fail(path, "must be an ISO timestamp.");
  }
  return value;
}

/** Validate untrusted JSON into a board document, or throw. */
export function parseBoardDocument(value: unknown): BoardDocumentV1 {
  if (!isRecord(value)) fail("board", "must be an object.");
  if (value.schemaVersion !== BOARD_SCHEMA_VERSION) {
    fail(
      "board.schemaVersion",
      `unsupported version ${String(value.schemaVersion)}.`,
    );
  }
  const state: ParseState = { nodes: 0, ids: new Set() };
  if (!Array.isArray(value.pages) || value.pages.length === 0) {
    fail("board.pages", "must be a non-empty array.");
  }
  if (value.pages.length > BOARD_LIMITS.maxPages) {
    fail("board.pages", `must have at most ${BOARD_LIMITS.maxPages} pages.`);
  }
  const doc: BoardDocumentV1 = {
    schemaVersion: BOARD_SCHEMA_VERSION,
    id: id(value.id, "board.id", state),
    name: name(value.name, "board.name"),
    createdAt: timestamp(value.createdAt, "board.createdAt"),
    updatedAt: timestamp(value.updatedAt, "board.updatedAt"),
    pages: value.pages.map((page, index) => {
      const path = `board.pages[${index}]`;
      if (!isRecord(page)) fail(path, "must be an object.");
      if (!Array.isArray(page.nodes))
        fail(`${path}.nodes`, "must be an array.");
      return {
        id: id(page.id, `${path}.id`, state),
        name: name(page.name, `${path}.name`),
        background: color(page.background, `${path}.background`),
        nodes: page.nodes.map((node, n) =>
          parseNode(node, `${path}.nodes[${n}]`, 1, state),
        ),
      };
    }),
  };
  return doc;
}

let counter = 0;

/** Short, collision-resistant id that satisfies the schema's id pattern. */
export function createBoardId(prefix = "n"): string {
  counter = (counter + 1) % 1_679_616;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${random}`;
}

export function createBoardDocument(
  name: string,
  pages?: BoardPage[],
  now = new Date().toISOString(),
): BoardDocumentV1 {
  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    id: createBoardId("b"),
    name,
    createdAt: now,
    updatedAt: now,
    pages: pages ?? [
      {
        id: createBoardId("p"),
        name: "Page 1",
        background: "transparent",
        nodes: [],
      },
    ],
  };
}

/** Count every node in a document (frames and their descendants). */
export function countBoardNodes(doc: BoardDocumentV1): number {
  const walk = (nodes: BoardNode[]): number =>
    nodes.reduce(
      (sum, node) =>
        sum + 1 + (node.type === "frame" ? walk(node.children) : 0),
      0,
    );
  return doc.pages.reduce((sum, page) => sum + walk(page.nodes), 0);
}
