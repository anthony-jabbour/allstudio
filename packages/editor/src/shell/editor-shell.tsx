import type { ProjectManifestV1 } from "@allstudio/project";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PreviewElementSnapshot } from "../preview-bridge/protocol.ts";
import {
  describeSourceEditFailure,
  type SourceEditWorkspace,
  type SourceElementInfo,
} from "../site/source-edit-workspace.ts";
import { usePreviewBridge } from "./use-preview-bridge.ts";

export const EDITOR_STATUS = "text-edit-slice" as const;

/** How long to wait for hot reload before reloading the preview once. */
const REFRESH_TIMEOUT_MS = 10_000;

export interface EditorShellProps {
  manifest?: ProjectManifestV1;
  /** Live preview of the workspace project, served from its own origin. */
  previewUrl?: string;
  workspace?: SourceEditWorkspace;
}

type Status = { kind: "info" | "success" | "error"; text: string } | null;

interface PendingRefresh {
  oid: string;
  text: string;
  reloaded: boolean;
}

function normalizeRenderedText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function EditorShell({
  manifest,
  previewUrl,
  workspace,
}: EditorShellProps) {
  return (
    <main className="editor-shell">
      <header className="editor-header">
        <p>allstudio playground</p>
        <h1>Source text editing</h1>
        <p>
          Shared editor package status: {EDITOR_STATUS}. Select a rendered
          element, edit its static text, and the JSX source file is updated.
          Layout, style, and structure editing are not implemented yet.
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
        <SourceTextEditor previewUrl={previewUrl} workspace={workspace} />
      ) : (
        <p>No preview workspace connected.</p>
      )}
    </main>
  );
}

function SourceTextEditor({
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
  const [diff, setDiff] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingRefresh | null>(null);
  const request = useRef(0);

  const locate = useCallback(
    async (oid: string, keepStatus = false) => {
      const id = ++request.current;
      const result = await workspace.locate(oid);
      if (id !== request.current) {
        return;
      }
      if (!result.ok) {
        setSource(null);
        setStatus({ kind: "error", text: result.message });
        return;
      }
      setSource(result.element);
      setDraft(result.element.text.ok ? result.element.text.text : "");
      if (!result.element.text.ok) {
        setStatus({
          kind: "error",
          text: describeSourceEditFailure(result.element.text.reason),
        });
      } else if (!keepStatus) {
        setStatus(null);
      }
    },
    [workspace],
  );

  const bridge = usePreviewBridge(frame, previewOrigin, {
    onSelect(clickedTag, element) {
      setDiff("");
      setPending(null);
      setSelected(element);
      if (!element) {
        request.current += 1;
        setSource(null);
        setStatus({
          kind: "error",
          text: `No source mapping: the clicked <${clickedTag || "?"}> has no data-oid element around it.`,
        });
        return;
      }
      if (element.instances > 1) {
        request.current += 1;
        setSource(null);
        setStatus({
          kind: "error",
          text: `This source element renders ${element.instances} times (e.g. in a list). Editing one instance is not supported.`,
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
      if (
        pending &&
        element &&
        normalizeRenderedText(element.text) ===
          normalizeRenderedText(pending.text)
      ) {
        setPending(null);
        setStatus({
          kind: "success",
          text: `Saved to ${source?.path ?? "source"} and the preview shows the new text.`,
        });
        void locate(oid, true);
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
      setStatus({
        kind: "error",
        text: "The file was saved, but the preview did not show the new text. Check the preview server log.",
      });
    }, REFRESH_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);

  const editable = Boolean(source?.text.ok) && !busy;

  const edit = async (apply: boolean) => {
    if (!source || !selected) {
      return;
    }
    setBusy(true);
    const requestBody = {
      path: source.path,
      oid: selected.oid,
      expectedSha256: source.sha256,
      text: draft,
    };
    const result = apply
      ? await workspace.applyTextEdit(requestBody)
      : await workspace.previewTextEdit(requestBody);
    setBusy(false);
    if (!result.ok) {
      setStatus({ kind: "error", text: result.message });
      return;
    }
    setDiff(result.diff);
    if (result.noop) {
      setStatus({
        kind: "info",
        text: "No change: the text already matches. The file was not rewritten.",
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
      text: { ok: true, text: draft },
    });
    setStatus({
      kind: "info",
      text: `Saved to ${source.path}. Waiting for the preview to refresh…`,
    });
    setPending({ oid: selected.oid, text: draft, reloaded: false });
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
            disabled={!editable}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        <div className="actions">
          <button
            type="button"
            disabled={!editable}
            onClick={() => void edit(false)}
          >
            Preview patch
          </button>
          <button
            type="button"
            disabled={!editable}
            onClick={() => void edit(true)}
          >
            Apply
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
