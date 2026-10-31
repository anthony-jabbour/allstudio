import { isEditBreakpoint } from "./class-tokens.ts";
import type {
  ClassEditRequest,
  SelectRouteRequest,
  TextEditRequest,
} from "./source-edit-workspace.ts";

const MAX_TEXT_LENGTH = 500;
const MAX_CLASS_LENGTH = 1000;
const MAX_ROUTE_LENGTH = 256;
const OID_PATTERN = /^[a-z0-9\-._:]{1,64}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export function hasExactKeys(
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
  const scoped = hasExactKeys(body, [
    "path",
    "oid",
    "expectedSha256",
    "className",
    "breakpoint",
  ]);
  if (
    !scoped &&
    !hasExactKeys(body, ["path", "oid", "expectedSha256", "className"])
  ) {
    return null;
  }
  if (scoped && !isEditBreakpoint(body.breakpoint)) return null;
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
  return scoped && isEditBreakpoint(body.breakpoint)
    ? { path, oid, expectedSha256, className, breakpoint: body.breakpoint }
    : { path, oid, expectedSha256, className };
}

export function parseSelectRouteBody(body: unknown): SelectRouteRequest | null {
  if (!hasExactKeys(body, ["route"]) || typeof body.route !== "string") {
    return null;
  }
  if (body.route.length < 1 || body.route.length > MAX_ROUTE_LENGTH) {
    return null;
  }
  return { route: body.route };
}
