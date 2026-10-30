import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PreviewTypography } from "../preview-bridge/protocol.ts";
import {
  inspectTypographyClasses,
  setTypographyClass,
  TYPOGRAPHY_PRESETS,
  TYPOGRAPHY_PROPERTIES,
  type TypographyProperty,
  type TypographySetting,
} from "../site/typography.ts";

const LABELS: Record<TypographyProperty, string> = {
  fontSize: "Font size",
  fontWeight: "Font weight",
  lineHeight: "Line height",
  textAlign: "Text alignment",
  color: "Text colour",
  fontFamily: "Font family",
};
const CUSTOM: Partial<
  Record<TypographyProperty, Array<{ value: string; unit: string }>>
> = {
  fontSize: [{ value: "custom:px", unit: "px" }],
  fontWeight: [{ value: "custom:number", unit: "number" }],
  lineHeight: [
    { value: "custom:ratio", unit: "ratio" },
    { value: "custom:px", unit: "px" },
  ],
  color: [{ value: "custom:hex", unit: "hex" }],
};
function sourceMode(
  property: TypographyProperty,
  setting: TypographySetting,
): { mode: string; raw: string } {
  if (setting.state !== "value") return { mode: "", raw: "" };
  const value = setting.value;
  if (TYPOGRAPHY_PRESETS[property].includes(value))
    return { mode: value, raw: "" };
  const numeric = /\[([\d.]+)(px)?\]/.exec(value);
  if (numeric?.[1] && property !== "color")
    return {
      mode:
        property === "fontWeight"
          ? "custom:number"
          : numeric[2]
            ? "custom:px"
            : "custom:ratio",
      raw: numeric[1],
    };
  const color = /\[(#[a-f\d]+)\]/i.exec(value);
  if (property === "color" && color?.[1])
    return { mode: "custom:hex", raw: color[1] };
  return { mode: value, raw: "" };
}
function utilityFor(
  property: TypographyProperty,
  raw: string,
  mode: string,
): string {
  if (property === "fontSize") return `text-[${raw}px]`;
  if (property === "fontWeight") return `font-[${raw}]`;
  if (property === "lineHeight")
    return `leading-[${raw}${mode === "custom:px" ? "px" : ""}]`;
  return `text-[${raw}]`;
}
interface FieldProps {
  property: TypographyProperty;
  setting: TypographySetting;
  rendered: string | null;
  className: string;
  disabled: boolean;
  sourceKnown: boolean;
  onChange(value: string): void;
  onValidity(property: TypographyProperty, valid: boolean): void;
}
function TypographyField({
  property,
  setting,
  rendered,
  className,
  disabled,
  sourceKnown,
  onChange,
  onValidity,
}: FieldProps) {
  const initial = sourceMode(property, setting);
  const emittedSetting = useRef<string | null>(null);
  const customBase = useRef(className);
  const [mode, setMode] = useState(initial.mode),
    [raw, setRaw] = useState(initial.raw),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const ownUpdate =
      emittedSetting.current === `${initial.mode}|${initial.raw}`;
    emittedSetting.current = null;
    if (ownUpdate) return;
    setMode(initial.mode);
    setRaw(initial.raw);
    setError(null);
    onValidity(property, true);
  }, [property, initial.mode, initial.raw, onValidity]);
  const label = LABELS[property],
    presets = TYPOGRAPHY_PRESETS[property],
    custom = CUSTOM[property] ?? [];
  const unavailable =
    setting.state === "unsupported" || setting.state === "ambiguous";
  const locked = disabled || unavailable || !rendered;
  const change = (utility: string, base = className) => {
    const result = setTypographyClass(base, property, utility);
    if (!result.ok) {
      setError(result.message);
      onValidity(property, false);
      return;
    }
    setError(null);
    onValidity(property, true);
    const next = sourceMode(
      property,
      inspectTypographyClasses(result.className)[property],
    );
    emittedSetting.current = `${next.mode}|${next.raw}`;
    onChange(result.className);
  };
  const hasExisting =
    setting.state === "value" &&
    !presets.includes(setting.value) &&
    !initial.mode.startsWith("custom:");
  return (
    <div className="typography-field">
      <label>
        {label} preset
        <select
          aria-label={`${label} preset`}
          value={mode}
          disabled={locked}
          onChange={(event) => {
            const next = event.target.value;
            setMode(next);
            if (next.startsWith("custom:")) {
              setRaw("");
              setError("Enter a value before applying.");
              onValidity(property, false);
            } else change(next);
          }}
        >
          <option value="" disabled>
            {sourceKnown ? "No base utility" : "Source unavailable"}
          </option>
          {hasExisting && setting.state === "value" ? (
            <option value={setting.value}>Current project setting</option>
          ) : null}
          {presets.map((value) => (
            <option key={value} value={value}>
              {property === "fontFamily"
                ? `Project ${value.slice(5)}`
                : value.replace(/^(?:text|font|leading)-/, "")}
            </option>
          ))}
          {custom.map((item) => (
            <option key={item.value} value={item.value}>
              {item.unit === "hex" ? "Custom sRGB hex" : `Custom ${item.unit}`}
            </option>
          ))}
        </select>
      </label>
      {mode.startsWith("custom:") ? (
        <label>
          {label} {mode.slice(7)}
          <input
            aria-label={`${label} ${mode.slice(7)}`}
            type={mode === "custom:hex" ? "text" : "number"}
            step="any"
            value={raw}
            disabled={locked}
            placeholder={
              mode === "custom:hex" ? "#RRGGBB" : "New explicit value"
            }
            onFocus={() => {
              customBase.current = className;
            }}
            onChange={(event) => {
              setRaw(event.target.value);
              change(
                utilityFor(property, event.target.value, mode),
                customBase.current,
              );
            }}
          />
        </label>
      ) : null}
      <p className="field-note">
        Source draft:{" "}
        {sourceKnown ? (
          setting.state === "value" ? (
            <code>{setting.utility}</code>
          ) : setting.state === "unset" ? (
            "No base utility; origin may be elsewhere"
          ) : (
            setting.message
          )
        ) : (
          "Unavailable"
        )}
      </p>
      <p className="field-note">
        Rendered:{" "}
        {property === "color" &&
        rendered &&
        typeof CSS !== "undefined" &&
        CSS.supports("color", rendered) &&
        !/var\(|currentcolor/i.test(rendered) ? (
          <span
            className="typography-swatch"
            aria-hidden="true"
            style={{ backgroundColor: rendered }}
          />
        ) : null}
        <span data-testid={`rendered-${property}`}>
          {rendered ?? "Unavailable"}
        </span>
      </p>
      {error ? (
        <p className="field-note status-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
interface Props {
  applyDisabled?: boolean;
  onValidityChange?(valid: boolean): void;
  className: string;
  rendered: PreviewTypography | null;
  disabled: boolean;
  sourceKnown: boolean;
  onChange(value: string): void;
  onPreview(): void;
  onApply(): void;
}
export function TypographyInspector({
  applyDisabled,
  onValidityChange,
  className,
  rendered,
  disabled,
  sourceKnown,
  onChange,
  onPreview,
  onApply,
}: Props) {
  const settings = useMemo(
    () => inspectTypographyClasses(className),
    [className],
  );
  const [invalid, setInvalid] = useState<Set<TypographyProperty>>(
    () => new Set(),
  );
  useEffect(
    () => onValidityChange?.(invalid.size === 0),
    [invalid.size, onValidityChange],
  );
  const validity = useCallback(
    (property: TypographyProperty, valid: boolean) =>
      setInvalid((previous) => {
        if (previous.has(property) === !valid) return previous;
        const next = new Set(previous);
        if (valid) next.delete(property);
        else next.add(property);
        return next;
      }),
    [],
  );
  return (
    <section className="typography-inspector" aria-label="Typography">
      <h2>
        Typography <span className="field-note">Base</span>
      </h2>
      <p className="field-note">
        Changes stay in the draft until Apply. Rendered values are last
        observed. Responsive/state rules are preserved.
      </p>
      {TYPOGRAPHY_PROPERTIES.map((property) => (
        <TypographyField
          key={property}
          property={property}
          setting={settings[property]}
          rendered={rendered?.[property] ?? null}
          className={className}
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
          Preview typography patch
        </button>
        <button
          type="button"
          disabled={disabled || applyDisabled || invalid.size > 0}
          onClick={onApply}
        >
          Apply typography
        </button>
      </div>
    </section>
  );
}
