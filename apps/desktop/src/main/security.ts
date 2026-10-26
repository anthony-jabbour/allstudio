import { resolve, sep } from "node:path";

export const EDITOR_URL = "app://editor/index.html";

interface Frame {
  url: string;
}
interface Editor {
  mainFrame: Frame;
}

export function isTrustedRequest(
  event: { sender: unknown; senderFrame: Frame | null },
  editor: Editor,
  args: unknown[],
): boolean {
  return (
    args.length === 0 &&
    event.sender === editor &&
    event.senderFrame === editor.mainFrame &&
    event.senderFrame.url === EDITOR_URL
  );
}

export function assetPath(url: string, root: string): string | null {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "app:" ||
      parsed.host !== "editor" ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }
    const pathname = decodeURIComponent(parsed.pathname);
    const segments = pathname.slice(1).split("/");
    if (
      pathname.includes("\\") ||
      pathname.includes("\0") ||
      segments.some((part) => !part || part === "." || part === "..")
    ) {
      return null;
    }
    const target = resolve(root, ...segments);
    return target.startsWith(`${resolve(root)}${sep}`) ? target : null;
  } catch {
    return null;
  }
}
