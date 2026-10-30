import type {
  ElementClassName,
  ElementTextContent,
  SourceLocation,
  SourceMapperError,
} from "../source-mapper/types.ts";
import type { DiscoveredRoute, UnsupportedRoute } from "./routes.ts";

/**
 * Runtime-neutral contract the editor UI uses to resolve and edit source.
 * The browser playground implements it over a development-only HTTP adapter;
 * the Electron app implements it over validated IPC. The editor never
 * receives raw filesystem access.
 */
export interface SourceEditWorkspace {
  locate(oid: string): Promise<LocateElementResult>;
  /** Computes the patch for review. Never writes. */
  previewTextEdit(request: TextEditRequest): Promise<TextEditResult>;
  /** Writes the patch if the file still matches `expectedSha256`. */
  applyTextEdit(request: TextEditRequest): Promise<TextEditResult>;
  /** Computes a static `className` replacement for review. Never writes. */
  previewClassEdit(request: ClassEditRequest): Promise<TextEditResult>;
  /** Writes the `className` replacement if the file still matches. */
  applyClassEdit(request: ClassEditRequest): Promise<TextEditResult>;
  /** Validates and resolves a discovered static route for preview navigation. */
  selectRoute?(route: string): Promise<SelectRouteResult>;
}

export interface SelectRouteRequest {
  route: string;
}

export interface SelectRouteSuccess {
  ok: true;
  route: string;
  sourcePath: string;
  previewUrl: string;
  routes: DiscoveredRoute[];
  unsupportedRoutes: UnsupportedRoute[];
}

export type SelectRouteResult = SelectRouteSuccess | SourceEditFailure;

export interface SourceElementInfo {
  /** Workspace-relative POSIX path, e.g. `src/app/page.tsx`. */
  path: string;
  /** SHA-256 of the file content the location was read from. */
  sha256: string;
  location: SourceLocation;
  text: ElementTextContent;
  className: ElementClassName;
}

export interface TextEditRequest {
  path: string;
  oid: string;
  expectedSha256: string;
  text: string;
}

export interface ClassEditRequest {
  path: string;
  oid: string;
  expectedSha256: string;
  /** Full replacement for the static className string; empty removes it. */
  className: string;
}

export type SourceEditFailureReason =
  | SourceMapperError
  | "invalid-request"
  | "unauthorized"
  | "path-rejected"
  | "file-not-found"
  | "route-not-found"
  | "route-unsupported"
  | "stale-file"
  | "invalid-patch"
  | "write-failed"
  | "unsupported-encoding"
  | "internal-error"
  | "unavailable";

export interface SourceEditFailure {
  ok: false;
  reason: SourceEditFailureReason;
  message: string;
}

export type LocateElementResult =
  | { ok: true; element: SourceElementInfo }
  | SourceEditFailure;

export type TextEditResult =
  | {
      ok: true;
      /** False for previews and for edits that would not change the file. */
      written: boolean;
      noop: boolean;
      sha256: string;
      /** Replacement preview ID when the adapter binds IDs to source versions. */
      oid?: string;
      /** Unified diff of the change, empty for no-ops. */
      diff: string;
    }
  | SourceEditFailure;

const FAILURE_MESSAGES: Record<SourceEditFailureReason, string> = {
  "parse-failed": "The source file could not be parsed. Nothing was written.",
  "oid-not-found":
    "This element has no matching data-oid in the workspace source.",
  "oid-ambiguous":
    "More than one source element uses this data-oid. Refusing to guess which one to edit.",
  "unsupported-className-expression":
    "className is an expression; only static class strings can be edited.",
  "unsupported-void-element": "Void elements such as <input> have no text.",
  "unsupported-dynamic-children":
    "This element renders expressions or nested elements. Only static text can be edited here.",
  "unsupported-multiline-text": "Text edits must be a single line.",
  "unsupported-className-value":
    "Class names cannot contain quotes, braces, `<`, backslashes, line breaks, or HTML entities such as `&amp;`.",
  "unconfined-patch":
    "This edit would change code outside the selected element (for example by reformatting). Nothing was written.",
  "invalid-request": "The edit request was malformed.",
  unauthorized: "The workspace rejected the request.",
  "path-rejected": "That file is outside the approved workspace.",
  "file-not-found": "The source file no longer exists.",
  "route-not-found": "The requested route does not exist in this project.",
  "route-unsupported":
    "The requested route uses an unsupported Next.js App Router convention.",
  "stale-file":
    "The file changed since this element was selected. Reselect the element and try again.",
  "invalid-patch":
    "The generated patch failed validation. Nothing was written.",
  "write-failed": "Writing the file failed. The original file was kept.",
  "unsupported-encoding":
    "The file is not valid UTF-8, so it cannot be rewritten without changing other bytes. Nothing was written.",
  "internal-error":
    "The workspace adapter hit an unexpected error. Check the dev server log.",
  unavailable: "The workspace adapter is not reachable.",
};

export function describeSourceEditFailure(
  reason: SourceEditFailureReason,
): string {
  return FAILURE_MESSAGES[reason];
}

export function sourceEditFailure(
  reason: SourceEditFailureReason,
): SourceEditFailure {
  return { ok: false, reason, message: describeSourceEditFailure(reason) };
}

export {
  hasExactKeys,
  parseClassEditBody,
  parseLocateBody,
  parseSelectRouteBody,
  parseTextEditBody,
} from "./requests.ts";
export type {
  DiscoveredRoute,
  ProjectRoutesSnapshot,
  ResolvePreviewRouteUrlResult,
  UnsupportedRoute,
  UnsupportedRouteReason,
  ValidateRoutePathResult,
} from "./routes.ts";
export {
  discoverAppRouterRoutes,
  resolvePreviewRouteUrl,
  validateRoutePath,
} from "./routes.ts";
