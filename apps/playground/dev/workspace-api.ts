/**
 * HTTP surface of the development workspace adapter, mounted on the Vite dev
 * server under `/__allstudio/workspace/`.
 *
 * Only the editor page may call it. Each request must:
 *   - be a same-origin POST from `editorOrigin` (Origin + Sec-Fetch-Site)
 *   - carry the per-server-start session token injected into index.html
 *   - send a small JSON body with exactly the expected fields
 * The preview runs on another origin, cannot read the token (Vite CORS is
 * disabled), and the custom header forces a CORS preflight it cannot pass.
 */
import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  type ClassEditRequest,
  type SourceEditFailureReason,
  sourceEditFailure,
  type TextEditRequest,
} from "@allstudio/editor/site";
import type { DevWorkspace } from "./dev-workspace.ts";

export const WORKSPACE_API_PREFIX = "/__allstudio/workspace/";
export const SESSION_HEADER = "x-allstudio-session";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_TEXT_LENGTH = 500;
const MAX_CLASS_LENGTH = 1000;
const OID_PATTERN = /^[a-z0-9\-._:]{1,64}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export interface WorkspaceApiOptions {
  /** One adapter per fixture id; ids appear in the URL path. */
  workspaces: ReadonlyMap<string, DevWorkspace>;
  editorOrigin: string;
  sessionToken: string;
}

type Next = (error?: unknown) => void;

const STATUS: Partial<Record<SourceEditFailureReason, number>> = {
  "invalid-request": 400,
  unauthorized: 403,
  "path-rejected": 403,
  "file-not-found": 404,
  "oid-not-found": 404,
  "stale-file": 409,
  "oid-ambiguous": 409,
  "write-failed": 500,
  "internal-error": 500,
};

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

function fail(res: ServerResponse, reason: SourceEditFailureReason): void {
  send(res, STATUS[reason] ?? 422, sourceEditFailure(reason));
}

function tokensMatch(given: unknown, expected: string): boolean {
  if (typeof given !== "string") {
    return false;
  }
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isAuthorizedRequest(
  req: Pick<IncomingMessage, "method" | "headers">,
  options: Pick<WorkspaceApiOptions, "editorOrigin" | "sessionToken">,
): boolean {
  if (req.method !== "POST") {
    return false;
  }
  if (req.headers.origin !== options.editorOrigin) {
    return false;
  }
  const fetchSite = req.headers["sec-fetch-site"];
  if (fetchSite !== undefined && fetchSite !== "same-origin") {
    return false;
  }
  if (
    !String(req.headers["content-type"] ?? "").startsWith("application/json")
  ) {
    return false;
  }
  return tokensMatch(req.headers[SESSION_HEADER], options.sessionToken);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) {
      return undefined;
    }
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return undefined;
  }
}

function hasExactKeys(
  value: unknown,
  keys: string[],
): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const actual = Object.keys(value).sort();
  return (
    actual.length === keys.length &&
    [...keys].sort().every((key, i) => key === actual[i])
  );
}

export function parseLocateBody(body: unknown): { oid: string } | null {
  if (!hasExactKeys(body, ["oid"]) || typeof body.oid !== "string") {
    return null;
  }
  return OID_PATTERN.test(body.oid) ? { oid: body.oid } : null;
}

export function parseTextEditBody(body: unknown): TextEditRequest | null {
  if (!hasExactKeys(body, ["path", "oid", "expectedSha256", "text"])) {
    return null;
  }
  const { path, oid, expectedSha256, text } = body;
  if (
    typeof path !== "string" ||
    typeof oid !== "string" ||
    !OID_PATTERN.test(oid) ||
    typeof expectedSha256 !== "string" ||
    !SHA256_PATTERN.test(expectedSha256) ||
    typeof text !== "string" ||
    text.length > MAX_TEXT_LENGTH
  ) {
    return null;
  }
  return { path, oid, expectedSha256, text };
}

export function parseClassEditBody(body: unknown): ClassEditRequest | null {
  if (!hasExactKeys(body, ["path", "oid", "expectedSha256", "className"])) {
    return null;
  }
  const { path, oid, expectedSha256, className } = body;
  if (
    typeof path !== "string" ||
    typeof oid !== "string" ||
    !OID_PATTERN.test(oid) ||
    typeof expectedSha256 !== "string" ||
    !SHA256_PATTERN.test(expectedSha256) ||
    typeof className !== "string" ||
    className.length > MAX_CLASS_LENGTH
  ) {
    return null;
  }
  return { path, oid, expectedSha256, className };
}

export function createWorkspaceApiMiddleware(options: WorkspaceApiOptions) {
  const { workspaces } = options;
  return async (req: IncomingMessage, res: ServerResponse, next: Next) => {
    const url = req.url ?? "";
    if (!url.startsWith(WORKSPACE_API_PREFIX)) {
      next();
      return;
    }
    try {
      if (!isAuthorizedRequest(req, options)) {
        fail(res, "unauthorized");
        return;
      }
      // `/__allstudio/workspace/<fixture id>/<action>`
      const [id, action, ...rest] = url
        .slice(WORKSPACE_API_PREFIX.length)
        .split("/");
      const workspace = id ? workspaces.get(id) : undefined;
      if (!workspace || rest.length > 0) {
        fail(res, "invalid-request");
        return;
      }
      const body = await readJson(req);
      if (action === "locate") {
        const parsed = parseLocateBody(body);
        if (!parsed) {
          fail(res, "invalid-request");
          return;
        }
        const result = await workspace.locate(parsed.oid);
        send(res, result.ok ? 200 : (STATUS[result.reason] ?? 422), result);
        return;
      }
      if (action === "preview-text" || action === "apply-text") {
        const parsed = parseTextEditBody(body);
        if (!parsed) {
          fail(res, "invalid-request");
          return;
        }
        const result =
          action === "apply-text"
            ? await workspace.applyTextEdit(parsed)
            : await workspace.previewTextEdit(parsed);
        send(res, result.ok ? 200 : (STATUS[result.reason] ?? 422), result);
        return;
      }
      if (action === "preview-class" || action === "apply-class") {
        const parsed = parseClassEditBody(body);
        if (!parsed) {
          fail(res, "invalid-request");
          return;
        }
        const result =
          action === "apply-class"
            ? await workspace.applyClassEdit(parsed)
            : await workspace.previewClassEdit(parsed);
        send(res, result.ok ? 200 : (STATUS[result.reason] ?? 422), result);
        return;
      }
      fail(res, "invalid-request");
    } catch {
      fail(res, "internal-error");
    }
  };
}
