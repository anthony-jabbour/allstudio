import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PreviewAppearance } from "../preview-bridge/protocol.ts";
import {
  APPEARANCE_PROPERTIES,
  type AppearanceProperty,
  type AppearanceSetting,
  BACKGROUND_PRESETS,
  inspectAppearanceClasses,
  MAX_RADIUS_PX,
  RADIUS_PRESETS,
  setAppearanceClass,
} from "../site/appearance.ts";

const LABELS: Record<AppearanceProperty, string> = {
  backgroundColor: "Background colour",
  borderRadius: "Corner radius",
};
const PRESETS: Record<AppearanceProperty, string[]> = {
  backgroundColor: BACKGROUND_PRESETS,
  borderRadius: RADIUS_PRESETS,
};
const CUSTOM: Record<AppearanceProperty, { mode: string; label: string }> = {
  backgroundColor: { mode: "custom:hex", label: "Custom sRGB hex" },
  borderRadius: { mode: "custom:px", label: "Custom px" },
};

function sourceMode(
  property: AppearanceProperty,
  setting: AppearanceSetting,
): { mode: string; raw: string } {
  if (setting.state !== "value") return { mode: "", raw: "" };
  if (PRESETS[property].includes(setting.value))
    return { mode: setting.value, raw: "" };
  if (property === "backgroundColor") {
    const hex = /^bg-\[(#[a-f\d]+)\]/i.exec(setting.value);
    if (hex?.[1]) return { mode: "custom:hex", raw: hex[1] };
  } else {
    const px = /^rounded-\[([\d.]+)px\]$/.exec(setting.value);
    if (px?.[1]) return { mode: "custom:px", raw: px[1] };
  }
  return { mode: setting.value, raw: "" };
}
function utilityFor(property: AppearanceProperty, raw: string): string {
  return property === "backgroundColor" ? `bg-[${raw}]` : `rounded-[${raw}px]`;
}
function presetLabel(property: AppearanceProperty, value: string): string {
  if (property === "backgroundColor") return value.slice(3);
  return value === "rounded" ? "default" : value.slice(8);
}

interface Props {
  className: string;
  rendered: PreviewAppearance | null;
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
    "className" | "rendered" | "disabled" | "sourceKnown" | "onChange"
  > {
  property: AppearanceProperty;
  setting: AppearanceSetting;
  onValidity(property: AppearanceProperty, valid: boolean): void;
}

function AppearanceField({
  property,
  setting,
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
  const custom = CUSTOM[property];
  const measured = rendered?.[property] ?? null;
  const unavailable =
    setting.state === "unsupported" || setting.state === "ambiguous";
  const locked = disabled || unavailable || !measured;
  const change = (utility: string, source = className) => {
    const result = setAppearanceClass(source, property, utility);
    if (!result.ok) {
      setError(result.message);
      onValidity(property, false);
      return;
    }
    const next = sourceMode(
      property,
      inspectAppearanceClasses(result.className)[property],
    );
    emitted.current = `${next.mode}|${next.raw}`;
    setError(null);
    onValidity(property, true);
    onChange(result.className);
  };
  const hasExisting =
    setting.state === "value" &&
    !PRESETS[property].includes(setting.value) &&
    !initial.mode.startsWith("custom:");
  const imageCovers =
    property === "backgroundColor" &&
    rendered?.backgroundImage !== undefined &&
    rendered.backgroundImage !== "none";
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
            if (value === custom.mode) {
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
                  : "No base utility"}
          </option>
          {hasExisting && setting.state === "value" ? (
            <option value={setting.value}>Current project setting</option>
          ) : null}
          {PRESETS[property].map((value) => (
            <option key={value} value={value}>
              {presetLabel(property, value)}
            </option>
          ))}
          <option value={custom.mode}>{custom.label}</option>
        </select>
      </label>
      {mode === custom.mode ? (
        <label>
          {label} {property === "backgroundColor" ? "hex" : "px"}
          <input
            aria-label={`${label} ${property === "backgroundColor" ? "hex" : "px"}`}
            type={property === "backgroundColor" ? "text" : "number"}
            step="any"
            min={property === "borderRadius" ? 0 : undefined}
            max={property === "borderRadius" ? MAX_RADIUS_PX : undefined}
            value={raw}
            disabled={locked}
            placeholder={
              property === "backgroundColor" ? "#RRGGBB" : "New explicit value"
            }
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
        {property === "backgroundColor" &&
        measured &&
        typeof CSS !== "undefined" &&
        CSS.supports("color", measured) &&
        !/var\(|currentcolor/i.test(measured) ? (
          <span
            className="typography-swatch"
            aria-hidden="true"
            style={{ backgroundColor: measured }}
          />
        ) : null}
        <span data-testid={`rendered-${property}`}>
          {measured ?? "Unavailable"}
        </span>
      </p>
      {imageCovers ? (
        <p className="field-note">
          A background image or gradient is rendered over this colour; a colour
          edit may stay visually unconfirmed.
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

export function AppearanceInspector({
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
    () => inspectAppearanceClasses(className),
    [className],
  );
  const [invalid, setInvalid] = useState<Set<AppearanceProperty>>(
    () => new Set(),
  );
  const validity = useCallback(
    (property: AppearanceProperty, valid: boolean) =>
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
    <details className="appearance-inspector" open>
      <summary>
        Appearance <span className="field-note">Base</span>
      </summary>
      <section aria-label="Appearance properties">
        <p className="field-note">
          Background colour and one uniform corner radius. Images, gradients,
          per-corner radii and responsive/state rules are preserved; source
          changes stay in the draft until Apply.
        </p>
        {APPEARANCE_PROPERTIES.map((property) => (
          <AppearanceField
            key={property}
            property={property}
            setting={settings[property]}
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
            Preview appearance patch
          </button>
          <button
            type="button"
            disabled={disabled || applyDisabled || invalid.size > 0}
            onClick={onApply}
          >
            Apply appearance
          </button>
        </div>
      </section>
    </details>
  );
}
