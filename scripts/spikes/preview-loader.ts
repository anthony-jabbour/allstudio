import { preparePreviewSource } from "./preview-source.ts";

export default function previewLoader(
  this: { resourcePath: string },
  source: string,
): string {
  console.error("Preview loader:", this.resourcePath);
  return preparePreviewSource(this.resourcePath, source).content;
}
