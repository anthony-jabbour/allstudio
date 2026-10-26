import { createHash } from "node:crypto";
import { instrumentSource, listOids } from "@allstudio/editor/source-mapper";

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
  let original = content;
  for (const attribute of preview.attributes) {
    if (original.split(attribute.virtual).length !== 2) {
      throw new Error("Preview attribute missing or ambiguous");
    }
    original = original.replace(attribute.virtual, () => attribute.original);
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
  const attributes: PreviewSource["attributes"] = [];
  const version = createHash("sha256").update(source).digest("hex");
  const content = instrumented.content.replace(
    /\s+data-oid\s*=\s*(["'])([^"']+)\1/g,
    (attribute, quote: string, oid: string) => {
      const stable = `p:${createHash("sha256").update(`${path}:${version}:${injectedOids.length}`).digest("hex").slice(0, 32)}`;
      if (originalOids.includes(stable))
        throw new Error("Preview ID conflicts with user source");
      injectedOids.push(stable);
      const virtual = attribute.replace(
        `${quote}${oid}${quote}`,
        () => `${quote}${stable}${quote}`,
      );
      attributes.push({ virtual, original: added.has(oid) ? "" : attribute });
      return virtual;
    },
  );
  const preview = { content, injectedOids, originalOids, attributes };
  if (
    JSON.stringify(listOids(content)) !== JSON.stringify(injectedOids) ||
    stripPreviewOids(content, preview) !== source
  ) {
    throw new Error("Instrumentation would rewrite user source");
  }
  return preview;
}
