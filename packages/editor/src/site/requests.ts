import type {
  ClassEditRequest,
  TextEditRequest,
} from "./source-edit-workspace.ts";

const MAX_TEXT_LENGTH = 500;
const MAX_CLASS_LENGTH = 1000;
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
