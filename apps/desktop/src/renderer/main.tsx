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
import "@allstudio/editor/studio.css";
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
  const [search, setSearch] = useState("");
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
      selectRoute: (route) => window.allstudio.selectRoute(id, route),
      getResponsiveCapabilities: () =>
        window.allstudio.getResponsiveCapabilities(id),
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
    <div className="desktop-app">
      <EditorShell
        disabled={busy}
        key={`${project?.id ?? "closed"}:${session}`}
        projectControls={
          <>
            <nav className="project-toolbar" aria-label="Local project">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void open(() => window.allstudio.chooseProject())
                }
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
                onClick={() =>
                  void open(() => window.allstudio.openRecent(recentId))
                }
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
          </>
        }
        homeContent={
          <div className="workspace-home">
            <aside className="home-sidebar">
              <h2>Workspace</h2>
              <p className="current-page">Recent projects</p>
              <p className="field-note">Your files stay on this computer.</p>
            </aside>
            <section
              className="home-projects"
              aria-label="Recent local projects"
            >
              <div className="home-heading">
                <h2>Recents</h2>
                <label>
                  Search projects
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search local projects…"
                  />
                </label>
              </div>
              <div className="project-grid">
                {recent
                  .filter((item) =>
                    `${item.name} ${item.path}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((item) => (
                    <button
                      className="project-card"
                      key={item.id}
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void open(() => window.allstudio.openRecent(item.id))
                      }
                    >
                      <span className="project-card-title">{item.name}</span>
                      <span className="project-card-path">{item.path}</span>
                      <span className="project-card-art" aria-hidden="true">
                        ▤
                      </span>
                      <span className="project-card-open">Open project →</span>
                    </button>
                  ))}
              </div>
              {!recent.length ? (
                <p className="home-empty">
                  Open a local Next.js project to start. Your recent projects
                  will appear here.
                </p>
              ) : recent.every(
                  (item) =>
                    !`${item.name} ${item.path}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                ) ? (
                <p className="home-empty">No projects match your search.</p>
              ) : null}
            </section>
          </div>
        }
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
        routes={project?.routes}
        unsupportedRoutes={project?.unsupportedRoutes}
        activeRoute={project?.activeRoute}
        workspace={workspace}
      />
      <footer className="desktop-status">
        <output>
          {error
            ? "Desktop connection failed."
            : runtime
              ? `Electron ${runtime.electron} · ${runtime.packaged ? "Packaged" : "Development"} · Local editor`
              : "Connecting to desktop…"}
        </output>
        <span>
          Manual editing is local. BYOK model requests require internet.
        </span>
      </footer>
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
