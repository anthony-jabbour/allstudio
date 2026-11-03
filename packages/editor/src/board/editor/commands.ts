import { locate } from "../model.ts";
import type { BoardEditorState, Tool } from "./use-board-editor.ts";

/**
 * One registry for every editor command: the keyboard handler, the
 * right-click menu and the ⌘K command palette all read from it, so a
 * shortcut shown in a menu is always the shortcut that works.
 *
 * Reference: Onlook's `components/hotkey.ts` (Apache-2.0, @ 423e2e9) keeps a
 * display-only list of shortcuts that each surface wires up separately.
 * allstudio's version adds matching, enablement and execution so the list
 * cannot drift from behaviour.
 */

export interface CommandContext {
  editor: BoardEditorState;
  openPalette: () => void;
  openImagePicker: () => void;
}

export interface Command {
  id: string;
  label: string;
  group: string;
  /** Combos like "mod+shift+z"; the first is shown in menus. */
  keys?: string[];
  run: (ctx: CommandContext) => void;
  enabled?: (ctx: CommandContext) => boolean;
}

const hasSelection = ({ editor }: CommandContext) =>
  editor.selection.length > 0;
const single = ({ editor }: CommandContext) => editor.selection.length === 1;
const many =
  (n: number) =>
  ({ editor }: CommandContext) =>
    editor.selection.length >= n;
const selectedFrame = ({ editor }: CommandContext) => {
  const [id] = editor.selection;
  return (
    editor.selection.length === 1 &&
    !!id &&
    locate(editor.page, id)?.node.type === "frame"
  );
};
const tool = (id: string, label: string, t: Tool, key: string): Command => ({
  id,
  label,
  group: "Tools",
  keys: [key],
  run: ({ editor }) => editor.setTool(t),
});

export const COMMANDS: Command[] = [
  tool("tool.select", "Select", "select", "v"),
  tool("tool.hand", "Hand", "hand", "h"),
  { ...tool("tool.frame", "Frame", "frame", "f"), keys: ["f", "a"] },
  tool("tool.rect", "Rectangle", "rect", "r"),
  tool("tool.ellipse", "Ellipse", "ellipse", "o"),
  tool("tool.text", "Text", "text", "t"),
  {
    id: "tool.image",
    label: "Insert image…",
    group: "Tools",
    keys: ["shift+i"],
    run: (ctx) => ctx.openImagePicker(),
  },

  {
    id: "edit.undo",
    label: "Undo",
    group: "Edit",
    keys: ["mod+z"],
    run: ({ editor }) => editor.undo(),
    enabled: ({ editor }) => editor.canUndo,
  },
  {
    id: "edit.redo",
    label: "Redo",
    group: "Edit",
    keys: ["mod+shift+z", "mod+y"],
    run: ({ editor }) => editor.redo(),
    enabled: ({ editor }) => editor.canRedo,
  },
  // Copy/cut/paste keys go through the system clipboard events, not here.
  {
    id: "edit.copy",
    label: "Copy",
    group: "Edit",
    run: ({ editor }) => void editor.copySelection(),
    enabled: hasSelection,
  },
  {
    id: "edit.cut",
    label: "Cut",
    group: "Edit",
    run: ({ editor }) => {
      editor.copySelection();
      editor.deleteSelection();
    },
    enabled: hasSelection,
  },
  {
    id: "edit.paste",
    label: "Paste",
    group: "Edit",
    run: ({ editor }) => editor.pasteClipboard(),
    enabled: ({ editor }) => editor.hasClipboard(),
  },
  {
    id: "edit.duplicate",
    label: "Duplicate",
    group: "Edit",
    keys: ["mod+d"],
    run: ({ editor }) => editor.duplicateSelection(),
    enabled: hasSelection,
  },
  {
    id: "edit.delete",
    label: "Delete",
    group: "Edit",
    keys: ["backspace", "delete"],
    run: ({ editor }) => editor.deleteSelection(),
    enabled: hasSelection,
  },
  {
    id: "edit.select-all",
    label: "Select all",
    group: "Edit",
    keys: ["mod+a"],
    run: ({ editor }) =>
      editor.setSelection(
        editor.page.nodes
          .filter((n) => !n.locked && !n.hidden)
          .map((n) => n.id),
      ),
  },
  {
    id: "edit.copy-style",
    label: "Copy style",
    group: "Edit",
    keys: ["mod+alt+c"],
    run: ({ editor }) => editor.copyStyleOfSelection(),
    enabled: single,
  },
  {
    id: "edit.paste-style",
    label: "Paste style",
    group: "Edit",
    keys: ["mod+alt+v"],
    run: ({ editor }) => editor.pasteStyleToSelection(),
    enabled: (ctx) => hasSelection(ctx) && ctx.editor.hasCopiedStyle(),
  },

  {
    id: "layer.frame",
    label: "Frame selection",
    group: "Layer",
    keys: ["mod+alt+g", "mod+g"],
    run: ({ editor }) => editor.frameSelected(),
    enabled: hasSelection,
  },
  {
    id: "layer.unframe",
    label: "Remove frame",
    group: "Layer",
    keys: ["mod+shift+g"],
    run: ({ editor }) => editor.unframeSelected(),
    enabled: selectedFrame,
  },
  {
    id: "layer.stack",
    label: "Add auto layout",
    group: "Layer",
    keys: ["shift+a"],
    run: ({ editor }) => editor.addAutoLayout(),
    enabled: hasSelection,
  },
  {
    id: "layer.unstack",
    label: "Remove auto layout",
    group: "Layer",
    keys: ["alt+shift+a"],
    run: ({ editor }) => editor.removeAutoLayout(),
    enabled: (ctx) => {
      const [id] = ctx.editor.selection;
      const node = id ? locate(ctx.editor.page, id)?.node : null;
      return node?.type === "frame" && !!node.layout;
    },
  },
  {
    id: "layer.front",
    label: "Bring to front",
    group: "Arrange",
    keys: ["mod+alt+]"],
    run: ({ editor }) => editor.reorder("front"),
    enabled: hasSelection,
  },
  {
    id: "layer.forward",
    label: "Bring forward",
    group: "Arrange",
    keys: ["mod+]"],
    run: ({ editor }) => editor.reorder("forward"),
    enabled: hasSelection,
  },
  {
    id: "layer.backward",
    label: "Send backward",
    group: "Arrange",
    keys: ["mod+["],
    run: ({ editor }) => editor.reorder("backward"),
    enabled: hasSelection,
  },
  {
    id: "layer.back",
    label: "Send to back",
    group: "Arrange",
    keys: ["mod+alt+["],
    run: ({ editor }) => editor.reorder("back"),
    enabled: hasSelection,
  },
  {
    id: "layer.hide",
    label: "Show / hide",
    group: "Layer",
    keys: ["mod+shift+h"],
    run: ({ editor }) => editor.toggle("hidden"),
    enabled: hasSelection,
  },
  {
    id: "layer.lock",
    label: "Lock / unlock",
    group: "Layer",
    keys: ["mod+shift+l"],
    run: ({ editor }) => editor.toggle("locked"),
    enabled: hasSelection,
  },

  {
    id: "align.left",
    label: "Align left",
    group: "Align",
    keys: ["alt+a"],
    run: ({ editor }) => editor.align("left"),
    enabled: hasSelection,
  },
  {
    id: "align.center",
    label: "Align horizontal centers",
    group: "Align",
    keys: ["alt+h"],
    run: ({ editor }) => editor.align("center"),
    enabled: hasSelection,
  },
  {
    id: "align.right",
    label: "Align right",
    group: "Align",
    keys: ["alt+d"],
    run: ({ editor }) => editor.align("right"),
    enabled: hasSelection,
  },
  {
    id: "align.top",
    label: "Align top",
    group: "Align",
    keys: ["alt+w"],
    run: ({ editor }) => editor.align("top"),
    enabled: hasSelection,
  },
  {
    id: "align.middle",
    label: "Align vertical centers",
    group: "Align",
    keys: ["alt+v"],
    run: ({ editor }) => editor.align("middle"),
    enabled: hasSelection,
  },
  {
    id: "align.bottom",
    label: "Align bottom",
    group: "Align",
    keys: ["alt+s"],
    run: ({ editor }) => editor.align("bottom"),
    enabled: hasSelection,
  },
  {
    id: "align.distribute-h",
    label: "Distribute horizontally",
    group: "Align",
    keys: ["alt+shift+h"],
    run: ({ editor }) => editor.distribute("horizontal"),
    enabled: many(3),
  },
  {
    id: "align.distribute-v",
    label: "Distribute vertically",
    group: "Align",
    keys: ["alt+shift+v"],
    run: ({ editor }) => editor.distribute("vertical"),
    enabled: many(3),
  },

  {
    id: "view.zoom-in",
    label: "Zoom in",
    group: "View",
    keys: ["mod+=", "mod++"],
    run: ({ editor }) => editor.zoomBy(1.25),
  },
  {
    id: "view.zoom-out",
    label: "Zoom out",
    group: "View",
    keys: ["mod+-"],
    run: ({ editor }) => editor.zoomBy(0.8),
  },
  {
    id: "view.zoom-100",
    label: "Zoom to 100%",
    group: "View",
    keys: ["mod+0"],
    run: ({ editor }) => editor.zoomTo(1),
  },
  {
    id: "view.fit",
    label: "Zoom to fit",
    group: "View",
    keys: ["shift+1"],
    run: ({ editor }) => editor.fitAll(),
  },
  {
    id: "view.fit-selection",
    label: "Zoom to selection",
    group: "View",
    keys: ["shift+2"],
    run: ({ editor }) => editor.fitSelection(),
    enabled: hasSelection,
  },
  {
    id: "view.palette",
    label: "Command palette",
    group: "View",
    keys: ["mod+k", "shift+/"],
    run: (ctx) => ctx.openPalette(),
  },
];

export function isMac(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)
  );
}

const DIGITS: Record<string, string> = {
  "1": "Digit1",
  "2": "Digit2",
  "/": "Slash",
};

/** Does a keyboard event match a combo such as "mod+shift+z"? */
export function matchesKeys(
  event: Pick<
    KeyboardEvent,
    "key" | "code" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey"
  >,
  combo: string,
): boolean {
  const parts = combo.split("+");
  // "mod++" ends with an empty token for the "+" key.
  const key = combo.endsWith("++") ? "+" : (parts.pop() as string);
  const mods = new Set(parts.filter(Boolean));
  const mod = event.metaKey || event.ctrlKey;
  if (mods.has("mod") !== mod) return false;
  if (mods.has("alt") !== event.altKey) return false;
  // Shifted punctuation ("+" or "?") already implies shift.
  if (mods.has("shift") !== event.shiftKey && key !== "+") return false;
  const code = DIGITS[key];
  if (code && event.code === code) return true;
  if (event.altKey && /^[a-z]$/.test(key))
    return event.code === `Key${key.toUpperCase()}`;
  const pressed = event.key.toLowerCase();
  if (key === "backspace" || key === "delete") return pressed === key;
  return pressed === key;
}

export function formatKeys(combo: string, mac = isMac()): string {
  const symbol: Record<string, string> = mac
    ? { mod: "⌘", shift: "⇧", alt: "⌥", backspace: "⌫", delete: "⌦" }
    : {
        mod: "Ctrl+",
        shift: "Shift+",
        alt: "Alt+",
        backspace: "Backspace",
        delete: "Del",
      };
  const key = combo.endsWith("++") ? "+" : (combo.split("+").pop() as string);
  const mods = combo.endsWith("++")
    ? combo.slice(0, -2).split("+")
    : combo.split("+").slice(0, -1);
  const order = ["alt", "shift", "mod"];
  const prefix = order
    .filter((m) => mods.includes(m))
    .map((m) => symbol[m])
    .join("");
  const pretty =
    symbol[key] ??
    (key.length === 1
      ? key.toUpperCase()
      : key[0]?.toUpperCase() + key.slice(1));
  return `${prefix}${pretty}`;
}

export function commandById(id: string): Command | undefined {
  return COMMANDS.find((c) => c.id === id);
}

export function findCommand(event: KeyboardEvent): Command | undefined {
  return COMMANDS.find((command) =>
    command.keys?.some((combo) => matchesKeys(event, combo)),
  );
}
