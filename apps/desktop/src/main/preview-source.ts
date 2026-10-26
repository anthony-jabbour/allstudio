import { createHash } from "node:crypto";
import { instrumentSource, listOids } from "@allstudio/editor/source-mapper";

export interface PreviewSource {
  content: string;
  injectedOids: string[];
  originalOids: string[];
}

export function stripPreviewOids(
  content: string,
  preview: PreviewSource,
): string {
  let original = content;
  for (const oid of preview.injectedOids) {
    const attribute = ` data-oid="${oid}"`;
    if (original.split(attribute).length !== 2) {
      throw new Error("Preview attribute missing or ambiguous");
    }
    original = original.replace(attribute, "");
  }
  if (
    JSON.stringify(listOids(original)) !== JSON.stringify(preview.originalOids)
  ) {
    throw new Error("Original source IDs changed");
  }
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
  const added = new Set(
    instrumented.locations
      .map((item) => item.oid)
      .filter((oid) => !originalOids.includes(oid)),
  );
  const injectedOids: string[] = [];
  const content = instrumented.content.replace(
    / data-oid="([a-z0-9._:-]+)"/g,
    (attribute, oid: string) => {
      if (!added.has(oid)) return attribute;
      const stable = `p:${createHash("sha256").update(`${path}:${injectedOids.length}`).digest("hex").slice(0, 32)}`;
      if (originalOids.includes(stable))
        throw new Error("Preview ID conflicts with user source");
      injectedOids.push(stable);
      return ` data-oid="${stable}"`;
    },
  );
  const preview = { content, injectedOids, originalOids };
  if (stripPreviewOids(content, preview) !== source) {
    throw new Error("Instrumentation would rewrite user source");
  }
  return preview;
}
