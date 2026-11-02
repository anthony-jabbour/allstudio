import type { PreviewElementSnapshot } from "../preview-bridge/protocol.ts";

export function observesAsset(
  element: PreviewElementSnapshot,
  previewOrigin: string,
  assetUrl: string,
): boolean {
  const image = element.image;
  if (
    !image?.complete ||
    !image.visible ||
    element.rect.width < 1 ||
    element.rect.height < 1 ||
    image.naturalWidth < 1 ||
    image.naturalHeight < 1
  )
    return false;
  try {
    const current = new URL(image.currentSrc);
    if (
      current.origin !== previewOrigin ||
      current.hash ||
      current.username ||
      current.password
    )
      return false;
    if (current.pathname === assetUrl && !current.search) return true;
    return (
      current.pathname === "/_next/image" &&
      current.searchParams.getAll("url").length === 1 &&
      current.searchParams.get("url") === assetUrl
    );
  } catch {
    return false;
  }
}
