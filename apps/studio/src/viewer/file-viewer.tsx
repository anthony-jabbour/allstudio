import { BoardThumbnail } from "@allstudio/editor/board";
import { useMemo } from "react";
import { useElementSize } from "../files/file-card.tsx";
import { useFileStore, useFiles } from "../files/use-files.ts";
import { href } from "../router.ts";
import { Icon } from "../ui/icons.tsx";

/**
 * Read-only file view. The interactive board editor replaces this route in
 * its own PR; until then a file opens as a real, scaled render.
 */
export function FileViewer({ id }: { id: string }) {
  const store = useFileStore();
  const files = useFiles();
  const file = files.find((item) => item.id === id);
  const doc = useMemo(() => {
    try {
      return file ? store.read(id) : new Error("This file no longer exists.");
    } catch (error) {
      return error instanceof Error ? error : new Error("Unreadable file.");
    }
  }, [store, id, file]);
  const [ref, size] = useElementSize<HTMLDivElement>();
  return (
    <div className="viewer">
      <header className="viewer-bar">
        <a
          className="button ghost"
          href={href({ name: "home", section: "recents" })}
        >
          <Icon.Arrow style={{ transform: "rotate(180deg)" }} /> Files
        </a>
        <strong>{file?.name ?? "Missing file"}</strong>
        <span className="pill">Read-only preview</span>
      </header>
      <div ref={ref} className="viewer-stage">
        {doc instanceof Error ? (
          <p className="empty">{doc.message}</p>
        ) : size.width > 0 ? (
          <BoardThumbnail
            document={doc}
            width={size.width}
            height={size.height}
            padding={48}
          />
        ) : null}
      </div>
    </div>
  );
}
