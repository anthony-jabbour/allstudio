import type { ProjectManifestV1 } from "@allstudio/project";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PreviewElementSnapshot } from "../preview-bridge/protocol.ts";
import {
  describeSourceEditFailure,
  type SourceEditWorkspace,
  type SourceElementInfo,
} from "../site/source-edit-workspace.ts";
import { usePreviewBridge } from "./use-preview-bridge.ts";

export const EDITOR_STATUS = "text-and-class-edit-slice" as const;

/** How long to wait for hot reload before reloading the preview once. */
const REFRESH_TIMEOUT_MS = 10_000;

export interface EditorShellProps {
  manifest?: ProjectManifestV1;
  /** Live preview of the workspace project, served from its own origin. */
  previewUrl?: string;
  workspace?: SourceEditWorkspace;
}

type Status = { kind: "info" | "success" | "error"; text: string } | null;

type EditKind = "text" | "className";

interface PendingRefresh {
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
  return normalizeWhitespace(rendered) === normalizeWhitespace(pending.value);
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
}: EditorShellProps) {
  return (
    <main className="editor-shell">
      <header className="editor-header">
        <p>allstudio playground</p>
        <h1>Source editing</h1>
        <p>
          Shared editor package status: {EDITOR_STATUS}. Select a rendered
          element, edit its static text or its static className, and the JSX
          source file is updated. Layout dragging and structure editing are not
          implemented yet.
        </p>
        {manifest ? (
          <p>
            Loaded project: {manifest.name} ({manifest.projectId})
          </p>
        ) : (
          <p>No project manifest loaded.</p>
        )}
      </header>
      {previewUrl && workspace ? (
        <SourceElementEditor previewUrl={previewUrl} workspace={workspace} />
      ) : (
        <p>No preview workspace connected.</p>
      )}
    </main>
  );
}

function SourceElementEditor({
  previewUrl,
  workspace,
}: {
  previewUrl: string;
  workspace: SourceEditWorkspace;
}) {
  const previewOrigin = new URL(previewUrl).origin;
  const frame = useRef<HTMLIFrameElement | null>(null);
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
      if (pending && element && previewShows(element, pending)) {
        setPending(null);
        // Report success only once the source details are refreshed, so
        // the message also means the panel reflects the saved file. Editing
        // stays disabled until then, and a newer edit or selection wins.
        const { kind, run } = pending;
        void locate(oid, "refresh").then((refreshed) => {
          if (run !== editRun.current) {
            return;
          }
          setBusy(false);
          if (refreshed) {
            setStatus({
              kind: "success",
              text: `Saved to ${refreshed.path} and the preview shows the new ${KIND_LABEL[kind]}.`,
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
        text: `The file was saved, but the preview did not show the new ${KIND_LABEL[pending.kind]}. Check the preview server log.`,
      });
    }, REFRESH_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);

  const textEditable = Boolean(source?.text.ok) && !busy;
  const classEditable = Boolean(source?.className.ok) && !busy;

  const edit = async (kind: EditKind, apply: boolean) => {
    if (!source || !selected) {
      return;
    }
    const selectionAtStart = selection.current;
    const run = ++editRun.current;
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
      oid: selected.oid,
      kind,
      value: kind === "text" ? draft : classDraft,
      reloaded: false,
      run,
    });
    bridge.track(selected.oid);
  };

  const rect = selected?.rect;

  return (
    <div className="editor-workspace">
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
      <aside className="inspector" aria-label="Selection">
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
  );
}
