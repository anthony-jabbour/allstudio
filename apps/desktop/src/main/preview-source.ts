import { createHash } from "node:crypto";
import {
  instrumentSource,
  listOidAttributes,
  listOids,
} from "@allstudio/editor/source-mapper";

export interface PreviewSource {
  content: string;
  injectedOids: string[];
  originalOids: string[];
  attributes: Array<{ virtual: string; original: string }>;
}

export function stripPreviewOids(
  content: string,
  preview: PreviewSource,
): string {
  const ranges = listOidAttributes(content);
  if (
    !ranges ||
    JSON.stringify(ranges.map((item) => item.oid)) !==
      JSON.stringify(preview.injectedOids)
  )
    throw new Error("Preview attributes missing or ambiguous");
  let original = content;
  const edits = ranges.map((range, i) => ({
    range,
    attribute: preview.attributes[i],
  }));
  for (const { range, attribute } of edits.sort(
    (a, b) => b.range.start - a.range.start,
  )) {
    const start = range.start - (attribute.original === "" ? 1 : 0);
    if (content.slice(start, range.end) !== attribute.virtual)
      throw new Error("Preview attribute changed");
    original =
      original.slice(0, start) + attribute.original + original.slice(range.end);
  }
  if (
    JSON.stringify(listOids(original)) !== JSON.stringify(preview.originalOids)
  )
    throw new Error("Original source IDs changed");
  return original;
}

export function preparePreviewSource(
  path: string,
  source: string,
): PreviewSource {
  const originalOids = listOids(source);
  const instrumented = instrumentSource(source, { preserveFormatting: true });
  if (!originalOids || !instrumented.ok)
    throw new Error("Source is not parseable");
  const ranges = listOidAttributes(instrumented.content);
  if (!ranges) throw new Error("Source is not parseable");
  const added = new Set(
    instrumented.locations
      .map((item) => item.oid)
      .filter((oid) => !originalOids.includes(oid)),
  );
  const injectedOids: string[] = [];
  const attributes: PreviewSource["attributes"] = [];
  const version = createHash("sha256").update(source).digest("hex");
  const edits: Array<{ start: number; end: number; text: string }> = [];
  for (const range of ranges) {
    // The mapper inserts exactly one leading space for each generated attribute.
    const start = added.has(range.oid) ? range.start - 1 : range.start;
    const original = instrumented.content.slice(start, range.end);
    const stable = `p:${createHash("sha256").update(`${path}:${version}:${injectedOids.length}`).digest("hex").slice(0, 32)}`;
    if (originalOids.includes(stable))
      throw new Error("Preview ID conflicts with user source");
    const virtual = `${added.has(range.oid) ? " " : ""}data-oid="${stable}"`;
    injectedOids.push(stable);
    attributes.push({
      virtual,
      original: added.has(range.oid) ? "" : original,
    });
    edits.push({ start, end: range.end, text: virtual });
  }
  let content = instrumented.content;
  // JSX inside a prop is visited after its parent but can precede the parent's ID.
  for (const edit of edits.sort((a, b) => b.start - a.start))
    content =
      content.slice(0, edit.start) + edit.text + content.slice(edit.end);
  const preview = { content, injectedOids, originalOids, attributes };
  if (
    JSON.stringify(listOids(content)) !== JSON.stringify(injectedOids) ||
    stripPreviewOids(content, preview) !== source
  )
    throw new Error("Instrumentation would rewrite user source");
  return preview;
}
