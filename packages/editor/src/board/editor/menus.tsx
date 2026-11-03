import { useEffect, useMemo, useRef, useState } from "react";
import {
  COMMANDS,
  type Command,
  type CommandContext,
  commandById,
  formatKeys,
} from "./commands.ts";

function isEnabled(command: Command, ctx: CommandContext) {
  return command.enabled ? command.enabled(ctx) : true;
}

/**
 * Right-click menu, in the spirit of Onlook's right-click-menu but driven by
 * the shared command registry, so every entry shows its real shortcut and
 * disabled states come from the same predicate the keyboard uses.
 */
export function ContextMenu({
  at,
  ctx,
  onClose,
}: {
  at: { x: number; y: number };
  ctx: CommandContext;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(at);
  const groups = ctx.editor.selection.length
    ? [
        [
          "edit.copy",
          "edit.cut",
          "edit.paste",
          "edit.duplicate",
          "edit.delete",
        ],
        ["edit.copy-style", "edit.paste-style"],
        ["layer.frame", "layer.unframe", "layer.stack", "layer.unstack"],
        ["layer.front", "layer.forward", "layer.backward", "layer.back"],
        ["layer.hide", "layer.lock", "view.fit-selection"],
      ]
    : [
        ["edit.paste", "edit.select-all"],
        ["view.fit", "view.zoom-100", "view.palette"],
      ];
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Keep the menu inside the viewport.
    const r = el.getBoundingClientRect();
    setPos({
      x: Math.min(at.x, window.innerWidth - r.width - 8),
      y: Math.min(at.y, window.innerHeight - r.height - 8),
    });
    el.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const close = (event: Event) => {
      if (!el.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("blur", onClose);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", onClose);
    };
  }, [at, onClose]);
  return (
    <div
      ref={ref}
      className="bx-context"
      role="menu"
      aria-label="Layer actions"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        const buttons = [
          ...(ref.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) ?? []),
        ];
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (event.key === "Escape") onClose();
        if (event.key === "ArrowDown") {
          event.preventDefault();
          buttons[(i + 1) % buttons.length]?.focus();
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          buttons[(i - 1 + buttons.length) % buttons.length]?.focus();
        }
        event.stopPropagation();
      }}
    >
      {groups.map((group, gi) => (
        <div key={group.join()} className="bx-context-group">
          {gi > 0 ? <hr /> : null}
          {group.map((id) => {
            const command = commandById(id);
            if (!command) return null;
            return (
              <button
                key={id}
                type="button"
                role="menuitem"
                className="bx-menu-item"
                disabled={!isEnabled(command, ctx)}
                onClick={() => {
                  onClose();
                  command.run(ctx);
                }}
              >
                <span>{command.label}</span>
                {command.keys?.[0] ? (
                  <kbd>{formatKeys(command.keys[0])}</kbd>
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** ⌘K command palette (Framer-style quick actions) over the same registry. */
export function CommandPalette({
  ctx,
  onClose,
}: {
  ctx: CommandContext;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const seen = new Set<string>();
    return COMMANDS.filter((c) => {
      if (seen.has(c.label)) return false;
      seen.add(c.label);
      return !q || `${c.group} ${c.label}`.toLowerCase().includes(q);
    });
  }, [query]);
  useEffect(() => setActive(0), []);
  const run = (command: Command | undefined) => {
    if (!command || !isEnabled(command, ctx)) return;
    onClose();
    // Let the palette unmount before commands that move focus run.
    window.requestAnimationFrame(() => command.run(ctx));
  };
  return (
    <div className="bx-palette-backdrop" onPointerDown={onClose}>
      <div
        className="bx-palette"
        role="dialog"
        aria-label="Command palette"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <input
          // biome-ignore lint/a11y/noAutofocus: palette opens on an explicit shortcut
          autoFocus
          className="bx-palette-input"
          placeholder="Search commands…"
          aria-label="Search commands"
          aria-controls="bx-palette-list"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") onClose();
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const next = Math.max(
                0,
                Math.min(
                  results.length - 1,
                  active + (event.key === "ArrowDown" ? 1 : -1),
                ),
              );
              setActive(next);
              list.current?.children[next]?.scrollIntoView({
                block: "nearest",
              });
            }
            if (event.key === "Enter") run(results[active]);
          }}
        />
        <div
          ref={list}
          id="bx-palette-list"
          className="bx-palette-list"
          role="listbox"
          aria-label="Commands"
        >
          {results.map((command, index) => {
            const enabled = isEnabled(command, ctx);
            return (
              <div
                key={command.id}
                role="option"
                tabIndex={-1}
                aria-selected={index === active}
                aria-disabled={!enabled}
                className={
                  index === active
                    ? "bx-palette-item active"
                    : "bx-palette-item"
                }
                onPointerEnter={() => setActive(index)}
                onClick={() => run(command)}
                onKeyDown={() => undefined}
              >
                <span className="bx-palette-group">{command.group}</span>
                <span className="bx-palette-label">{command.label}</span>
                {command.keys?.[0] ? (
                  <kbd>{formatKeys(command.keys[0])}</kbd>
                ) : null}
              </div>
            );
          })}
          {results.length === 0 ? (
            <p className="bx-hint">No commands match.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
