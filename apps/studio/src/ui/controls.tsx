import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export type MenuEntry = MenuItem | "separator";

function labelBefore(items: MenuEntry[], index: number): string {
  const item = items[index - 1];
  return item && item !== "separator" ? item.label : String(index);
}

/** Accessible popover menu: arrow keys move, Escape closes, focus returns. */
export function Menu({
  label,
  trigger,
  items,
  align = "end",
  className = "icon-button",
}: {
  label: string;
  trigger: ReactNode;
  items: MenuEntry[];
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  }, []);
  useEffect(() => {
    if (!open) return;
    list.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !list.current?.contains(target) &&
        !button.current?.contains(target)
      ) {
        close(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, close]);
  const onKeyDown = (event: React.KeyboardEvent) => {
    const buttons = [
      ...(list.current?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      ) ?? []),
    ];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      buttons[(index + 1) % buttons.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
    } else if (event.key === "Tab") {
      close(false);
    }
  };
  return (
    <div className="menu-anchor">
      <button
        ref={button}
        type="button"
        className={className}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        {trigger}
      </button>
      {open ? (
        <div
          ref={list}
          id={id}
          role="menu"
          tabIndex={-1}
          aria-label={label}
          className={`menu menu-${align}`}
          onKeyDown={onKeyDown}
          onClick={(event) => event.stopPropagation()}
        >
          {items.map((item, index) =>
            item === "separator" ? (
              <hr
                key={`sep-after-${labelBefore(items, index)}`}
                className="menu-separator"
              />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={item.danger ? "menu-item danger" : "menu-item"}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
              >
                {item.icon ? (
                  <span className="menu-icon">{item.icon}</span>
                ) : null}
                <span className="menu-label">{item.label}</span>
                {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Small modal used for rename/new-file prompts. */
export function PromptDialog({
  title,
  label,
  initial,
  confirm,
  onSubmit,
  onCancel,
}: {
  title: string;
  label: string;
  initial: string;
  confirm: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  return (
    <div className="dialog-backdrop">
      <form
        className="dialog"
        aria-label={title}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) onSubmit(value.trim());
        }}
      >
        <h2>{title}</h2>
        <label className="field">
          <span>{label}</span>
          <input
            ref={input}
            value={value}
            maxLength={200}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <div className="dialog-actions">
          <button type="button" className="button ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={!value.trim()}
          >
            {confirm}
          </button>
        </div>
      </form>
    </div>
  );
}

interface Toast {
  id: number;
  text: string;
  tone: "info" | "error";
}

const ToastContext = createContext<
  (text: string, tone?: Toast["tone"]) => void
>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);
  const push = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = ++next.current;
    setToasts((items) => [...items.slice(-2), { id, text, tone }]);
    window.setTimeout(
      () => setToasts((items) => items.filter((item) => item.id !== id)),
      tone === "error" ? 6000 : 3200,
    );
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((toast) => (
          <output key={toast.id} className={`toast ${toast.tone}`}>
            {toast.text}
          </output>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/** Save text as a local download (export never uploads anything). */
export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(name: string): string {
  return (
    name
      .replace(/[^\w\s.-]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || "board"
  );
}
