import { EditorShell, type SourceEditWorkspace } from "@allstudio/editor/shell";
import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  DesktopApi,
  OpenProject,
  ProjectResult,
  RecentProject,
  RuntimeInfo,
} from "../shared/desktop-api.ts";
import "../../../playground/src/styles.css";
import "./styles.css";

declare global {
  interface Window {
    allstudio: DesktopApi;
  }
}

function App() {
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [error, setError] = useState(false);
  const [project, setProject] = useState<OpenProject | null>(null);
  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [recentId, setRecentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Choose a local project. Applying an edit saves it to disk.",
  );
  const [session, setSession] = useState(0);
  useEffect(() => {
    window.allstudio
      .runtime()
      .then(setRuntime)
      .catch(() => setError(true));
    window.allstudio
      .recent()
      .then((items) => {
        setRecent(items);
        setRecentId(items[0]?.id ?? "");
      })
      .catch(() =>
        setMessage(
          "Recent projects could not be read. No stored grants were changed.",
        ),
      );
    return window.allstudio.onChange(setMessage);
  }, []);
  const workspace = useMemo<SourceEditWorkspace | undefined>(() => {
    if (!project) return undefined;
    const id = project.id;
    return {
      locate: (oid) => window.allstudio.locate(id, oid),
      previewTextEdit: (request) =>
        window.allstudio.previewTextEdit(id, request),
      applyTextEdit: (request) => window.allstudio.applyTextEdit(id, request),
      previewClassEdit: (request) =>
        window.allstudio.previewClassEdit(id, request),
      applyClassEdit: (request) => window.allstudio.applyClassEdit(id, request),
    };
  }, [project]);
  async function open(task: () => Promise<ProjectResult>) {
    setBusy(true);
    setMessage("Opening project…");
    try {
      const result = await task();
      if (!result.ok) {
        setProject((current) =>
          current?.id === result.project?.id ? current : result.project,
        );
        setMessage(result.message);
        return;
      }
      if (result.unchanged) {
        setMessage("Current project kept.");
        return;
      }
      setProject(result.project);
      setSession((value) => value + 1);
      setMessage(
        result.project
          ? "Local project opened. Applying an edit saves the original source."
          : "Project closed.",
      );
      const items = await window.allstudio.recent();
      setRecent(items);
      setRecentId(items[0]?.id ?? "");
    } catch {
      setMessage(
        "The local operation failed. Project files and recovery data were retained.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function history(redo: boolean) {
    if (!project) return;
    setBusy(true);
    try {
      const result = await (redo
        ? window.allstudio.redo(project.id)
        : window.allstudio.undo(project.id));
      setMessage(
        result.ok
          ? result.noop
            ? "No saved edit to undo or redo."
            : "Saved edit updated. Reselect an element to continue editing."
          : result.message,
      );
    } catch {
      setMessage(
        "The history operation could not be confirmed. Recovery data was retained.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page">
      <output>
        {error
          ? "Desktop connection failed."
          : runtime
            ? `Electron ${runtime.electron} · ${runtime.packaged ? "Packaged" : "Development"} · Local editor`
            : "Connecting to desktop…"}
      </output>
      <p className="project-path">
        Manual editing is local and requires no account. BYOK model requests
        require an internet connection.
      </p>
      <nav className="project-toolbar" aria-label="Local project">
        <button
          type="button"
          disabled={busy}
          onClick={() => void open(() => window.allstudio.chooseProject())}
        >
          Open project
        </button>
        <label>
          Recent projects
          <select
            value={recentId}
            disabled={busy || !recent.length}
            onChange={(event) => setRecentId(event.target.value)}
          >
            {!recent.length ? (
              <option value="">No recent projects</option>
            ) : (
              recent.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))
            )}
          </select>
        </label>
        <button
          type="button"
          disabled={busy || !recentId}
          onClick={() => void open(() => window.allstudio.openRecent(recentId))}
        >
          Reopen
        </button>
        <button
          type="button"
          disabled={busy || !project}
          onClick={() => void open(() => window.allstudio.closeProject())}
        >
          Close project
        </button>
        <button
          type="button"
          disabled={busy || !project}
          onClick={() => void history(false)}
        >
          Undo saved edit
        </button>
        <button
          type="button"
          disabled={busy || !project}
          onClick={() => void history(true)}
        >
          Redo saved edit
        </button>
      </nav>
      <output className="project-status">{message}</output>
      {project ? <p className="project-path">{project.path}</p> : null}
      <div inert={busy}>
        <EditorShell
          key={`${project?.id ?? "closed"}:${session}`}
          manifest={
            project
              ? {
                  schemaVersion: 1,
                  projectId: project.id,
                  name: project.name,
                  artifacts: [{ id: "site", kind: "site", path: "src" }],
                  sourceFramework: "nextjs-react",
                  createdAt: new Date().toISOString(),
                }
              : undefined
          }
          previewUrl={project?.previewUrl}
          workspace={workspace}
        />
      </div>
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Desktop root element #root was not found.");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
