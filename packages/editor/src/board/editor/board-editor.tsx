import type { BoardDocumentV1 } from "@allstudio/project";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { locate } from "../model.ts";
import { BoardCanvas } from "./canvas.tsx";
import { type CommandContext, findCommand, formatKeys } from "./commands.ts";
import { I } from "./icons.tsx";
import { AgentPanel, StyleInspector } from "./inspector.tsx";
import { CommandPalette, ContextMenu } from "./menus.tsx";
import { AssetsPanel, LayersPanel, PagesPanel } from "./panels.tsx";
import { useBoardEditor } from "./use-board-editor.ts";

export interface BoardEditorProps {
  document: BoardDocumentV1;
  /** Persist the document; throw to report a failed save. */
  onSave: (doc: BoardDocumentV1) => void;
  onExit: () => void;
  onExport: (doc: BoardDocumentV1) => void;
  appearance: "light" | "dark";
  onToggleAppearance: () => void;
  /** Extra items for the app menu (host navigation). */
  menu?: { label: string; onSelect: () => void }[];
  active?: boolean;
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return (
    !!el &&
    (el.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))
  );
}

function ToolButton({
  label,
  shortcut,
  active,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={active ? "bx-tool active" : "bx-tool"}
      aria-label={label}
      aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Popover({
  label,
  trigger,
  className,
  children,
  placement = "below",
}: {
  label: string;
  trigger: ReactNode;
  className?: string;
  children: (close: () => void) => ReactNode;
  placement?: "below" | "above";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="bx-pop-anchor" ref={ref}>
      <button
        type="button"
        className={className}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>
      {open ? (
        <div className={`bx-pop ${placement}`} role="menu" aria-label={label}>
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  label,
  shortcut,
  onSelect,
  disabled,
}: {
  label: string;
  shortcut?: string;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className="bx-menu-item"
      disabled={disabled}
      onClick={onSelect}
    >
      <span>{label}</span>
      {shortcut ? <kbd>{shortcut}</kbd> : null}
    </button>
  );
}

/**
 * Framer/Paper-inspired board editor: top bar, Pages/Layers/Assets on the
 * left, infinite canvas, Style/Agent on the right and a floating toolbar.
 */
export function BoardEditor({
  document,
  onSave,
  onExit,
  onExport,
  appearance,
  onToggleAppearance,
  menu = [],
  active = true,
}: BoardEditorProps) {
  const editor = useBoardEditor({ document, onSave, appearance });
  const [leftTab, setLeftTab] = useState<"pages" | "layers" | "assets">(
    "layers",
  );
  const [rightTab, setRightTab] = useState<"style" | "agent">("style");
  const [renamingFile, setRenamingFile] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ text: string; tone: string } | null>(
    null,
  );
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteOpenRef = useRef(false);
  paletteOpenRef.current = paletteOpen;
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const commandCtx = useRef<CommandContext>({
    editor,
    openPalette: () => setPaletteOpen(true),
    openImagePicker: () => imageInput.current?.click(),
  });
  commandCtx.current = { ...commandCtx.current, editor };

  useEffect(() => {
    if (!editor.notice) return;
    setToast(editor.notice);
    const timer = window.setTimeout(
      () => setToast(null),
      editor.notice.tone === "error" ? 5000 : 2500,
    );
    return () => window.clearTimeout(timer);
  }, [editor.notice]);

  // Keyboard shortcuts (ignored while typing in inputs or editing text).
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      const ed = editorRef.current;
      if (isTyping(event.target) || paletteOpenRef.current) return;
      if (
        event.key.startsWith("Arrow") &&
        ed.selection.length &&
        !event.altKey &&
        !(event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        ed.nudge(
          event.key === "ArrowLeft"
            ? -step
            : event.key === "ArrowRight"
              ? step
              : 0,
          event.key === "ArrowUp"
            ? -step
            : event.key === "ArrowDown"
              ? step
              : 0,
        );
        return;
      }
      if (event.key === "Escape") {
        setContextMenu(null);
        if (ed.tool !== "select") ed.setTool("select");
        else ed.setSelection([]);
        return;
      }
      if (event.key === "Enter" && ed.selection.length === 1) {
        const node = locate(ed.page, ed.selection[0] as string)?.node;
        if (node?.type === "text") {
          event.preventDefault();
          ed.setEditingTextId(node.id);
        } else if (node?.type === "frame" && node.children.length) {
          event.preventDefault();
          ed.setSelection(node.children.map((c) => c.id));
        }
        return;
      }
      const command = findCommand(event);
      if (!command) return;
      event.preventDefault();
      if (!command.enabled || command.enabled(commandCtx.current))
        command.run(commandCtx.current);
    };
    // Clipboard: system events so images paste from other apps.
    const onCopy = (event: ClipboardEvent, cut = false) => {
      const ed = editorRef.current;
      if (isTyping(event.target) || !ed.selection.length) return;
      const nodes = ed.copySelection();
      if (!nodes.length) return;
      event.preventDefault();
      event.clipboardData?.setData("text/plain", ed.clipboardText(nodes));
      if (cut) ed.deleteSelection();
    };
    const onCut = (event: ClipboardEvent) => onCopy(event, true);
    const onPaste = (event: ClipboardEvent) => {
      const ed = editorRef.current;
      if (isTyping(event.target)) return;
      const files = [...(event.clipboardData?.files ?? [])].filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length) {
        event.preventDefault();
        for (const file of files) void ed.addImageFile(file);
        return;
      }
      const text = event.clipboardData?.getData("text/plain") ?? "";
      const nodes = text ? ed.parseClipboardText(text) : null;
      event.preventDefault();
      ed.pasteClipboard(nodes ?? undefined);
    };
    const onCopyEvent = (event: ClipboardEvent) => onCopy(event);
    window.addEventListener("keydown", onKey);
    window.addEventListener("copy", onCopyEvent);
    window.addEventListener("cut", onCut);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("copy", onCopyEvent);
      window.removeEventListener("cut", onCut);
      window.removeEventListener("paste", onPaste);
    };
  }, [active]);

  const zoomPct = Math.round(editor.viewport.zoom * 100);
  const saveLabel =
    editor.saveState === "saving"
      ? "Saving…"
      : editor.saveState === "error"
        ? "Not saved"
        : "Saved";

  return (
    <div className="bx-editor" data-save-state={editor.saveState}>
      <header className="bx-topbar">
        <div className="bx-top-left">
          <Popover
            label="App menu"
            className="bx-app-menu"
            trigger={
              <>
                <I.Logo />
                <span>Canvas</span>
                <I.Chevron size={12} />
              </>
            }
          >
            {(close) => (
              <>
                <MenuItem
                  label="Back to files"
                  onSelect={() => {
                    close();
                    onExit();
                  }}
                />
                {menu.map((item) => (
                  <MenuItem
                    key={item.label}
                    label={item.label}
                    onSelect={() => {
                      close();
                      item.onSelect();
                    }}
                  />
                ))}
                <hr />
                <MenuItem
                  label="Undo"
                  shortcut="⌘Z"
                  disabled={!editor.canUndo}
                  onSelect={() => {
                    close();
                    editor.undo();
                  }}
                />
                <MenuItem
                  label="Redo"
                  shortcut="⇧⌘Z"
                  disabled={!editor.canRedo}
                  onSelect={() => {
                    close();
                    editor.redo();
                  }}
                />
                <hr />
                <MenuItem
                  label="Export .board.json"
                  onSelect={() => {
                    close();
                    onExport(editor.doc);
                  }}
                />
                <MenuItem
                  label={appearance === "dark" ? "Light theme" : "Dark theme"}
                  onSelect={() => {
                    close();
                    onToggleAppearance();
                  }}
                />
              </>
            )}
          </Popover>
          <Popover label="Insert" className="bx-tool" trigger={<I.Plus />}>
            {(close) => (
              <>
                <MenuItem
                  label="Frame"
                  shortcut="F"
                  onSelect={() => {
                    close();
                    editor.setTool("frame");
                  }}
                />
                <MenuItem
                  label="Rectangle"
                  shortcut="R"
                  onSelect={() => {
                    close();
                    editor.setTool("rect");
                  }}
                />
                <MenuItem
                  label="Ellipse"
                  shortcut="O"
                  onSelect={() => {
                    close();
                    editor.setTool("ellipse");
                  }}
                />
                <MenuItem
                  label="Text"
                  shortcut="T"
                  onSelect={() => {
                    close();
                    editor.setTool("text");
                  }}
                />
                <MenuItem
                  label="Image…"
                  shortcut="⇧I"
                  onSelect={() => {
                    close();
                    imageInput.current?.click();
                  }}
                />
              </>
            )}
          </Popover>
          <ToolButton
            label="Frame"
            shortcut="F"
            active={editor.tool === "frame"}
            onClick={() => editor.setTool("frame")}
          >
            <I.Frame />
          </ToolButton>
          <ToolButton
            label="Text"
            shortcut="T"
            active={editor.tool === "text"}
            onClick={() => editor.setTool("text")}
          >
            <I.Text />
          </ToolButton>
          <ToolButton
            label="Rectangle"
            shortcut="R"
            active={editor.tool === "rect"}
            onClick={() => editor.setTool("rect")}
          >
            <I.Rect />
          </ToolButton>
          <ToolButton
            label="Ellipse"
            shortcut="O"
            active={editor.tool === "ellipse"}
            onClick={() => editor.setTool("ellipse")}
          >
            <I.Ellipse />
          </ToolButton>
          <ToolButton
            label="Image"
            shortcut="⇧I"
            onClick={() => imageInput.current?.click()}
          >
            <I.Image />
          </ToolButton>
        </div>
        <div className="bx-title">
          {renamingFile ? (
            <input
              className="bx-inline-input title"
              aria-label="File name"
              defaultValue={editor.doc.name}
              maxLength={200}
              // biome-ignore lint/a11y/noAutofocus: explicit rename click
              autoFocus
              onFocus={(event) => event.currentTarget.select()}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") setRenamingFile(false);
              }}
              onBlur={(event) => {
                const name = event.currentTarget.value.trim().slice(0, 200);
                if (name && name !== editor.doc.name)
                  editor.applyDoc({ ...editor.doc, name });
                setRenamingFile(false);
              }}
            />
          ) : (
            <button
              type="button"
              className="bx-title-button"
              title="Rename file"
              onClick={() => setRenamingFile(true)}
            >
              {editor.doc.name}
            </button>
          )}
          <span className="bx-dot">·</span>
          <span className="bx-page-chip">
            <I.Page size={12} /> {editor.page.name}
          </span>
        </div>
        <div className="bx-top-right">
          <output className={`bx-save ${editor.saveState}`}>{saveLabel}</output>
          <ToolButton label="Undo" shortcut="⌘Z" onClick={editor.undo}>
            <I.Undo />
          </ToolButton>
          <ToolButton label="Redo" shortcut="⇧⌘Z" onClick={editor.redo}>
            <I.Redo />
          </ToolButton>
          <button
            type="button"
            className="bx-primary"
            onClick={() => onExport(editor.doc)}
          >
            Export
          </button>
        </div>
      </header>

      <aside className="bx-left" aria-label="Pages, layers and assets">
        <div className="bx-tabs" role="tablist" aria-label="Left panel">
          {(["pages", "layers", "assets"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={leftTab === tab}
              className={leftTab === tab ? "bx-tab active" : "bx-tab"}
              onClick={() => setLeftTab(tab)}
            >
              {tab[0]?.toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        {leftTab === "pages" ? (
          <PagesPanel editor={editor} />
        ) : leftTab === "layers" ? (
          <>
            <div className="bx-mini-pages">
              {editor.doc.pages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={
                    p.id === editor.pageId
                      ? "bx-mini-page active"
                      : "bx-mini-page"
                  }
                  onClick={() => editor.switchPage(p.id)}
                >
                  <I.Page size={13} /> {p.name}
                </button>
              ))}
            </div>
            <LayersPanel editor={editor} />
          </>
        ) : (
          <AssetsPanel editor={editor} />
        )}
      </aside>

      <main className="bx-main">
        <BoardCanvas
          editor={editor}
          active={active}
          onContextMenu={(at) => setContextMenu(at)}
        />
        <div className="bx-dock" role="toolbar" aria-label="Canvas tools">
          <ToolButton
            label="Select"
            shortcut="V"
            active={editor.tool === "select"}
            onClick={() => editor.setTool("select")}
          >
            <I.Pointer />
          </ToolButton>
          <ToolButton
            label="Hand"
            shortcut="H"
            active={editor.tool === "hand"}
            onClick={() => editor.setTool("hand")}
          >
            <I.Hand />
          </ToolButton>
          <ToolButton
            label={appearance === "dark" ? "Light theme" : "Dark theme"}
            onClick={onToggleAppearance}
          >
            {appearance === "dark" ? <I.Sun /> : <I.Moon />}
          </ToolButton>
          <span className="bx-dock-sep" />
          <Popover
            label="Zoom"
            className="bx-zoom"
            placement="above"
            trigger={
              <>
                <span data-testid="zoom-level">{zoomPct}%</span>
                <I.Chevron size={12} />
              </>
            }
          >
            {(close) => (
              <>
                <MenuItem
                  label="Zoom in"
                  shortcut="⌘+"
                  onSelect={() => {
                    close();
                    editor.zoomBy(1.25);
                  }}
                />
                <MenuItem
                  label="Zoom out"
                  shortcut="⌘−"
                  onSelect={() => {
                    close();
                    editor.zoomBy(0.8);
                  }}
                />
                <MenuItem
                  label="Zoom to 100%"
                  shortcut="⌘0"
                  onSelect={() => {
                    close();
                    editor.zoomTo(1);
                  }}
                />
                <MenuItem
                  label="Zoom to fit"
                  shortcut="⇧1"
                  onSelect={() => {
                    close();
                    editor.fitAll();
                  }}
                />
                <MenuItem
                  label="Zoom to selection"
                  shortcut="⇧2"
                  disabled={!editor.selection.length}
                  onSelect={() => {
                    close();
                    editor.fitSelection();
                  }}
                />
              </>
            )}
          </Popover>
        </div>
        {toast ? (
          <output className={`bx-toast ${toast.tone}`}>{toast.text}</output>
        ) : null}
        <button
          type="button"
          className="bx-palette-hint"
          onClick={() => setPaletteOpen(true)}
          title="Command palette"
        >
          <I.Search size={13} /> Commands <kbd>{formatKeys("mod+k")}</kbd>
        </button>
      </main>

      <aside className="bx-right" aria-label="Inspector">
        <div className="bx-tabs" role="tablist" aria-label="Right panel">
          {(["agent", "style"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={rightTab === tab}
              className={rightTab === tab ? "bx-tab active" : "bx-tab"}
              onClick={() => setRightTab(tab)}
            >
              {tab === "agent" ? "Agent" : "Style"}
            </button>
          ))}
        </div>
        {rightTab === "style" ? (
          <StyleInspector editor={editor} />
        ) : (
          <AgentPanel editor={editor} />
        )}
      </aside>

      {contextMenu ? (
        <ContextMenu
          at={contextMenu}
          ctx={commandCtx.current}
          onClose={() => setContextMenu(null)}
        />
      ) : null}
      {paletteOpen ? (
        <CommandPalette
          ctx={commandCtx.current}
          onClose={() => setPaletteOpen(false)}
        />
      ) : null}
      <input
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        hidden
        data-testid="image-input"
        onChange={(event) => {
          for (const file of [...(event.target.files ?? [])])
            void editor.addImageFile(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
