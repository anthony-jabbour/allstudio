import type { ProjectManifestV1 } from "@allstudio/project";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PreviewElementSnapshot } from "../preview-bridge/protocol.ts";
import {
  describeSourceEditFailure,
  type SourceEditWorkspace,
  type SourceElementInfo,
} from "../site/source-edit-workspace.ts";
import { LayerTree } from "./layer-tree.tsx";
import {
  observesTypography,
  type TypographyTarget,
  typographyTargets,
} from "./typography-confirmation.ts";
import { TypographyInspector } from "./typography-inspector.tsx";
import { usePreviewBridge } from "./use-preview-bridge.ts";

export const EDITOR_STATUS = "text-and-class-edit-slice" as const;

/** How long to wait for hot reload before reloading the preview once. */
const REFRESH_TIMEOUT_MS = 10_000;

export interface EditorShellProps {
  manifest?: ProjectManifestV1;
  /** Live preview of the workspace project, served from its own origin. */
  previewUrl?: string;
  workspace?: SourceEditWorkspace;
  projectControls?: import("react").ReactNode;
  homeContent?: import("react").ReactNode;
  disabled?: boolean;
}

type Status = { kind: "info" | "success" | "error"; text: string } | null;

type EditKind = "text" | "className";

interface PendingRefresh {
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
      observesTypography(element.typography, pending.typography))
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
  navigatorOpen,
}: {
  previewUrl: string;
  workspace: SourceEditWorkspace;
  navigatorOpen: boolean;
}) {
  const previewOrigin = new URL(previewUrl).origin;
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
  const [pending, setPending] = useState<PendingRefresh | null>(null);
  const request = useRef(0);
  // Bumped on every selection so late edit responses for an older
  // selection are ignored.
  const selection = useRef(0);
  // Bumped on every edit and selection. A save confirmation only reports
  // success if no newer edit or selection started since that save.
  const editRun = useRef(0);
  const applying = useRef<number | null>(null);

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
            ? `This source element renders ${element.instances} times. Editing one instance is not supported.`
            : "The selected element is no longer available. Select it again.",
        });
        return;
      }
      if (pending && element && previewShows(element, pending)) {
        setPending(null);
        // Report success only once the source details are refreshed, so
        // the message also means the panel reflects the saved file. Editing
        // stays disabled until then, and a newer edit or selection wins.
        const { kind, run, typography } = pending;
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
              text: typography?.length
                ? `Saved typography to ${refreshed.path}; observed the requested properties in the preview.`
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
    const poll = pending.typography?.length
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
        text: pending.typography?.length
          ? "Typography source saved, but rendering is unconfirmed or unchanged at this viewport. Other CSS or responsive rules may apply. Undo remains available."
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

  const edit = async (kind: EditKind, apply: boolean, typography = false) => {
    if (!source || !selected) {
      return;
    }
    let targets: TypographyTarget[] | undefined;
    if (typography && apply) {
      const before = source.className.ok ? (source.className.value ?? "") : "";
      const result = typographyTargets(before, classDraft, selected.typography);
      if (!result.ok) {
        setStatus({ kind: "error", text: result.message });
        return;
      }
      if (!result.targets.length && before !== classDraft) {
        setStatus({
          kind: "info",
          text: "No supported typography setting changed. Review the draft in Classes.",
        });
        return;
      }
      targets = result.targets;
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
            { ...target, className: classDraft },
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
        <p className="current-page">
          <span aria-hidden="true">▤</span> {new URL(previewUrl).pathname}
        </p>
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
        <section className="studio-canvas" aria-label="Canvas">
          <div className="canvas-label">Live preview · Desktop · 1440px</div>
          <div className="preview-pane">
            <iframe
              key={frameKey}
              ref={frame}
              className="preview-frame"
              title="Project preview"
              src={previewUrl}
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
        </section>
        <aside className="inspector" aria-label="Selection">
          <h2>Design</h2>
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
            key={selection.current}
            className={classDraft}
            sourceKnown={Boolean(source?.className.ok)}
            rendered={selected?.typography ?? null}
            disabled={!classEditable}
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
