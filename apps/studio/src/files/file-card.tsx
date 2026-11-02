import { BoardThumbnail } from "@allstudio/editor/board";
import type { BoardDocumentV1 } from "@allstudio/project";
import { useEffect, useMemo, useRef, useState } from "react";
import { Menu, type MenuEntry } from "../ui/controls.tsx";
import { Icon } from "../ui/icons.tsx";
import { formatEdited, type StudioFile } from "./file-store.ts";
import { useFileStore } from "./use-files.ts";

export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Reads the stored document for a real thumbnail; damaged files say so. */
function readDocument(
  store: ReturnType<typeof useFileStore>,
  id: string,
  _version: string,
): BoardDocumentV1 | Error {
  try {
    return store.read(id);
  } catch (error) {
    return error instanceof Error ? error : new Error("Unreadable file.");
  }
}

/** Reads the stored document for a real thumbnail; damaged files say so. */
export function useDocument(file: StudioFile): BoardDocumentV1 | Error {
  const store = useFileStore();
  // updatedAt is the cache key: every save produces a fresh read.
  return useMemo(
    () => readDocument(store, file.id, file.updatedAt),
    [store, file.id, file.updatedAt],
  );
}

export function FileThumbnail({ file }: { file: StudioFile }) {
  const doc = useDocument(file);
  const [ref, size] = useElementSize<HTMLDivElement>();
  return (
    <div ref={ref} className="thumb">
      {doc instanceof Error ? (
        <p className="thumb-error">{doc.message}</p>
      ) : size.width > 0 ? (
        <BoardThumbnail
          document={doc}
          width={size.width}
          height={size.height}
          className="thumb-render"
        />
      ) : null}
    </div>
  );
}

export function FileCard({
  file,
  onOpen,
  menu,
  now,
}: {
  file: StudioFile;
  onOpen: (file: StudioFile) => void;
  menu: MenuEntry[];
  now: Date;
}) {
  return (
    <article
      className="file-card"
      data-file-id={file.id}
      onDoubleClick={() => onOpen(file)}
    >
      <header className="file-card-header">
        <button
          type="button"
          className="file-card-open"
          onClick={() => onOpen(file)}
        >
          <span className="file-card-title">
            {file.name}
            {file.permanent ? (
              <Icon.Pencil className="file-card-badge" />
            ) : null}
          </span>
          <span className="file-card-meta">
            {file.permanent
              ? "Your permanent draft"
              : file.archived
                ? `Archived · ${formatEdited(file.updatedAt, now).toLowerCase()}`
                : formatEdited(file.updatedAt, now)}
          </span>
        </button>
        <Menu
          label={`Actions for ${file.name}`}
          trigger={<Icon.Dots />}
          items={menu}
          className="icon-button card-menu"
        />
      </header>
      <button
        type="button"
        className="file-card-preview"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => onOpen(file)}
      >
        <FileThumbnail file={file} />
      </button>
    </article>
  );
}
