import { type BoardNode, isBoardColor } from "@allstudio/project";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  addPage,
  duplicatePage,
  insertNodes,
  locate,
  tidyFrames,
} from "../model.ts";
import { pageBounds } from "../render.tsx";
import { FONT_CHOICES, frameNode } from "../templates.ts";
import { I } from "./icons.tsx";
import type { BoardEditorState } from "./use-board-editor.ts";

type Mixed = typeof MIXED;
const MIXED = Symbol("mixed");

function common<T>(
  nodes: BoardNode[],
  read: (node: BoardNode) => T,
): T | Mixed | undefined {
  if (nodes.length === 0) return undefined;
  const first = read(nodes[0] as BoardNode);
  return nodes.every((node) => Object.is(read(node), first)) ? first : MIXED;
}

/**
 * Number input with label scrubbing (drag the label), arrow-key steps and
 * commit on Enter/blur. Scrubbing is one undo step.
 */
export function NumberField({
  label,
  value,
  onChange,
  onCommitGesture,
  min,
  max,
  step = 1,
  suffix,
  disabled,
}: {
  label: string;
  value: number | Mixed | undefined;
  onChange: (value: number, transient: boolean) => void;
  onCommitGesture: () => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
}) {
  const shown =
    value === MIXED || value === undefined
      ? ""
      : String(Math.round(value * 100) / 100);
  const [draft, setDraft] = useState(shown);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(shown);
  }, [shown]);
  const clamp = (v: number) =>
    Math.min(
      max ?? Number.POSITIVE_INFINITY,
      Math.max(min ?? Number.NEGATIVE_INFINITY, v),
    );
  const commit = () => {
    const parsed = Number.parseFloat(draft);
    if (Number.isFinite(parsed) && String(parsed) !== shown)
      onChange(clamp(parsed), false);
    else setDraft(shown);
  };
  const scrub = useRef<{ x: number; start: number } | null>(null);
  return (
    <label className={disabled ? "bx-num disabled" : "bx-num"}>
      <span
        className="bx-num-label"
        onPointerDown={(event) => {
          if (disabled || value === MIXED || value === undefined) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          scrub.current = { x: event.clientX, start: value };
        }}
        onPointerMove={(event) => {
          if (!scrub.current) return;
          const delta =
            Math.round((event.clientX - scrub.current.x) / 2) *
            step *
            (event.shiftKey ? 10 : 1);
          onChange(clamp(scrub.current.start + delta), true);
        }}
        onPointerUp={() => {
          if (scrub.current) onCommitGesture();
          scrub.current = null;
        }}
      >
        {label}
      </span>
      <input
        inputMode="decimal"
        aria-label={label}
        value={draft}
        placeholder={value === MIXED ? "Mixed" : ""}
        disabled={disabled}
        onFocus={(event) => {
          focused.current = true;
          event.currentTarget.select();
        }}
        onBlur={() => {
          focused.current = false;
          commit();
        }}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(shown);
            event.currentTarget.blur();
          }
          if (
            (event.key === "ArrowUp" || event.key === "ArrowDown") &&
            value !== MIXED &&
            value !== undefined
          ) {
            event.preventDefault();
            const next = clamp(
              value +
                (event.key === "ArrowUp" ? 1 : -1) *
                  step *
                  (event.shiftKey ? 10 : 1),
            );
            onChange(next, false);
            setDraft(String(Math.round(next * 100) / 100));
          }
        }}
      />
      {suffix ? <span className="bx-num-suffix">{suffix}</span> : null}
    </label>
  );
}

function toHex6(color: string): string {
  const m = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})/i)?.[1];
  if (!m) return "#000000";
  return `#${m.length === 3 ? [...m].map((c) => c + c).join("") : m}`.toLowerCase();
}

export function ColorField({
  label,
  value,
  onChange,
  onRemove,
}: {
  label: string;
  value: string | Mixed | null | undefined;
  onChange: (value: string) => void;
  onRemove?: () => void;
}) {
  const text = typeof value === "string" ? value : "";
  const [draft, setDraft] = useState(text);
  useEffect(() => setDraft(text), [text]);
  return (
    <div className="bx-color">
      <span
        className="bx-color-swatch"
        style={{
          background: typeof value === "string" ? value : "transparent",
        }}
      >
        <input
          type="color"
          aria-label={`${label} picker`}
          value={typeof value === "string" ? toHex6(value) : "#000000"}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
      <input
        className="bx-color-text"
        aria-label={label}
        value={draft}
        placeholder={value === MIXED ? "Mixed" : "None"}
        spellCheck={false}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const next = draft.trim();
          if (isBoardColor(next) && next !== text) onChange(next);
          else setDraft(text);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      {onRemove ? (
        <button
          type="button"
          className="bx-icon"
          aria-label={`Remove ${label.toLowerCase()}`}
          onClick={onRemove}
        >
          <I.Trash size={13} />
        </button>
      ) : null}
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bx-insp-section" aria-label={title}>
      <header>
        <h3>{title}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}

const FRAME_PRESETS = [
  { label: "Desktop", width: 1440, height: 900 },
  { label: "Laptop", width: 1280, height: 800 },
  { label: "Tablet", width: 768, height: 1024 },
  { label: "Mobile", width: 390, height: 844 },
];

const WEIGHTS = [300, 400, 500, 600, 700, 800, 900];

export function StyleInspector({ editor }: { editor: BoardEditorState }) {
  const { page, selection } = editor;
  const nodes = selection
    .map((id) => locate(page, id)?.node)
    .filter((n): n is BoardNode => !!n);
  const patch = (values: Record<string, unknown>, transient = false) =>
    editor.patchSelection(values, transient);
  const num = (key: keyof BoardNode | string) =>
    common(
      nodes,
      (n) => (n as unknown as Record<string, number | undefined>)[key],
    );
  const field = (
    label: string,
    key: string,
    opts: {
      min?: number;
      max?: number;
      step?: number;
      suffix?: string;
      fallback?: number;
    } = {},
  ) => {
    const value = num(key);
    return (
      <NumberField
        label={label}
        value={
          value === undefined && nodes.length
            ? (opts.fallback ?? 0)
            : (value as number | Mixed | undefined)
        }
        min={opts.min}
        max={opts.max}
        step={opts.step}
        suffix={opts.suffix}
        onChange={(v, transient) => patch({ [key]: v }, transient)}
        onCommitGesture={editor.commitGesture}
      />
    );
  };

  if (nodes.length === 0) {
    const bounds = pageBounds(page);
    return (
      <div className="bx-inspector">
        <Section title="Page">
          <ColorField
            label="Page background"
            value={page.background === "transparent" ? null : page.background}
            onChange={(background) =>
              editor.apply((p) => ({ ...p, background }))
            }
            onRemove={
              page.background !== "transparent"
                ? () =>
                    editor.apply((p) => ({ ...p, background: "transparent" }))
                : undefined
            }
          />
          <p className="bx-hint">
            {page.nodes.length} top-level layer
            {page.nodes.length === 1 ? "" : "s"}
            {bounds
              ? ` · ${Math.round(bounds.width)} × ${Math.round(bounds.height)}`
              : ""}
          </p>
        </Section>
        <Section title="Add frame">
          <div className="bx-presets">
            {FRAME_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="bx-preset"
                onClick={() => {
                  const b = pageBounds(page);
                  editor.insertAt(
                    frameNode({
                      name: preset.label,
                      x: b ? b.x + b.width + 120 : 0,
                      y: b ? b.y : 0,
                      width: preset.width,
                      height: preset.height,
                    }),
                    { parentId: null },
                  );
                  window.requestAnimationFrame(() => editor.fitAll());
                }}
              >
                <strong>{preset.label}</strong>
                <span>
                  {preset.width} × {preset.height}
                </span>
              </button>
            ))}
          </div>
        </Section>
        <p className="bx-hint pad">Select a layer to edit its style.</p>
      </div>
    );
  }

  const single = nodes.length === 1 ? nodes[0] : null;
  const allText = nodes.every((n) => n.type === "text");
  const anyShape = nodes.some((n) => n.type !== "text");
  const texts = nodes.filter(
    (n): n is Extract<BoardNode, { type: "text" }> => n.type === "text",
  );
  const fill = common(nodes, (n) => n.fill ?? null);
  const gradient = common(nodes, (n) =>
    n.gradient ? n.gradient.join("|") : null,
  );
  const stroke = common(nodes, (n) =>
    n.stroke ? `${n.stroke.color}|${n.stroke.width}` : null,
  );
  const shadow = common(nodes, (n) =>
    n.shadow ? JSON.stringify(n.shadow) : null,
  );
  const firstGradient = nodes[0]?.gradient;
  const firstStroke = nodes[0]?.stroke;
  const firstShadow = nodes[0]?.shadow;

  return (
    <div className="bx-inspector">
      <div className="bx-insp-title">
        <strong>{single ? single.name : `${nodes.length} layers`}</strong>
        <span>{single ? single.type : "mixed"}</span>
      </div>

      <div className="bx-align" role="toolbar" aria-label="Align">
        {(
          [
            ["left", I.AlignLeft, "Align left"],
            ["center", I.AlignCenter, "Align horizontal centers"],
            ["right", I.AlignRight, "Align right"],
            ["top", I.AlignTop, "Align top"],
            ["middle", I.AlignMiddle, "Align vertical centers"],
            ["bottom", I.AlignBottom, "Align bottom"],
          ] as const
        ).map(([key, Icon, label]) => (
          <button
            key={key}
            type="button"
            className="bx-icon"
            aria-label={label}
            title={label}
            onClick={() => editor.align(key)}
          >
            <Icon />
          </button>
        ))}
      </div>

      <Section title="Position">
        <div className="bx-grid2">
          {field("X", "x")}
          {field("Y", "y")}
          {field("W", "width", { min: 1 })}
          {field("H", "height", { min: 1 })}
          {field("Rotate", "rotation", { min: -360, max: 360, suffix: "°" })}
          {anyShape
            ? field("Radius", "radius", { min: 0 })
            : field("Opacity", "opacity", {
                min: 0,
                max: 1,
                step: 0.05,
                fallback: 1,
              })}
        </div>
        {anyShape ? (
          <div className="bx-grid2">
            {field("Opacity", "opacity", {
              min: 0,
              max: 1,
              step: 0.05,
              fallback: 1,
            })}
          </div>
        ) : null}
      </Section>

      {single?.type === "frame" ? (
        <Section title="Frame">
          <label className="bx-check">
            <input
              type="checkbox"
              checked={single.clip !== false}
              onChange={(event) => patch({ clip: event.target.checked })}
            />
            Clip content
          </label>
          <select
            className="bx-select"
            aria-label="Frame size preset"
            value=""
            onChange={(event) => {
              const preset = FRAME_PRESETS.find(
                (p) => p.label === event.target.value,
              );
              if (preset) patch({ width: preset.width, height: preset.height });
            }}
          >
            <option value="" disabled>
              Resize to preset…
            </option>
            {FRAME_PRESETS.map((p) => (
              <option key={p.label} value={p.label}>
                {p.label} — {p.width} × {p.height}
              </option>
            ))}
          </select>
        </Section>
      ) : null}

      {allText ? (
        <Section title="Text">
          <select
            className="bx-select"
            aria-label="Font family"
            value={
              (common(
                texts,
                (n) => (n as { fontFamily: string }).fontFamily,
              ) as string) ?? ""
            }
            onChange={(event) => patch({ fontFamily: event.target.value })}
          >
            {common(texts, (n) => (n as { fontFamily: string }).fontFamily) ===
            MIXED ? (
              <option value="">Mixed</option>
            ) : null}
            {FONT_CHOICES.map((font) => (
              <option key={font.label} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>
          <div className="bx-grid2">
            {field("Size", "fontSize", { min: 1, max: 2000 })}
            <label className="bx-num">
              <span className="bx-num-label">Weight</span>
              <select
                aria-label="Font weight"
                value={String(
                  common(
                    texts,
                    (n) => (n as { fontWeight: number }).fontWeight,
                  ) === MIXED
                    ? ""
                    : (texts[0]?.fontWeight ?? 400),
                )}
                onChange={(event) =>
                  patch({ fontWeight: Number(event.target.value) })
                }
              >
                {WEIGHTS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </label>
            {field("Line", "lineHeight", { min: 0.5, max: 5, step: 0.05 })}
            {field("Letter", "letterSpacing", {
              min: -50,
              max: 200,
              step: 0.1,
            })}
          </div>
          {/* biome-ignore lint/a11y/useSemanticElements: compact toggle group */}
          <div className="bx-segmented" role="group" aria-label="Text align">
            {(["left", "center", "right"] as const).map((align) => (
              <button
                key={align}
                type="button"
                aria-pressed={
                  common(
                    texts,
                    (n) => (n as { textAlign: string }).textAlign,
                  ) === align
                }
                onClick={() => patch({ textAlign: align })}
              >
                {align === "left" ? (
                  <I.AlignLeft />
                ) : align === "center" ? (
                  <I.AlignCenter />
                ) : (
                  <I.AlignRight />
                )}
              </button>
            ))}
          </div>
          <ColorField
            label="Text color"
            value={
              common(texts, (n) => (n as { color: string }).color) as
                | string
                | Mixed
            }
            onChange={(color) => patch({ color })}
          />
        </Section>
      ) : null}

      {single?.type === "image" ? (
        <Section title="Image">
          <select
            className="bx-select"
            aria-label="Image fit"
            value={single.fit}
            onChange={(event) => patch({ fit: event.target.value })}
          >
            <option value="cover">Fill (cover)</option>
            <option value="contain">Fit (contain)</option>
            <option value="fill">Stretch</option>
          </select>
          <label className="button-like">
            Replace image…
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void editor.replaceImage(file);
                event.target.value = "";
              }}
            />
          </label>
        </Section>
      ) : null}

      <Section
        title="Fill"
        action={
          fill === null && gradient === null ? (
            <button
              type="button"
              className="bx-icon"
              aria-label="Add fill"
              onClick={() => patch({ fill: "#d9d9d9" })}
            >
              <I.Plus />
            </button>
          ) : null
        }
      >
        {gradient !== null && gradient !== MIXED && firstGradient ? (
          <>
            <div className="bx-grid2">
              <NumberField
                label="Angle"
                value={firstGradient[0]}
                suffix="°"
                min={-360}
                max={360}
                onChange={(v, transient) =>
                  patch(
                    { gradient: [v, firstGradient[1], firstGradient[2]] },
                    transient,
                  )
                }
                onCommitGesture={editor.commitGesture}
              />
            </div>
            <ColorField
              label="Gradient start"
              value={firstGradient[1]}
              onChange={(c) =>
                patch({ gradient: [firstGradient[0], c, firstGradient[2]] })
              }
            />
            <ColorField
              label="Gradient end"
              value={firstGradient[2]}
              onChange={(c) =>
                patch({ gradient: [firstGradient[0], firstGradient[1], c] })
              }
              onRemove={() => patch({ gradient: null, fill: firstGradient[1] })}
            />
          </>
        ) : fill !== null ? (
          <>
            <ColorField
              label="Fill color"
              value={fill}
              onChange={(c) => patch({ fill: c })}
              onRemove={() => patch({ fill: null })}
            />
            {anyShape && typeof fill === "string" ? (
              <button
                type="button"
                className="bx-link"
                onClick={() => patch({ gradient: [135, fill, "#3d7bff"] })}
              >
                Use gradient
              </button>
            ) : null}
          </>
        ) : (
          <p className="bx-hint">No fill</p>
        )}
      </Section>

      <Section
        title="Stroke"
        action={
          stroke === null ? (
            <button
              type="button"
              className="bx-icon"
              aria-label="Add stroke"
              onClick={() => patch({ stroke: { color: "#111111", width: 1 } })}
            >
              <I.Plus />
            </button>
          ) : null
        }
      >
        {stroke !== null && stroke !== MIXED && firstStroke ? (
          <>
            <ColorField
              label="Stroke color"
              value={firstStroke.color}
              onChange={(color) => patch({ stroke: { ...firstStroke, color } })}
              onRemove={() => patch({ stroke: null })}
            />
            <div className="bx-grid2">
              <NumberField
                label="Width"
                value={firstStroke.width}
                min={0}
                max={1000}
                onChange={(width, transient) =>
                  patch({ stroke: { ...firstStroke, width } }, transient)
                }
                onCommitGesture={editor.commitGesture}
              />
            </div>
          </>
        ) : stroke === MIXED ? (
          <p className="bx-hint">Mixed</p>
        ) : null}
      </Section>

      <Section
        title="Shadow"
        action={
          shadow === null ? (
            <button
              type="button"
              className="bx-icon"
              aria-label="Add shadow"
              onClick={() =>
                patch({
                  shadow: { color: "rgba(0,0,0,0.25)", x: 0, y: 8, blur: 24 },
                })
              }
            >
              <I.Plus />
            </button>
          ) : null
        }
      >
        {shadow !== null && shadow !== MIXED && firstShadow ? (
          <>
            <ColorField
              label="Shadow color"
              value={firstShadow.color}
              onChange={(color) => patch({ shadow: { ...firstShadow, color } })}
              onRemove={() => patch({ shadow: null })}
            />
            <div className="bx-grid3">
              {(["x", "y", "blur"] as const).map((key) => (
                <NumberField
                  key={key}
                  label={key.toUpperCase()}
                  value={firstShadow[key]}
                  min={key === "blur" ? 0 : -1000}
                  max={1000}
                  onChange={(v, transient) =>
                    patch({ shadow: { ...firstShadow, [key]: v } }, transient)
                  }
                  onCommitGesture={editor.commitGesture}
                />
              ))}
            </div>
          </>
        ) : null}
      </Section>

      <div className="bx-insp-actions">
        <button
          type="button"
          className="bx-btn"
          onClick={editor.duplicateSelection}
        >
          <I.Copy size={14} /> Duplicate
        </button>
        <button
          type="button"
          className="bx-btn danger"
          onClick={editor.deleteSelection}
        >
          <I.Trash size={14} /> Delete
        </button>
      </div>
    </div>
  );
}

/**
 * Local AI is not part of this slice (Phase 5: BYOK). The Agent tab is
 * honest about that and offers deterministic local actions instead.
 */
export function AgentPanel({ editor }: { editor: BoardEditorState }) {
  const actions: { label: string; run: () => void }[] = [
    {
      label: "Add a page",
      run: () => {
        const result = addPage(editor.doc);
        editor.applyDoc(result.doc);
        editor.switchPage(result.id);
      },
    },
    {
      label: "Duplicate this page",
      run: () => {
        const result = duplicatePage(editor.doc, editor.pageId);
        if (result) {
          editor.applyDoc(result.doc);
          editor.switchPage(result.id);
        }
      },
    },
    {
      label: "Tidy up frames",
      run: () => {
        editor.apply((p) => tidyFrames(p));
        window.requestAnimationFrame(() => editor.fitAll());
      },
    },
    {
      label: "Add mobile + desktop frames",
      run: () => {
        const b = pageBounds(editor.page);
        const x = b ? b.x + b.width + 120 : 0;
        const y = b ? b.y : 0;
        const desktop = frameNode({
          name: "Desktop",
          x,
          y,
          width: 1440,
          height: 900,
        });
        const mobile = frameNode({
          name: "Mobile",
          x: x + 1560,
          y,
          width: 390,
          height: 844,
        });
        editor.apply((p) => insertNodes(p, [desktop, mobile], null), {
          select: [desktop.id, mobile.id],
        });
        window.requestAnimationFrame(() => editor.fitAll());
      },
    },
  ];
  return (
    <div className="bx-agent">
      <div className="bx-agent-empty">
        <I.Sparkle size={22} />
        <strong>Agent isn&apos;t connected</strong>
        <p>
          Local AI with your own provider key is planned for a later phase.
          Nothing you type here is sent anywhere.
        </p>
      </div>
      <div className="bx-agent-chips">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className="bx-chip"
            onClick={action.run}
          >
            {action.label}
          </button>
        ))}
      </div>
      <div className="bx-composer" aria-disabled="true">
        <textarea
          placeholder="Ask the agent… (not connected)"
          disabled
          aria-label="Agent prompt (not connected)"
        />
        <div className="bx-composer-bar">
          <span>No model</span>
          <button type="button" className="bx-icon" disabled aria-label="Send">
            <I.Send />
          </button>
        </div>
      </div>
    </div>
  );
}
