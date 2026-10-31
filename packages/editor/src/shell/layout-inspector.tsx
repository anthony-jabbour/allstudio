import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PreviewLayout } from "../preview-bridge/protocol.ts";
import type { EditBreakpoint } from "../site/class-tokens.ts";
import {
  clearLayoutClass,
  inspectLayoutClasses,
  inspectLayoutConstraints,
  LAYOUT_PRESETS,
  LAYOUT_PROPERTIES,
  type LayoutConstraints,
  type LayoutProperty,
  type LayoutSetting,
  MAX_SIZE_PX,
  MIN_SIZE_PX,
  setLayoutClass,
} from "../site/layout.ts";
import { LAYOUT_MEASURED_KEYS } from "./layout-confirmation.ts";

const LABELS: Record<LayoutProperty, string> = {
  display: "Display",
  flexDirection: "Flex direction",
  justifyContent: "Justify content",
  alignItems: "Align items",
  gridColumns: "Grid columns",
  gridRows: "Grid rows",
  width: "Width",
  height: "Height",
};

function supportsCustomPx(property: LayoutProperty): boolean {
  return property === "width" || property === "height";
}

function sourceMode(
  property: LayoutProperty,
  setting: LayoutSetting,
): { mode: string; raw: string } {
  if (setting.state !== "value") return { mode: "", raw: "" };
  if (LAYOUT_PRESETS[property].includes(setting.value))
    return { mode: setting.value, raw: "" };
  if (supportsCustomPx(property)) {
    const px = /^[wh]-\[([\d.]+)px\]$/.exec(setting.value);
    if (px?.[1]) return { mode: "custom:px", raw: px[1] };
  }
  return { mode: setting.value, raw: "" };
}

function utilityFor(property: LayoutProperty, raw: string): string {
  const prefix = property === "width" ? "w" : "h";
  return `${prefix}-[${raw}px]`;
}

function presetLabel(property: LayoutProperty, value: string): string {
  if (property === "display") return value;
  if (property === "flexDirection") return value.slice(5);
  if (property === "justifyContent") return value.slice(8);
  if (property === "alignItems") return value.slice(6);
  if (property === "gridColumns" || property === "gridRows")
    return value.slice(10);
  return value.slice(2);
}

function inactiveAxisMessage(
  property: LayoutProperty,
  display: string | null | undefined,
): string | null {
  if (!display) return null;
  if (
    property === "flexDirection" &&
    display !== "flex" &&
    display !== "inline-flex"
  ) {
    return `Flex direction is inactive for rendered display ${display}; a source edit may remain visually unconfirmed.`;
  }
  if (
    (property === "justifyContent" || property === "alignItems") &&
    !["flex", "inline-flex", "grid", "inline-grid"].includes(display)
  ) {
    return `${LABELS[property]} is inactive for rendered display ${display}; a source edit may remain visually unconfirmed.`;
  }
  if (
    (property === "gridColumns" || property === "gridRows") &&
    display !== "grid" &&
    display !== "inline-grid"
  ) {
    return `${LABELS[property]} is inactive for rendered display ${display}; a source edit may remain visually unconfirmed.`;
  }
  if (
    (property === "width" || property === "height") &&
    ["inline", "contents", "none"].includes(display)
  ) {
    return `${LABELS[property]} is inactive for rendered display ${display}; a source edit may remain visually unconfirmed.`;
  }
  return null;
}

function hasRenderedMin(value: string | null | undefined): boolean {
  return Boolean(
    value && value !== "0px" && value !== "auto" && value !== "none",
  );
}

function hasRenderedMax(value: string | null | undefined): boolean {
  return Boolean(value && value !== "none" && value !== "auto");
}

function constraintMessage(
  property: LayoutProperty,
  constraints: LayoutConstraints,
  rendered: PreviewLayout | null,
): string | null {
  if (property !== "width" && property !== "height") return null;
  const tokens = constraints[property];
  const min = property === "width" ? rendered?.minWidth : rendered?.minHeight;
  const max = property === "width" ? rendered?.maxWidth : rendered?.maxHeight;
  if (!tokens.length && !hasRenderedMin(min) && !hasRenderedMax(max)) {
    return null;
  }
  const details = [
    tokens.length ? `source ${tokens.join(", ")}` : null,
    hasRenderedMin(min) ? `min ${min}` : null,
    hasRenderedMax(max) ? `max ${max}` : null,
  ]
    .filter((item) => item !== null)
    .join(" · ");
  return `Min/max or parent constraints (${details}) are preserved and may keep a ${property} edit visually unconfirmed.`;
}

interface Props {
  scope?: EditBreakpoint;
  className: string;
  rendered: PreviewLayout | null;
  disabled: boolean;
  sourceKnown: boolean;
  applyDisabled?: boolean;
  onChange(value: string): void;
  onPreview(): void;
  onApply(): void;
  onValidityChange(valid: boolean): void;
}

interface FieldProps
  extends Pick<
    Props,
    "className" | "rendered" | "disabled" | "sourceKnown" | "onChange" | "scope"
  > {
  property: LayoutProperty;
  setting: LayoutSetting;
  constraints: LayoutConstraints;
  onValidity(property: LayoutProperty, valid: boolean): void;
}

function LayoutField({
  scope = "base",
  property,
  setting,
  constraints,
  className,
  rendered,
  disabled,
  sourceKnown,
  onChange,
  onValidity,
}: FieldProps) {
  const initial = sourceMode(property, setting);
  const emitted = useRef<string | null>(null);
  const base = useRef(className);
  const [mode, setMode] = useState(initial.mode);
  const [raw, setRaw] = useState(initial.raw);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const own = emitted.current === `${initial.mode}|${initial.raw}`;
    emitted.current = null;
    if (own) return;
    setMode(initial.mode);
    setRaw(initial.raw);
    setError(null);
    onValidity(property, true);
  }, [property, initial.mode, initial.raw, onValidity]);
  const label = LABELS[property];
  const presets = LAYOUT_PRESETS[property];
  const measuredKey = LAYOUT_MEASURED_KEYS[property];
  const measured = rendered?.[measuredKey] ?? null;
  const unavailable =
    setting.state === "unsupported" || setting.state === "ambiguous";
  const locked = disabled || unavailable || !measured || !rendered?.display;
  const change = (utility: string, source = className) => {
    const result = setLayoutClass(source, property, utility, scope);
    if (!result.ok) {
      setError(result.message);
      onValidity(property, false);
      return;
    }
    const next = sourceMode(
      property,
      inspectLayoutClasses(result.className, scope)[property],
    );
    emitted.current = `${next.mode}|${next.raw}`;
    setError(null);
    onValidity(property, true);
    onChange(result.className);
  };
  const hasExisting =
    setting.state === "value" &&
    !presets.includes(setting.value) &&
    !initial.mode.startsWith("custom:");
  const inactiveNote = inactiveAxisMessage(property, rendered?.display);
  const constraintNote = constraintMessage(property, constraints, rendered);
  return (
    <div className="typography-field">
      <label>
        {label} preset
        <select
          aria-label={`${label} preset`}
          value={mode}
          disabled={locked}
          onChange={(event) => {
            const value = event.target.value;
            setMode(value);
            if (value === "custom:px") {
              setRaw("");
              setError("Enter a value before applying.");
              onValidity(property, false);
            } else change(value);
          }}
        >
          <option value="" disabled>
            {!sourceKnown
              ? "Source unavailable"
              : setting.state === "unsupported"
                ? "Unsupported source"
                : setting.state === "ambiguous"
                  ? "Conflicting utilities"
                  : `No ${scope} utility`}
          </option>
          {hasExisting && setting.state === "value" ? (
            <option value={setting.value}>Current project setting</option>
          ) : null}
          {presets.map((value) => (
            <option key={value} value={value}>
              {presetLabel(property, value)}
            </option>
          ))}
          {supportsCustomPx(property) ? (
            <option value="custom:px">Custom px</option>
          ) : null}
        </select>
      </label>
      {supportsCustomPx(property) && mode === "custom:px" ? (
        <label>
          {label} px
          <input
            aria-label={`${label} px`}
            type="number"
            step="any"
            min={MIN_SIZE_PX}
            max={MAX_SIZE_PX}
            value={raw}
            disabled={locked}
            placeholder="New explicit value"
            onFocus={() => {
              base.current = className;
            }}
            onChange={(event) => {
              setRaw(event.target.value);
              change(utilityFor(property, event.target.value), base.current);
            }}
          />
        </label>
      ) : null}
      {scope !== "base" ? (
        <button
          type="button"
          aria-label={`Clear ${label} override`}
          disabled={locked || !sourceKnown || setting.state === "unset"}
          onClick={() => {
            const result = clearLayoutClass(className, property, scope);
            if (!result.ok) {
              setError(result.message);
              onValidity(property, false);
              return;
            }
            setError(null);
            onValidity(property, true);
            onChange(result.className);
          }}
        >
          Clear override
        </button>
      ) : null}
      <p className="field-note">
        Source draft:{" "}
        {sourceKnown ? (
          setting.state === "value" ? (
            <code>{setting.utility}</code>
          ) : setting.state === "unset" ? (
            `No ${scope} utility; origin may be elsewhere`
          ) : (
            setting.message
          )
        ) : (
          "Unavailable"
        )}
      </p>
      <p className="field-note">
        Rendered:{" "}
        <span data-testid={`rendered-${property}`}>
          {measured ?? "Unavailable"}
        </span>
      </p>
      {inactiveNote ? <p className="field-note">{inactiveNote}</p> : null}
      {constraintNote ? (
        <p className="field-note" data-testid={`constraint-${property}`}>
          {constraintNote}
        </p>
      ) : null}
      {error ? (
        <p className="field-note status-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function LayoutInspector({
  scope = "base",
  className,
  rendered,
  disabled,
  sourceKnown,
  applyDisabled,
  onChange,
  onPreview,
  onApply,
  onValidityChange,
}: Props) {
  const settings = useMemo(
    () => inspectLayoutClasses(className, scope),
    [className, scope],
  );
  const constraints = useMemo(
    () => inspectLayoutConstraints(className),
    [className],
  );
  const [invalid, setInvalid] = useState<Set<LayoutProperty>>(() => new Set());
  const validity = useCallback(
    (property: LayoutProperty, valid: boolean) =>
      setInvalid((previous) => {
        if (previous.has(property) === !valid) return previous;
        const next = new Set(previous);
        if (valid) next.delete(property);
        else next.add(property);
        return next;
      }),
    [],
  );
  useEffect(
    () => onValidityChange(invalid.size === 0),
    [invalid.size, onValidityChange],
  );
  return (
    <details className="layout-inspector" open>
      <summary>
        Layout{" "}
        <span className="field-note">{scope === "base" ? "Base" : scope}</span>
      </summary>
      <section aria-label="Layout">
        <p className="field-note">
          Display, flex/grid axes and base width/height. Min/max constraints and
          responsive/state rules are preserved; source changes stay in the draft
          until Apply.
        </p>
        {LAYOUT_PROPERTIES.map((property) => (
          <LayoutField
            scope={scope}
            key={property}
            property={property}
            setting={settings[property]}
            constraints={constraints}
            className={className}
            rendered={rendered}
            disabled={disabled}
            sourceKnown={sourceKnown}
            onChange={onChange}
            onValidity={validity}
          />
        ))}
        <div className="actions">
          <button
            type="button"
            disabled={disabled || applyDisabled || invalid.size > 0}
            onClick={onPreview}
          >
            Preview layout patch
          </button>
          <button
            type="button"
            disabled={disabled || applyDisabled || invalid.size > 0}
            onClick={onApply}
          >
            Apply layout
          </button>
        </div>
      </section>
    </details>
  );
}
