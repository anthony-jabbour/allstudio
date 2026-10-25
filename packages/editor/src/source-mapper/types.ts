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
  | "unsupported-multiline-text"
  | "unsupported-className-value"
  | "unconfined-patch";

export interface InstrumentOptions {
  /**
   * Insert `data-oid` attributes without regenerating the file, so every
   * other byte is kept. Falls back to regeneration when existing oids need
   * repair (duplicates, invalid values).
   */
  preserveFormatting?: boolean;
}

export type ElementEditResult =
  | {
      ok: true;
      original: string;
      generated: string;
      /** `splice` keeps every byte outside the edited range. */
      strategy: "splice" | "regenerate";
    }
  | { ok: false; reason: SourceMapperError };

export type InstrumentResult =
  | { ok: true; content: string; locations: SourceLocation[] }
  | { ok: false; reason: "parse-failed" };

export type PreviewPatchResult =
  | { ok: true; original: string; generated: string }
  | { ok: false; reason: SourceMapperError };

export type ElementTextContent =
  | { ok: true; text: string }
  | {
      ok: false;
      reason: "unsupported-void-element" | "unsupported-dynamic-children";
    };

export type ElementClassName =
  /** `value` is null when the element has no className attribute. */
  | { ok: true; value: string | null }
  | { ok: false; reason: "unsupported-className-expression" };

export type DescribeElementResult =
  | {
      ok: true;
      location: SourceLocation;
      text: ElementTextContent;
      className: ElementClassName;
    }
  | { ok: false; reason: "parse-failed" | "oid-not-found" | "oid-ambiguous" };
