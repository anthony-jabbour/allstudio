import { preparePreviewSource } from "./preview-source.ts";

export default function previewLoader(
  this: { resourcePath: string },
  source: string,
) {
  return preparePreviewSource(this.resourcePath, source).content;
}
