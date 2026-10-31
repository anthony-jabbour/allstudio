import { useEffect, useState } from "react";
import { EDIT_BREAKPOINTS, type EditBreakpoint } from "../site/class-tokens.ts";
import { isViewportWidth, VIEWPORT_PRESETS } from "./viewport.ts";

export function ViewportControls({
  width,
  scope,
  manual,
  zoom,
  disabled,
  onWidth,
  onScope,
  onZoom,
}: {
  width: number;
  scope: EditBreakpoint;
  manual: boolean;
  zoom: string;
  disabled: boolean;
  onWidth(width: number): void;
  onScope(scope: EditBreakpoint): void;
  onZoom(zoom: string): void;
}) {
  const [custom, setCustom] = useState(String(width));
  useEffect(() => setCustom(String(width)), [width]);
  const valid = isViewportWidth(Number(custom)) && custom.trim() !== "";
  return (
    <fieldset
      className="viewport-controls"
      aria-label="Responsive preview tools"
    >
      <div className="viewport-presets">
        {VIEWPORT_PRESETS.map((item) => (
          <button
            key={item.width}
            type="button"
            aria-label={`${item.label} viewport`}
            aria-pressed={width === item.width}
            disabled={disabled}
            onClick={() => onWidth(item.width)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) onWidth(Number(custom));
        }}
      >
        <label>
          Width{" "}
          <input
            aria-label="Preview width"
            type="number"
            min="320"
            max="2560"
            step="1"
            value={custom}
            disabled={disabled}
            aria-invalid={!valid}
            onChange={(event) => setCustom(event.target.value)}
          />
        </label>
        <button type="submit" disabled={disabled || !valid}>
          Set width
        </button>
      </form>
      <label>
        Zoom{" "}
        <select
          aria-label="Canvas zoom"
          value={zoom}
          onChange={(event) => onZoom(event.target.value)}
        >
          {[
            ["fit", "Fit"],
            ["0.5", "50%"],
            ["0.75", "75%"],
            ["1", "100%"],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Edit{" "}
        <select
          aria-label="Edit breakpoint"
          value={scope}
          disabled={disabled}
          onChange={(event) => onScope(event.target.value as EditBreakpoint)}
        >
          {EDIT_BREAKPOINTS.map((value) => (
            <option key={value} value={value}>
              {value === "base" ? "Base" : value}
            </option>
          ))}
        </select>
      </label>
      <span className="field-note">
        {manual ? "Manual edit scope" : "Automatic edit scope"}
      </span>
      {!valid ? (
        <span role="alert">Use a whole width from 320 to 2560px.</span>
      ) : null}
    </fieldset>
  );
}
