export const DATA_OID_ATTRIBUTE = "data-oid";

export interface SourcePosition {
  line: number;
  column: number;
}

export interface SourceLocation {
  oid: string;
  path: string;
  component: string | null;
  start: SourcePosition;
  end: SourcePosition;
}

export interface LocateSourceOptions {
  filename?: string;
}

export interface ElementEdit {
  oid: string;
  className?: string;
  textContent?: string;
}

export type SourceMapperError =
  | "parse-failed"
  | "oid-not-found"
  | "oid-ambiguous"
  | "unsupported-className-expression"
  | "unsupported-void-element"
  | "unsupported-dynamic-children"
  | "unsupported-multiline-text";

export type InstrumentResult =
  | { ok: true; content: string; locations: SourceLocation[] }
  | { ok: false; reason: "parse-failed" };

export type PreviewPatchResult =
  | { ok: true; original: string; generated: string }
  | { ok: false; reason: SourceMapperError };
