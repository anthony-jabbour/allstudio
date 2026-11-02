import type { BoardNode } from "@allstudio/project";
import { type ReactNode, useMemo, useRef, useState } from "react";
import {
  addPage,
  deletePage,
  duplicatePage,
  locate,
  renamePage,
  reparent,
  updateNodes,
  walk,
} from "../model.ts";
import { I } from "./icons.tsx";
import type { BoardEditorState } from "./use-board-editor.ts";

const TYPE_ICON: Record<
  BoardNode["type"],
  (p: { size?: number }) => ReactNode
> = {
  frame: I.Frame,
  rect: I.Rect,
  ellipse: I.Ellipse,
  text: I.Text,
  image: I.Image,
};

function InlineName({
  value,
  label,
  onCommit,
  onDone,
}: {
  value: string;
  label: string;
  onCommit: (value: string) => void;
  onDone: () => void;
}) {
  return (
    <input
      className="bx-inline-input"
      aria-label={label}
      defaultValue={value}
      maxLength={200}
      // biome-ignore lint/a11y/noAutofocus: rename starts from an explicit double-click
      autoFocus
      onFocus={(event) => event.currentTarget.select()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") onDone();
      }}
      onBlur={(event) => {
        const next = event.currentTarget.value.trim();
        if (next && next !== value) onCommit(next);
        onDone();
      }}
    />
  );
}

export function PagesPanel({ editor }: { editor: BoardEditorState }) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const pages = editor.doc.pages.filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <div className="bx-panel-body">
      <label className="bx-search">
        <I.Search />
        <input
          placeholder="Search…"
          aria-label="Search pages"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="bx-section-head">
        <span>Pages</span>
        <button
          type="button"
          className="bx-icon"
          aria-label="Add page"
          title="Add page"
          onClick={() => {
            const result = addPage(editor.doc);
            editor.applyDoc(result.doc);
            editor.switchPage(result.id);
          }}
        >
          <I.Plus />
        </button>
      </div>
      <ul className="bx-list" aria-label="Pages">
        {pages.map((page, index) => (
          <li key={page.id}>
            <div
              className={page.id === editor.pageId ? "bx-row active" : "bx-row"}
              data-page-id={page.id}
            >
              <button
                type="button"
                className="bx-row-main"
                aria-current={page.id === editor.pageId ? "page" : undefined}
                onClick={() => editor.switchPage(page.id)}
                onDoubleClick={() => setRenaming(page.id)}
              >
                <I.Page />
                {renaming === page.id ? (
                  <InlineName
                    value={page.name}
                    label="Page name"
                    onCommit={(name) =>
                      editor.applyDoc(renamePage(editor.doc, page.id, name))
                    }
                    onDone={() => setRenaming(null)}
                  />
                ) : (
                  <span className="bx-row-label">
                    {String(index + 1).padStart(2, "0")} — {page.name}
                  </span>
                )}
              </button>
              <span className="bx-row-tools">
                <button
                  type="button"
                  className="bx-icon"
                  aria-label={`Duplicate ${page.name}`}
                  title="Duplicate page"
                  onClick={() => {
                    const result = duplicatePage(editor.doc, page.id);
                    if (result) {
                      editor.applyDoc(result.doc);
                      editor.switchPage(result.id);
                    }
                  }}
                >
                  <I.Copy />
                </button>
                <button
                  type="button"
                  className="bx-icon"
                  aria-label={`Delete ${page.name}`}
                  title={
                    editor.doc.pages.length > 1
                      ? "Delete page"
                      : "A file needs at least one page"
                  }
                  disabled={editor.doc.pages.length <= 1}
                  onClick={() => {
                    const next = deletePage(editor.doc, page.id);
                    editor.applyDoc(next);
                    if (page.id === editor.pageId && next.pages[0])
                      editor.switchPage(next.pages[0].id);
                  }}
                >
                  <I.Trash />
                </button>
              </span>
            </div>
          </li>
        ))}
      </ul>
      <p className="bx-hint">Double-click a page to rename it.</p>
    </div>
  );
}

interface Row {
  node: BoardNode;
  depth: number;
  parentId: string | null;
}

export function LayersPanel({ editor }: { editor: BoardEditorState }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [drop, setDrop] = useState<{
    id: string;
    zone: "before" | "after" | "inside";
  } | null>(null);
  const dragId = useRef<string | null>(null);
  const tree = useRef<HTMLDivElement>(null);
  const { page, selection } = editor;

  // Topmost layer first, like every design tool's layer list.
  const rows = useMemo(() => {
    const out: Row[] = [];
    const visit = (
      nodes: BoardNode[],
      depth: number,
      parentId: string | null,
    ) => {
      for (const node of [...nodes].reverse()) {
        out.push({ node, depth, parentId });
        if (node.type === "frame" && !collapsed.has(node.id))
          visit(node.children, depth + 1, node.id);
      }
    };
    visit(page.nodes, 0, null);
    return out;
  }, [page.nodes, collapsed]);

  const toggleCollapse = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const select = (id: string, additive: boolean) => {
    if (additive) {
      editor.setSelection(
        selection.includes(id)
          ? selection.filter((s) => s !== id)
          : [...selection, id],
      );
    } else editor.setSelection([id]);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const current = rows.findIndex((row) => row.node.id === selection.at(-1));
    const focusRow = (index: number) => {
      const row = rows[index];
      if (!row) return;
      editor.setSelection([row.node.id]);
      window.requestAnimationFrame(() =>
        tree.current
          ?.querySelector<HTMLElement>(
            `[data-layer-id="${row.node.id}"] .bx-row-main`,
          )
          ?.focus(),
      );
    };
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusRow(Math.min(rows.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusRow(Math.max(0, current - 1));
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const row = rows[current];
      if (row?.node.type === "frame") {
        event.preventDefault();
        const isCollapsed = collapsed.has(row.node.id);
        if ((event.key === "ArrowLeft") !== isCollapsed)
          toggleCollapse(row.node.id);
      } else if (event.key === "ArrowLeft" && row?.parentId) {
        event.preventDefault();
        focusRow(rows.findIndex((r) => r.node.id === row.parentId));
      }
    }
  };

  const onDrop = (target: Row) => {
    const id = dragId.current;
    const zone = drop?.zone;
    setDrop(null);
    dragId.current = null;
    if (!id || !zone || id === target.node.id) return;
    let parentId = target.parentId;
    let index: number;
    const siblings = target.parentId
      ? (locate(page, target.parentId)?.node as { children: BoardNode[] })
          .children
      : page.nodes;
    const targetIndex = siblings.findIndex((n) => n.id === target.node.id);
    if (zone === "inside" && target.node.type === "frame") {
      parentId = target.node.id;
      index = target.node.children.length;
    } else {
      // The list is reversed: "before" (above) means a higher array index.
      index = zone === "before" ? targetIndex + 1 : targetIndex;
    }
    editor.apply((p) => reparent(p, id, parentId, index), { select: [id] });
  };

  return (
    <div className="bx-panel-body">
      <div className="bx-section-head">
        <span>{page.name}</span>
        <span className="bx-muted">
          {rows.length ? `${countNodes(page.nodes)} layers` : ""}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="bx-hint">
          No layers yet. Draw a frame (F), rectangle (R) or text (T).
        </p>
      ) : (
        <div
          ref={tree}
          role="tree"
          aria-label="Layers"
          aria-multiselectable="true"
          className="bx-tree"
          onKeyDown={onKeyDown}
        >
          {rows.map((row) => {
            const { node } = row;
            const Icon = TYPE_ICON[node.type];
            const isSelected = selection.includes(node.id);
            const zone = drop?.id === node.id ? drop.zone : null;
            return (
              <div
                key={node.id}
                role="treeitem"
                aria-selected={isSelected}
                aria-level={row.depth + 1}
                aria-expanded={
                  node.type === "frame" ? !collapsed.has(node.id) : undefined
                }
                tabIndex={-1}
                data-layer-id={node.id}
                className={[
                  "bx-row",
                  "bx-layer",
                  isSelected ? "active" : "",
                  editor.hoverId === node.id ? "hover" : "",
                  node.hidden ? "is-hidden" : "",
                  zone ? `drop-${zone}` : "",
                ].join(" ")}
                style={{ paddingLeft: 6 + row.depth * 14 }}
                draggable={renaming !== node.id}
                onDragStart={(event) => {
                  dragId.current = node.id;
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", node.name);
                }}
                onDragOver={(event) => {
                  if (!dragId.current) return;
                  event.preventDefault();
                  const rect = event.currentTarget.getBoundingClientRect();
                  const t = (event.clientY - rect.top) / rect.height;
                  setDrop({
                    id: node.id,
                    zone:
                      node.type === "frame" && t > 0.3 && t < 0.7
                        ? "inside"
                        : t < 0.5
                          ? "before"
                          : "after",
                  });
                }}
                onDragLeave={() =>
                  setDrop((d) => (d?.id === node.id ? null : d))
                }
                onDrop={(event) => {
                  event.preventDefault();
                  onDrop(row);
                }}
                onMouseEnter={() => editor.setHoverId(node.id)}
                onMouseLeave={() => editor.setHoverId(null)}
              >
                {node.type === "frame" ? (
                  <button
                    type="button"
                    className={
                      collapsed.has(node.id) ? "bx-caret collapsed" : "bx-caret"
                    }
                    aria-label={
                      collapsed.has(node.id)
                        ? `Expand ${node.name}`
                        : `Collapse ${node.name}`
                    }
                    tabIndex={-1}
                    onClick={() => toggleCollapse(node.id)}
                  >
                    <I.Chevron size={12} />
                  </button>
                ) : (
                  <span className="bx-caret-space" />
                )}
                <button
                  type="button"
                  className="bx-row-main"
                  onClick={(event) =>
                    select(
                      node.id,
                      event.shiftKey || event.metaKey || event.ctrlKey,
                    )
                  }
                  onDoubleClick={() => setRenaming(node.id)}
                >
                  <Icon size={14} />
                  {renaming === node.id ? (
                    <InlineName
                      value={node.name}
                      label="Layer name"
                      onCommit={(name) =>
                        editor.apply((p) => updateNodes(p, [node.id], { name }))
                      }
                      onDone={() => setRenaming(null)}
                    />
                  ) : (
                    <span className="bx-row-label">{node.name}</span>
                  )}
                </button>
                <span
                  className={
                    node.hidden || node.locked
                      ? "bx-row-tools pinned"
                      : "bx-row-tools"
                  }
                >
                  <button
                    type="button"
                    className="bx-icon"
                    aria-label={
                      node.locked ? `Unlock ${node.name}` : `Lock ${node.name}`
                    }
                    aria-pressed={!!node.locked}
                    tabIndex={-1}
                    onClick={() => editor.toggle("locked", [node.id])}
                  >
                    {node.locked ? (
                      <I.Lock size={13} />
                    ) : (
                      <I.Unlock size={13} />
                    )}
                  </button>
                  <button
                    type="button"
                    className="bx-icon"
                    aria-label={
                      node.hidden ? `Show ${node.name}` : `Hide ${node.name}`
                    }
                    aria-pressed={!!node.hidden}
                    tabIndex={-1}
                    onClick={() => editor.toggle("hidden", [node.id])}
                  >
                    {node.hidden ? <I.EyeOff size={13} /> : <I.Eye size={13} />}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
      <p className="bx-hint">
        Drag to reorder or nest · Double-click to rename
      </p>
    </div>
  );
}

function countNodes(nodes: BoardNode[]): number {
  let count = 0;
  walk(nodes, () => {
    count++;
  });
  return count;
}

export function AssetsPanel({ editor }: { editor: BoardEditorState }) {
  const upload = useRef<HTMLInputElement>(null);
  const { images, colors } = useMemo(() => {
    const images: { id: string; pageId: string; name: string; src: string }[] =
      [];
    const colors = new Map<string, number>();
    for (const p of editor.doc.pages) {
      walk(p.nodes, (node) => {
        if (node.type === "image")
          images.push({
            id: node.id,
            pageId: p.id,
            name: node.name,
            src: node.src,
          });
        const add = (c?: string | null) => {
          if (c && c !== "transparent")
            colors.set(c.toLowerCase(), (colors.get(c.toLowerCase()) ?? 0) + 1);
        };
        add(node.fill);
        if (node.gradient) {
          add(node.gradient[1]);
          add(node.gradient[2]);
        }
        if (node.type === "text") add(node.color);
      });
    }
    return {
      images,
      colors: [...colors.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([c]) => c)
        .slice(0, 24),
    };
  }, [editor.doc]);
  const canApply = editor.selection.length > 0;
  return (
    <div className="bx-panel-body">
      <div className="bx-section-head">
        <span>Images</span>
        <button
          type="button"
          className="bx-icon"
          aria-label="Upload image"
          title="Upload image"
          onClick={() => upload.current?.click()}
        >
          <I.Plus />
        </button>
      </div>
      <input
        ref={upload}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        hidden
        data-testid="asset-upload"
        onChange={(event) => {
          for (const file of [...(event.target.files ?? [])])
            void editor.addImageFile(file);
          event.target.value = "";
        }}
      />
      {images.length ? (
        <div className="bx-assets">
          {images.map((image) => (
            <button
              key={image.id}
              type="button"
              className="bx-asset"
              title={image.name}
              onClick={() => {
                if (image.pageId !== editor.pageId)
                  editor.switchPage(image.pageId);
                window.requestAnimationFrame(() =>
                  editor.setSelection([image.id]),
                );
              }}
            >
              {/* biome-ignore lint/performance/noImgElement: validated inline data URL */}
              <img src={image.src} alt={image.name} />
            </button>
          ))}
        </div>
      ) : (
        <p className="bx-hint">
          Upload, paste or drop PNG, JPEG, GIF or WebP images (up to 4 MB). They
          are stored inside the file.
        </p>
      )}
      <div className="bx-section-head">
        <span>Colors in this file</span>
      </div>
      <div className="bx-swatches">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            className="bx-swatch"
            style={{ background: color }}
            title={canApply ? `Apply ${color} to selection` : color}
            aria-label={canApply ? `Apply ${color} to selection` : color}
            disabled={!canApply}
            onClick={() =>
              editor.patchSelection((node) =>
                node.type === "text"
                  ? { color }
                  : { fill: color, gradient: null },
              )
            }
          />
        ))}
      </div>
      <p className="bx-hint">
        {canApply
          ? "Click a swatch to apply it to the selection."
          : "Select a layer to apply colors."}
      </p>
    </div>
  );
}
