import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PreviewSpacing } from "../preview-bridge/protocol.ts";
import {
  inspectSpacingClasses,
  SPACING_PROPERTIES,
  SPACING_SCALE,
  type SpacingProperty,
  type SpacingSetting,
  setSpacingClass,
} from "../site/spacing.ts";

const LABELS: Record<SpacingProperty, string> = {
  padding: "Padding all",
  paddingInline: "Padding inline",
  paddingBlock: "Padding block",
  margin: "Margin all",
  marginInline: "Margin inline",
  marginBlock: "Margin block",
  gap: "Gap all",
  columnGap: "Column gap",
  rowGap: "Row gap",
};
const PREFIX: Record<SpacingProperty, string> = {
  padding: "p",
  paddingInline: "px",
  paddingBlock: "py",
  margin: "m",
  marginInline: "mx",
  marginBlock: "my",
  gap: "gap",
  columnGap: "gap-x",
  rowGap: "gap-y",
};
const MEASURED: Record<SpacingProperty, Array<keyof PreviewSpacing>> = {
  padding: [
    "paddingInlineStart",
    "paddingInlineEnd",
    "paddingBlockStart",
    "paddingBlockEnd",
  ],
  paddingInline: ["paddingInlineStart", "paddingInlineEnd"],
  paddingBlock: ["paddingBlockStart", "paddingBlockEnd"],
  margin: [
    "marginInlineStart",
    "marginInlineEnd",
    "marginBlockStart",
    "marginBlockEnd",
  ],
  marginInline: ["marginInlineStart", "marginInlineEnd"],
  marginBlock: ["marginBlockStart", "marginBlockEnd"],
  gap: ["columnGap", "rowGap"],
  columnGap: ["columnGap"],
  rowGap: ["rowGap"],
};
function sourceMode(setting: SpacingSetting) {
  if (setting.state !== "value") return { mode: "", raw: "" };
  const px = /\[([\d.]+)px\]/.exec(setting.value);
  return px?.[1]
    ? {
        mode: "custom:px",
        raw: `${setting.value.startsWith("-") ? "-" : ""}${px[1]}`,
      }
    : { mode: setting.value, raw: "" };
}
interface Props {
  className: string;
  rendered: PreviewSpacing | null;
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
  property: SpacingProperty;
  setting: SpacingSetting;
  onValidity(property: SpacingProperty, valid: boolean): void;
}
function SpacingField({
  property,
  setting,
  className,
  rendered,
  disabled,
  sourceKnown,
  onChange,
  onValidity,
}: FieldProps) {
  const initial = sourceMode(setting),
    emitted = useRef<string | null>(null),
    base = useRef(className);
  const [mode, setMode] = useState(initial.mode),
    [raw, setRaw] = useState(initial.raw),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const own = emitted.current === `${initial.mode}|${initial.raw}`;
    emitted.current = null;
    if (own) return;
    setMode(initial.mode);
    setRaw(initial.raw);
    setError(null);
    onValidity(property, true);
  }, [property, initial.mode, initial.raw, onValidity]);
  const label = LABELS[property],
    prefix = PREFIX[property],
    keys = MEASURED[property];
  const locked =
    disabled ||
    setting.state === "unsupported" ||
    ((property.includes("Gap") || property === "gap") && !rendered?.display) ||
    keys.some((key) => !rendered?.[key]);
  const values: string[] = SPACING_SCALE.map((value) => `${prefix}-${value}`);
  if (property.startsWith("margin")) values.push(`${prefix}-auto`);
  const change = (utility: string, source = className) => {
    const result = setSpacingClass(source, property, utility);
    if (!result.ok) {
      setError(result.message);
      onValidity(property, false);
      return;
    }
    const next = sourceMode(inspectSpacingClasses(result.className)[property]);
    emitted.current = `${next.mode}|${next.raw}`;
    setError(null);
    onValidity(property, true);
    onChange(result.className);
  };
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
                : setting.state === "mixed"
                  ? "Mixed / partly set"
                  : "No base utility"}
          </option>
          {setting.state === "value" &&
          !values.includes(setting.value) &&
          initial.mode !== "custom:px" ? (
            <option value={setting.value}>Current project setting</option>
          ) : null}
          {values.map((value) => (
            <option key={value} value={value}>
              {value.slice(prefix.length + 1)}
            </option>
          ))}
          <option value="custom:px">Custom px</option>
        </select>
      </label>
      {mode === "custom:px" ? (
        <label>
          {label} px
          <input
            aria-label={`${label} px`}
            type="number"
            step="any"
            min={property.startsWith("margin") ? -2048 : 0}
            max={2048}
            value={raw}
            disabled={locked}
            placeholder="New explicit value"
            onFocus={() => {
              base.current = className;
            }}
            onChange={(event) => {
              const value = event.target.value;
              setRaw(value);
              const negative = value.startsWith("-");
              change(
                `${negative ? "-" : ""}${prefix}-[${negative ? value.slice(1) : value}px]`,
                base.current,
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
        Rendered{" "}
        <span data-testid={`rendered-${property}`}>
          {keys
            .map((key) => `${key}: ${rendered?.[key] ?? "Unavailable"}`)
            .join(" / ")}
        </span>
      </p>
      {(property.includes("Gap") || property === "gap") &&
      rendered?.display &&
      !["flex", "inline-flex", "grid", "inline-grid"].includes(
        rendered.display,
      ) ? (
        <p className="field-note">
          Gap is inactive for rendered display {rendered.display}; a source edit
          may remain visually unconfirmed.
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
export function SpacingInspector({
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
  const settings = useMemo(() => inspectSpacingClasses(className), [className]);
  const [invalid, setInvalid] = useState<Set<SpacingProperty>>(() => new Set());
  const validity = useCallback(
    (property: SpacingProperty, valid: boolean) =>
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
    <details className="spacing-inspector" open>
      <summary>
        Spacing <span className="field-note">Base</span>
      </summary>
      <section aria-label="Spacing">
        <p className="field-note">
          Inline and block follow the page's writing direction. Source changes
          stay in the draft until Apply; other responsive/state rules are
          preserved.
        </p>
        {SPACING_PROPERTIES.map((property) => (
          <SpacingField
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
            Preview spacing patch
          </button>
          <button
            type="button"
            disabled={disabled || applyDisabled || invalid.size > 0}
            onClick={onApply}
          >
            Apply spacing
          </button>
        </div>
      </section>
    </details>
  );
}
