import type { ProjectManifestV1 } from "@allstudio/project";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PreviewElementSnapshot } from "../preview-bridge/protocol.ts";
import type { ResponsiveCapabilities } from "../site/breakpoints.ts";
import type { EditBreakpoint } from "../site/class-tokens.ts";
import {
  type DiscoveredRoute,
  describeSourceEditFailure,
  type SourceEditWorkspace,
  type SourceElementInfo,
  type UnsupportedRoute,
  type UnsupportedRouteReason,
} from "../site/source-edit-workspace.ts";
import {
  type AppearanceTarget,
  appearanceTargets,
  observesAppearance,
} from "./appearance-confirmation.ts";
import { AppearanceInspector } from "./appearance-inspector.tsx";
import { LayerTree } from "./layer-tree.tsx";
import {
  type LayoutTarget,
  layoutTargets,
  observesLayout,
} from "./layout-confirmation.ts";
import { LayoutInspector } from "./layout-inspector.tsx";
import {
  observesSpacing,
  type SpacingTarget,
  spacingTargets,
} from "./spacing-confirmation.ts";
import { SpacingInspector } from "./spacing-inspector.tsx";
import {
  observesTypography,
  type TypographyTarget,
  typographyTargets,
} from "./typography-confirmation.ts";
import { TypographyInspector } from "./typography-inspector.tsx";
import { usePreviewBridge } from "./use-preview-bridge.ts";
import { breakpointForWidth, fitScale } from "./viewport.ts";
import { ViewportControls } from "./viewport-controls.tsx";

export const EDITOR_STATUS = "text-and-class-edit-slice" as const;

/** How long to wait for hot reload before reloading the preview once. */
const REFRESH_TIMEOUT_MS = 10_000;

export interface EditorShellProps {
  manifest?: ProjectManifestV1;
  /** Live preview of the workspace project, served from its own origin. */
  previewUrl?: string;
  workspace?: SourceEditWorkspace;
  routes?: readonly DiscoveredRoute[];
  unsupportedRoutes?: readonly UnsupportedRoute[];
  activeRoute?: string;
  projectControls?: import("react").ReactNode;
  homeContent?: import("react").ReactNode;
  disabled?: boolean;
}

export function hasUnsavedInspectorDraft(input: {
  source: SourceElementInfo | null;
  draft: string;
  classDraft: string;
  typographyValid: boolean;
  spacingValid: boolean;
  appearanceValid: boolean;
  layoutValid: boolean;
  hasPendingRefresh: boolean;
}): boolean {
  const {
    source,
    draft,
    classDraft,
    typographyValid,
    spacingValid,
    appearanceValid,
    layoutValid,
    hasPendingRefresh,
  } = input;
  if (!source) {
    return false;
  }
  if (source.text.ok && draft !== source.text.text) {
    return true;
  }
  if (source.className.ok && classDraft !== (source.className.value ?? "")) {
    return true;
  }
  if (!typographyValid || !spacingValid || !appearanceValid || !layoutValid) {
    return true;
  }
  return hasPendingRefresh;
}

function unsupportedReasonBadge(reason: UnsupportedRouteReason): string {
  switch (reason) {
    case "dynamic-route":
      return "Dynamic";
    case "catch-all-route":
      return "Catch-all";
    case "parallel-route":
      return "Parallel";
    case "intercepting-route":
      return "Intercepting";
    case "private-route":
      return "Private";
    case "ambiguous-route":
      return "Ambiguous";
    case "invalid-segment":
      return "Invalid";
  }
}

type Status = { kind: "info" | "success" | "error"; text: string } | null;

type EditKind = "text" | "className";

interface PendingRefresh {
  appearance?: AppearanceTarget[];
  layout?: LayoutTarget[];
  spacing?: SpacingTarget[];
  propertyLabel?:
    | "typography"
    | "spacing"
    | "appearance"
    | "layout"
    | "design properties";
  typography?: TypographyTarget[];
  oid: string;
  kind: EditKind;
  /** Value the preview must show before the edit counts as visible. */
  value: string;
  reloaded: boolean;
  /** The edit run this confirmation belongs to. */
  run: number;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function previewShows(
  element: PreviewElementSnapshot,
  pending: PendingRefresh,
): boolean {
  const rendered = pending.kind === "text" ? element.text : element.className;
  return (
    normalizeWhitespace(rendered) === normalizeWhitespace(pending.value) &&
    (!pending.typography?.length ||
      observesTypography(element.typography, pending.typography)) &&
    (!pending.spacing?.length ||
      observesSpacing(element.spacing, pending.spacing)) &&
    (!pending.appearance?.length ||
      observesAppearance(element.appearance, pending.appearance)) &&
    (!pending.layout?.length || observesLayout(element.layout, pending.layout))
  );
}

const NOOP_SUBJECT: Record<EditKind, string> = {
  text: "the text already matches",
  className: "the classes already match",
};

const KIND_LABEL: Record<EditKind, string> = {
  text: "text",
  className: "classes",
};

export function EditorShell({
  manifest,
  previewUrl,
  workspace,
  routes,
  unsupportedRoutes,
  activeRoute,
  projectControls,
  homeContent,
  disabled,
}: EditorShellProps) {
  const [appearance, setAppearance] = useState(() => {
    try {
      const saved = localStorage.getItem("allstudio:appearance:v1");
      return saved === "light" || saved === "dark" ? saved : "system";
    } catch {
      return "system";
    }
  });
  const [navigatorOpen, setNavigatorOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  useEffect(() => {
    document.documentElement.dataset.theme = appearance;
    try {
      localStorage.setItem("allstudio:appearance:v1", appearance);
    } catch {
      // Appearance storage is optional; editing must remain available.
    }
  }, [appearance]);
  const connected = Boolean(previewUrl && workspace);
  return (
    <main
      className="editor-shell"
      data-navigator={navigatorOpen}
      data-inspector={inspectorOpen}
    >
      <section className="studio-toolbar" aria-label="Studio toolbar">
        <span className="studio-brand">
          <span aria-hidden="true">✳</span> allstudio
        </span>
        <h1>{manifest?.name ?? (connected ? "Studio" : "Home")}</h1>
        {connected ? <span className="studio-mode">Studio</span> : null}
        <div className="studio-toolbar-end">
          {connected ? (
            <>
              <button
                type="button"
                aria-pressed={navigatorOpen}
                onClick={() => setNavigatorOpen((value) => !value)}
              >
                Navigator
              </button>
              <button
                type="button"
                aria-pressed={inspectorOpen}
                onClick={() => setInspectorOpen((value) => !value)}
              >
                Inspector
              </button>
            </>
          ) : null}
          <label className="appearance-control">
            Appearance
            <select
              aria-label="Appearance"
              value={appearance}
              onChange={(event) => setAppearance(event.target.value)}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>
      </section>
      {projectControls ? (
        <div className="studio-project-controls">{projectControls}</div>
      ) : null}
      {connected && previewUrl && workspace ? (
        <div className="studio-body" inert={disabled}>
          <SourceElementEditor
            previewUrl={previewUrl}
            workspace={workspace}
            routes={routes}
            unsupportedRoutes={unsupportedRoutes}
            activeRoute={activeRoute}
            navigatorOpen={navigatorOpen}
          />
        </div>
      ) : (
        <section className="studio-home" aria-label="Local workspace">
          {homeContent ?? (
            <>
              <h2>Open a project to start designing</h2>
              <p>No preview workspace connected.</p>
            </>
          )}
        </section>
      )}
      <footer className="studio-footer">
        <span>Local workspace · No account required</span>
        <span>
          Static text and class editing · Layout dragging and structure editing
          are not implemented yet.
        </span>
      </footer>
    </main>
  );
}

function SourceElementEditor({
  previewUrl,
  workspace,
  routes,
  unsupportedRoutes,
  activeRoute,
  navigatorOpen,
}: {
  previewUrl: string;
  workspace: SourceEditWorkspace;
  routes?: readonly DiscoveredRoute[];
  unsupportedRoutes?: readonly UnsupportedRoute[];
  activeRoute?: string;
  navigatorOpen: boolean;
}) {
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState(previewUrl);
  const [viewportWidth, setViewportWidth] = useState(1440);
  const [scope, setScope] = useState<EditBreakpoint>("xl");
  const [manualScope, setManualScope] = useState(false);
  const [zoom, setZoom] = useState("1");
  const [scale, setScale] = useState(1);
  const [viewportHeight, setViewportHeight] = useState(800);
  const canvas = useRef<HTMLElement | null>(null);
  const [responsive, setResponsive] = useState<ResponsiveCapabilities>({
    status: "unavailable",
    reason: "read-failed",
  });
  const [contextVersion, setContextVersion] = useState(0);
  const [pendingContext, setPendingContext] = useState<{
    width: number;
    scope: EditBreakpoint;
    manual: boolean;
  } | null>(null);
  const [currentRoute, setCurrentRoute] = useState(
    () => activeRoute ?? new URL(previewUrl).pathname,
  );
  const [currentRoutes, setCurrentRoutes] = useState<
    readonly DiscoveredRoute[]
  >(() =>
    routes?.length
      ? routes
      : [
          {
            route: new URL(previewUrl).pathname,
            sourcePath: "src/app/page.tsx",
          },
        ],
  );
  const [currentUnsupportedRoutes, setCurrentUnsupportedRoutes] = useState<
    readonly UnsupportedRoute[]
  >(() => unsupportedRoutes ?? []);
  const [pendingRouteSwitch, setPendingRouteSwitch] = useState<string | null>(
    null,
  );
  const [switchingRoute, setSwitchingRoute] = useState(false);
  const previewOrigin = new URL(currentPreviewUrl).origin;
  const frame = useRef<HTMLIFrameElement | null>(null);
  const selectionBox = useRef<HTMLDivElement | null>(null);
  const requestedLayer = useRef<string | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [selected, setSelected] = useState<PreviewElementSnapshot | null>(null);
  const [source, setSource] = useState<SourceElementInfo | null>(null);
  const [draft, setDraft] = useState("");
  const [classDraft, setClassDraft] = useState("");
  const [diff, setDiff] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [typographyValid, setTypographyValid] = useState(true);
  const [spacingValid, setSpacingValid] = useState(true);
  const [appearanceValid, setAppearanceValid] = useState(true);
  const [layoutValid, setLayoutValid] = useState(true);
  const [pending, setPending] = useState<PendingRefresh | null>(null);
  const request = useRef(0);
  // Bumped on every selection so late edit responses for an older
  // selection are ignored.
  const selection = useRef(0);
  // Bumped on every edit and selection. A save confirmation only reports
  // success if no newer edit or selection started since that save.
  const editRun = useRef(0);
  const applying = useRef<number | null>(null);

  // Re-audit when the user changes scope; writes independently recheck in the adapter.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scope is the explicit audit refresh trigger.
  useEffect(() => {
    let active = true;
    setResponsive({ status: "unavailable", reason: "read-failed" });
    void workspace
      .getResponsiveCapabilities?.()
      .then((result) => {
        if (active) setResponsive(result);
      })
      .catch(() => {
        if (active)
          setResponsive({ status: "unavailable", reason: "read-failed" });
      });
    return () => {
      active = false;
    };
  }, [workspace, scope]);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const resize = () => {
      const height = Math.max(640, window.innerHeight - 230);
      setViewportHeight(height);
      setScale(
        zoom === "fit"
          ? (fitScale(
              viewportWidth,
              height,
              element.clientWidth - 56,
              element.clientHeight - 150,
            ) ?? 0.1)
          : Number(zoom),
      );
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    window.addEventListener("resize", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [viewportWidth, zoom]);

  const locate = useCallback(
    /**
     * `refresh` re-reads location and hash after a confirmed save without
     * touching the drafts, so an unsaved edit in the other field survives.
     */
    async (
      oid: string,
      mode: "select" | "refresh" = "select",
    ): Promise<SourceElementInfo | null> => {
      const id = ++request.current;
      const result = await workspace.locate(oid);
      if (id !== request.current) {
        return null;
      }
      if (!result.ok) {
        setSource(null);
        setStatus({ kind: "error", text: result.message });
        return null;
      }
      const { element } = result;
      setSource(element);
      if (mode === "select") {
        setDraft(element.text.ok ? element.text.text : "");
        setClassDraft(
          element.className.ok ? (element.className.value ?? "") : "",
        );
        setStatus(null);
      }
      return element;
    },
    [workspace],
  );

  const bridge = usePreviewBridge(frame, previewOrigin, {
    onLayerError() {
      requestedLayer.current = null;
      setStatus({
        kind: "error",
        text: "The layer tree changed. Select the element again.",
      });
    },
    onSelect(clickedTag, element) {
      selection.current += 1;
      request.current += 1;
      editRun.current += 1;
      setBusy(false);
      // Clear the previous element's source and drafts right away, so
      // editing stays disabled until this element's lookup finishes.
      setSource(null);
      setDraft("");
      setClassDraft("");
      setDiff("");
      setPending(null);
      setPendingRouteSwitch(null);
      setPendingContext(null);
      setStatus(null);
      setSelected(element);
      if (!element) {
        setStatus({
          kind: "error",
          text: `No source mapping: the clicked <${clickedTag || "?"}> has no data-oid element around it.`,
        });
        return;
      }
      if (element.instances > 1) {
        setStatus({
          kind: "error",
          text: `This source element renders ${element.instances} times (e.g. in a list or a reused component). Editing one instance is not supported.`,
        });
        return;
      }
      void locate(element.oid);
    },
    onElement(oid, element) {
      if (oid !== selected?.oid && oid !== pending?.oid) {
        return;
      }
      setSelected(element);
      // A saved source ID may not exist in the DOM until HMR reaches the preview.
      if (!element && (pending || applying.current === editRun.current)) return;
      if (!element || element.instances !== 1) {
        request.current += 1;
        editRun.current += 1;
        setSource(null);
        setPending(null);
        setBusy(false);
        setStatus({
          kind: "error",
          text: element
            ? `This source element renders ${element.instances} times (e.g. in a list or a reused component). Editing one instance is not supported.`
            : "The selected element is no longer available. Select it again.",
        });
        return;
      }
      if (pending && element && previewShows(element, pending)) {
        setPending(null);
        // Report success only once the source details are refreshed, so
        // the message also means the panel reflects the saved file. Editing
        // stays disabled until then, and a newer edit or selection wins.
        const { kind, run, propertyLabel } = pending;
        let settled = false;
        // The refresh gets the same deadline as the preview check, so a
        // stalled lookup cannot leave editing locked.
        const deadline = window.setTimeout(() => {
          if (settled || run !== editRun.current) {
            return;
          }
          settled = true;
          request.current += 1; // drop the late lookup result
          setBusy(false);
          setStatus({
            kind: "error",
            text: `Saved, and the preview shows the new ${KIND_LABEL[kind]}, but refreshing the source details timed out. Reselect the element to see its current source.`,
          });
        }, REFRESH_TIMEOUT_MS);
        void locate(oid, "refresh").then((refreshed) => {
          if (settled || run !== editRun.current) {
            return;
          }
          settled = true;
          window.clearTimeout(deadline);
          setBusy(false);
          if (refreshed) {
            setStatus({
              kind: "success",
              text: propertyLabel
                ? `Saved ${propertyLabel} to ${refreshed.path}; observed the requested properties in the preview.`
                : `Saved to ${refreshed.path} and the preview shows the new ${KIND_LABEL[kind]}.`,
            });
          }
        });
      }
    },
  });

  useEffect(() => {
    if (!pending) {
      return;
    }
    const poll = pending.propertyLabel
      ? window.setInterval(() => bridge.track(pending.oid), 250)
      : null;
    const timer = window.setTimeout(() => {
      if (!pending.reloaded) {
        setPending({ ...pending, reloaded: true });
        setFrameKey((key) => key + 1);
        return;
      }
      setPending(null);
      setBusy(false);
      setStatus({
        kind: "error",
        text: pending.propertyLabel
          ? `${pending.propertyLabel[0]?.toUpperCase()}${pending.propertyLabel.slice(1)} source saved, but rendering is unconfirmed or unchanged at this viewport. Other CSS or responsive rules may apply. Undo remains available.`
          : `The file was saved, but the preview did not show the new ${KIND_LABEL[pending.kind]}. Check the preview server log.`,
      });
    }, REFRESH_TIMEOUT_MS);
    return () => {
      window.clearTimeout(timer);
      if (poll !== null) window.clearInterval(poll);
    };
  }, [pending, bridge.track]);

  useEffect(() => {
    if (selected?.nodeId === requestedLayer.current) {
      requestedLayer.current = null;
      selectionBox.current?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [selected]);
  const textEditable =
    Boolean(source?.text.ok) &&
    selected?.instances === 1 &&
    bridge.connected &&
    !busy;
  const classEditable =
    Boolean(source?.className.ok) &&
    selected?.instances === 1 &&
    bridge.connected &&
    !busy;
  const hasUnsavedDraft = hasUnsavedInspectorDraft({
    source,
    draft,
    classDraft,
    typographyValid,
    spacingValid,
    appearanceValid,
    layoutValid,
    hasPendingRefresh: pending !== null,
  });
  const switchContext = (
    next: { width: number; scope: EditBreakpoint; manual: boolean },
    discard = false,
  ) => {
    if (busy || pending || switchingRoute) return;
    if (next.width === viewportWidth && next.scope === scope) {
      setManualScope(next.manual);
      setPendingContext(null);
      return;
    }
    const styleDirty =
      Boolean(
        source?.className.ok && classDraft !== (source.className.value ?? ""),
      ) ||
      !typographyValid ||
      !spacingValid ||
      !appearanceValid ||
      !layoutValid;
    if (styleDirty && !discard) {
      setPendingContext(next);
      return;
    }
    if (discard) {
      setClassDraft(source?.className.ok ? (source.className.value ?? "") : "");
      setTypographyValid(true);
      setSpacingValid(true);
      setAppearanceValid(true);
      setLayoutValid(true);
    }
    setPendingContext(null);
    setPendingRouteSwitch(null);
    setDiff("");
    setViewportWidth(next.width);
    setScope(next.scope);
    setManualScope(next.manual);
    setContextVersion((value) => value + 1);
    if (selected) bridge.track(selected.oid);
  };
  const designEditable =
    classEditable &&
    (scope === "base" || responsive.status === "supported-defaults");

  const executeRouteSwitch = async (targetRoute: string) => {
    if (!workspace.selectRoute) {
      setPendingRouteSwitch(null);
      setStatus({
        kind: "error",
        text: "Route navigation is not supported by this workspace.",
      });
      return;
    }
    setSwitchingRoute(true);
    const res = await workspace.selectRoute(targetRoute);
    setSwitchingRoute(false);
    if (!res.ok) {
      setPendingRouteSwitch(null);
      setStatus({ kind: "error", text: res.message });
      return;
    }
    selection.current += 1;
    request.current += 1;
    editRun.current += 1;
    applying.current = null;
    requestedLayer.current = null;
    bridge.reset();
    setSelected(null);
    setSource(null);
    setDraft("");
    setClassDraft("");
    setDiff("");
    setPending(null);
    setPendingRouteSwitch(null);
    setBusy(false);
    setTypographyValid(true);
    setSpacingValid(true);
    setAppearanceValid(true);
    setLayoutValid(true);
    setCurrentRoute(res.route);
    setCurrentPreviewUrl(res.previewUrl);
    setCurrentRoutes(res.routes);
    setCurrentUnsupportedRoutes(res.unsupportedRoutes);
    setFrameKey((k) => k + 1);
    setStatus({
      kind: "info",
      text: `Switched preview to ${res.route} (${res.sourcePath}).`,
    });
  };

  const handleRouteClick = (targetRoute: string) => {
    if (targetRoute === currentRoute) {
      setPendingRouteSwitch(null);
      return;
    }
    if (hasUnsavedDraft) {
      setPendingRouteSwitch(targetRoute);
      return;
    }
    void executeRouteSwitch(targetRoute);
  };

  const edit = async (kind: EditKind, apply: boolean, design = false) => {
    if (!source || !selected) {
      return;
    }
    let targets: TypographyTarget[] | undefined;
    let spacing: SpacingTarget[] | undefined;
    let appearance: AppearanceTarget[] | undefined;
    let layout: LayoutTarget[] | undefined;
    let propertyLabel: PendingRefresh["propertyLabel"];
    if (design && apply) {
      const before = source.className.ok ? (source.className.value ?? "") : "";
      const result = typographyTargets(
        before,
        classDraft,
        selected.typography,
        scope,
      );
      if (!result.ok) {
        setStatus({ kind: "error", text: result.message });
        return;
      }
      const spacingResult = spacingTargets(
        before,
        classDraft,
        selected.spacing,
        scope,
      );
      if (!spacingResult.ok) {
        setStatus({ kind: "error", text: spacingResult.message });
        return;
      }
      const appearanceResult = appearanceTargets(
        before,
        classDraft,
        selected.appearance,
        scope,
      );
      if (!appearanceResult.ok) {
        setStatus({ kind: "error", text: appearanceResult.message });
        return;
      }
      const layoutResult = layoutTargets(
        before,
        classDraft,
        selected.layout,
        scope,
      );
      if (!layoutResult.ok) {
        setStatus({ kind: "error", text: layoutResult.message });
        return;
      }
      if (
        !result.targets.length &&
        !spacingResult.targets.length &&
        !appearanceResult.targets.length &&
        !layoutResult.targets.length &&
        before !== classDraft
      ) {
        setStatus({
          kind: "info",
          text: "No supported design setting changed. Review the draft in Classes.",
        });
        return;
      }
      targets = result.targets;
      spacing = spacingResult.targets;
      appearance = appearanceResult.targets;
      layout = layoutResult.targets;
      const groups = [
        targets.length ? "typography" : null,
        spacing.length ? "spacing" : null,
        appearance.length ? "appearance" : null,
        layout.length ? "layout" : null,
      ].filter((group) => group !== null);
      propertyLabel =
        groups.length > 1
          ? "design properties"
          : (groups[0] as PendingRefresh["propertyLabel"]);
    }
    const selectionAtStart = selection.current;
    const run = ++editRun.current;
    if (apply) applying.current = run;
    setBusy(true);
    const target = {
      path: source.path,
      oid: selected.oid,
      expectedSha256: source.sha256,
    };
    const result =
      kind === "text"
        ? await (apply ? workspace.applyTextEdit : workspace.previewTextEdit)({
            ...target,
            text: draft,
          })
        : await (apply ? workspace.applyClassEdit : workspace.previewClassEdit)(
            {
              ...target,
              className: classDraft,
              ...(design ? { breakpoint: scope } : {}),
            },
          );
    if (applying.current === run) applying.current = null;
    if (selectionAtStart !== selection.current || run !== editRun.current) {
      return;
    }
    if (!result.ok || !result.written) {
      // Nothing to confirm in the preview: editing is available again.
      setBusy(false);
    }
    if (!result.ok) {
      setStatus({ kind: "error", text: result.message });
      return;
    }
    setDiff(result.diff);
    if (result.noop) {
      setStatus({
        kind: "info",
        text: `No change: ${NOOP_SUBJECT[kind]}. The file was not rewritten.`,
      });
      return;
    }
    if (!result.written) {
      setStatus({
        kind: "info",
        text: "Patch ready. Review the diff, then Apply.",
      });
      return;
    }
    const savedOid = result.oid ?? selected.oid;
    setSelected({ ...selected, oid: savedOid });
    setSource({
      ...source,
      sha256: result.sha256,
      ...(kind === "text"
        ? { text: { ok: true, text: draft } }
        : {
            className: {
              ok: true,
              value: classDraft === "" ? null : classDraft,
            },
          }),
    });
    setStatus({
      kind: "info",
      text: `Saved to ${source.path}. Waiting for the preview to refresh…`,
    });
    setPending({
      appearance,
      layout,
      spacing,
      propertyLabel,
      typography: targets,
      oid: savedOid,
      kind,
      value: kind === "text" ? draft : classDraft,
      reloaded: false,
      run,
    });
    bridge.track(savedOid);
  };

  const rect = selected?.rect;

  return (
    <>
      <aside
        className="studio-navigator"
        aria-label="Project navigator"
        hidden={!navigatorOpen}
      >
        <h2>Pages</h2>
        <ul className="page-list" aria-label="Pages">
          {currentRoutes.map((entry) => (
            <li key={entry.route}>
              <button
                type="button"
                className="page-item"
                data-route={entry.route}
                aria-current={entry.route === currentRoute ? "page" : undefined}
                disabled={busy || switchingRoute}
                onClick={() => handleRouteClick(entry.route)}
              >
                <span className="page-route">
                  <span aria-hidden="true">▤</span> {entry.route}
                </span>
                <span className="page-source">{entry.sourcePath}</span>
              </button>
            </li>
          ))}
          {currentUnsupportedRoutes.map((item) => (
            <li
              key={`${item.sourcePath}:${item.route}`}
              className="page-item page-item-unsupported"
              data-unsupported-route={item.route}
              title={item.message}
            >
              <div className="page-item-header">
                <span className="page-route">{item.route}</span>
                <span className="page-badge">
                  {unsupportedReasonBadge(item.reason)}
                </span>
              </div>
              <span className="page-source">{item.sourcePath}</span>
              <span className="page-reason">{item.message}</span>
            </li>
          ))}
        </ul>
        {pendingRouteSwitch !== null ? (
          <div
            className="route-draft-confirm"
            role="alert"
            aria-label="Unsaved route draft confirmation"
            data-testid="route-draft-confirm"
          >
            <p>
              Unsaved inspector draft on <code>{currentRoute}</code>. Discard
              changes and switch to <code>{pendingRouteSwitch}</code>?
            </p>
            <div className="route-draft-actions">
              <button
                type="button"
                disabled={busy || switchingRoute}
                onClick={() => void executeRouteSwitch(pendingRouteSwitch)}
              >
                Discard and switch
              </button>
              <button
                type="button"
                disabled={busy || switchingRoute}
                onClick={() => setPendingRouteSwitch(null)}
              >
                Keep editing
              </button>
            </div>
          </div>
        ) : null}
        <p className="field-note">Current preview route</p>
        <div className="navigator-section">
          <h2>Layers</h2>
          <LayerTree
            layers={bridge.layers}
            selected={selected}
            selectionVersion={selection.current}
            sourceLabel={
              source
                ? `${source.path}:${source.location.start.line}`
                : undefined
            }
            onSelect={(id) => {
              requestedLayer.current = id;
              bridge.selectLayer(id);
            }}
          />
        </div>
      </aside>
      <div className="editor-workspace">
        <section ref={canvas} className="studio-canvas" aria-label="Canvas">
          <ViewportControls
            width={viewportWidth}
            scope={scope}
            manual={manualScope}
            zoom={zoom}
            disabled={busy || switchingRoute || pending !== null}
            onWidth={(width) =>
              switchContext({
                width,
                scope: breakpointForWidth(width),
                manual: false,
              })
            }
            onScope={(scope) =>
              switchContext({ width: viewportWidth, scope, manual: true })
            }
            onZoom={setZoom}
          />
          {pendingContext ? (
            <div
              role="alert"
              aria-label="Unsaved responsive draft confirmation"
              className="route-draft-confirm"
            >
              <p>
                Discard the unapplied design draft before changing width or edit
                scope? Text drafts are retained.
              </p>
              <button
                type="button"
                onClick={() => switchContext(pendingContext, true)}
              >
                Discard design draft
              </button>
              <button type="button" onClick={() => setPendingContext(null)}>
                Keep responsive editing
              </button>
            </div>
          ) : null}
          <div className="canvas-label">
            Live preview · {viewportWidth}px × {viewportHeight}px ·{" "}
            {Math.round(scale * 100)}% · Edit{" "}
            {scope === "base" ? "Base" : scope}
          </div>
          <div
            className="preview-stage"
            style={{
              width: viewportWidth * scale,
              height: viewportHeight * scale,
            }}
          >
            <div
              className="preview-pane"
              style={{
                width: viewportWidth,
                height: viewportHeight,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              <iframe
                key={frameKey}
                ref={frame}
                className="preview-frame"
                style={{ height: viewportHeight }}
                title="Project preview"
                src={currentPreviewUrl}
                sandbox="allow-scripts allow-same-origin allow-forms"
                onLoad={bridge.handleFrameLoad}
              />
              {rect ? (
                <div
                  ref={selectionBox}
                  className="selection-box"
                  aria-hidden="true"
                  style={{
                    left: rect.x,
                    top: rect.y,
                    width: rect.width,
                    height: rect.height,
                  }}
                />
              ) : null}
            </div>
          </div>
        </section>
        <aside className="inspector" aria-label="Selection">
          <h2>Design</h2>
          <p className="field-note">
            Source edit scope: {scope === "base" ? "Base" : scope}. Preview
            width and source scope are separate. Unset values do not imply
            inheritance.
          </p>
          {scope !== "base" && responsive.status !== "supported-defaults" ? (
            <output>
              Scoped property edits are unavailable: default project breakpoints
              could not be validated. Base edits remain available.
            </output>
          ) : null}
          <p className="bridge-status">
            Preview bridge: {bridge.connected ? "connected" : "connecting…"}
            {bridge.lastRejection
              ? ` · rejected a preview message (${bridge.lastRejection})`
              : ""}
          </p>
          {selected ? (
            <dl>
              <dt>Element</dt>
              <dd>
                <code>&lt;{selected.tagName}&gt;</code> data-oid{" "}
                <code>{selected.oid}</code>
              </dd>
              {source ? (
                <>
                  <dt>Source</dt>
                  <dd>
                    <code data-testid="source-location">
                      {source.path}:{source.location.start.line}–
                      {source.location.end.line}
                    </code>
                    {source.location.component
                      ? ` in ${source.location.component}`
                      : ""}
                  </dd>
                </>
              ) : null}
            </dl>
          ) : (
            <p>Click an element in the preview to select it.</p>
          )}
          <TypographyInspector
            scope={scope}
            key={`${selection.current}-${contextVersion}`}
            className={classDraft}
            sourceKnown={Boolean(source?.className.ok)}
            rendered={selected?.typography ?? null}
            disabled={!designEditable}
            applyDisabled={!spacingValid || !appearanceValid || !layoutValid}
            onValidityChange={setTypographyValid}
            onChange={(value) => {
              setClassDraft(value);
              setDiff("");
              setStatus(null);
            }}
            onPreview={() => void edit("className", false, true)}
            onApply={() => void edit("className", true, true)}
          />
          <SpacingInspector
            scope={scope}
            key={`spacing-${selection.current}-${contextVersion}`}
            className={classDraft}
            sourceKnown={Boolean(source?.className.ok)}
            rendered={selected?.spacing ?? null}
            disabled={!designEditable}
            applyDisabled={!typographyValid || !appearanceValid || !layoutValid}
            onValidityChange={setSpacingValid}
            onChange={(value) => {
              setClassDraft(value);
              setDiff("");
              setStatus(null);
            }}
            onPreview={() => void edit("className", false, true)}
            onApply={() => void edit("className", true, true)}
          />
          <AppearanceInspector
            scope={scope}
            key={`appearance-${selection.current}-${contextVersion}`}
            className={classDraft}
            sourceKnown={Boolean(source?.className.ok)}
            rendered={selected?.appearance ?? null}
            disabled={!designEditable}
            applyDisabled={!typographyValid || !spacingValid || !layoutValid}
            onValidityChange={setAppearanceValid}
            onChange={(value) => {
              setClassDraft(value);
              setDiff("");
              setStatus(null);
            }}
            onPreview={() => void edit("className", false, true)}
            onApply={() => void edit("className", true, true)}
          />
          <LayoutInspector
            scope={scope}
            key={`layout-${selection.current}-${contextVersion}`}
            className={classDraft}
            sourceKnown={Boolean(source?.className.ok)}
            rendered={selected?.layout ?? null}
            disabled={!designEditable}
            applyDisabled={
              !typographyValid || !spacingValid || !appearanceValid
            }
            onValidityChange={setLayoutValid}
            onChange={(value) => {
              setClassDraft(value);
              setDiff("");
              setStatus(null);
            }}
            onPreview={() => void edit("className", false, true)}
            onApply={() => void edit("className", true, true)}
          />
          <label className="text-field">
            Text
            <input
              type="text"
              value={draft}
              disabled={!textEditable}
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
          {source && !source.text.ok ? (
            <p className="field-note">
              {describeSourceEditFailure(source.text.reason)}
            </p>
          ) : null}
          <div className="actions">
            <button
              type="button"
              disabled={!textEditable}
              onClick={() => void edit("text", false)}
            >
              Preview text patch
            </button>
            <button
              type="button"
              disabled={!textEditable}
              onClick={() => void edit("text", true)}
            >
              Apply text
            </button>
          </div>
          <label className="text-field">
            Classes
            <input
              type="text"
              value={classDraft}
              disabled={!classEditable}
              spellCheck={false}
              onChange={(event) => setClassDraft(event.target.value)}
            />
          </label>
          {source && !source.className.ok ? (
            <p className="field-note">
              {describeSourceEditFailure(source.className.reason)}
            </p>
          ) : null}
          <div className="actions">
            <button
              type="button"
              disabled={!classEditable}
              onClick={() => void edit("className", false)}
            >
              Preview class patch
            </button>
            <button
              type="button"
              disabled={!classEditable}
              onClick={() => void edit("className", true)}
            >
              Apply classes
            </button>
          </div>
          {status ? (
            <p
              className={`status status-${status.kind}`}
              role={status.kind === "error" ? "alert" : "status"}
            >
              {status.text}
            </p>
          ) : null}
          {diff ? (
            <pre className="diff" title="Source diff">
              {diff}
            </pre>
          ) : null}
        </aside>
      </div>
    </>
  );
}
