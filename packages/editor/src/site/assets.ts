export const MAX_ASSET_FILES = 500;
export const MAX_ASSET_BYTES = 10 * 1024 * 1024;
export const MAX_ASSET_PATH_LENGTH = 1024;
export const MAX_ASSET_URL_LENGTH = 2048;
const TYPES = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
} as const;
export interface ProjectAsset {
  path: string;
  url: string;
  type: (typeof TYPES)[keyof typeof TYPES];
  size: number;
}
export function assetUrl(path: unknown): string | null {
  if (
    typeof path !== "string" ||
    path.length > MAX_ASSET_PATH_LENGTH ||
    !path.startsWith("public/") ||
    /[\\:%?#]/.test(path) ||
    Array.from(path).some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    )
  )
    return null;
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) return null;
  const extension = parts.at(-1)?.split(".").at(-1)?.toLowerCase();
  if (!extension || !Object.hasOwn(TYPES, extension)) return null;
  try {
    const url =
      "/" +
      parts
        .slice(1)
        .map((part) => encodeURIComponent(part).replace(/'/g, "%27"))
        .join("/");
    return url.length <= MAX_ASSET_URL_LENGTH ? url : null;
  } catch {
    return null;
  }
}
export function assetPathFromUrl(url: unknown): string | null {
  if (
    typeof url !== "string" ||
    !url.startsWith("/") ||
    url.startsWith("//") ||
    url.length > MAX_ASSET_URL_LENGTH ||
    /[?#\\]/.test(url)
  )
    return null;
  try {
    const path =
      "public" +
      url
        .split("/")
        .map((part) => decodeURIComponent(part))
        .join("/");
    return assetUrl(path) === url ? path : null;
  } catch {
    return null;
  }
}
export function assetFromMetadata(
  path: string,
  size: number,
): ProjectAsset | null {
  const url = assetUrl(path);
  if (!url || !Number.isSafeInteger(size) || size < 0) return null;
  const extension = path.split(".").at(-1)?.toLowerCase() as keyof typeof TYPES;
  return { path, url, type: TYPES[extension], size };
}
export function isUsableAsset(asset: ProjectAsset): boolean {
  return asset.size > 0 && asset.size <= MAX_ASSET_BYTES;
}
