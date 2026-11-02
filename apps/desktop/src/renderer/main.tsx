import {
  EditorShell,
  type SourceEditWorkspace,
  WorkspaceHome,
} from "@allstudio/editor/shell";
import { StrictMode, useCallback, useEffect, useMemo, useState } from "react";
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
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">(() => {
    try {
      return localStorage.getItem("allstudio:project-view") === "list"
        ? "list"
        : "grid";
    } catch {
      return "grid";
    }
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Choose a local project. Applying an edit saves it to disk.",
  );
  const [session, setSession] = useState(0);
  const projectId = project?.id;
  const capturePreview = useCallback(() => {
    if (!projectId) return;
    const rect = document
      .querySelector<HTMLIFrameElement>('iframe[title="Project preview"]')
      ?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height >= 120)
      void window.allstudio.captureProjectPreview(projectId, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      });
  }, [projectId]);
  useEffect(() => {
    window.allstudio
      .runtime()
      .then(setRuntime)
      .catch(() => setError(true));
    window.allstudio
      .recent()
      .then((items) => {
        setRecent(items);
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
      listAssets: () => window.allstudio.listAssets(id),
      previewAssetEdit: (request) =>
        window.allstudio.previewAssetEdit(id, request),
      applyAssetEdit: (request) => window.allstudio.applyAssetEdit(id, request),
      locate: (oid) => window.allstudio.locate(id, oid),
      previewTextEdit: (request) =>
        window.allstudio.previewTextEdit(id, request),
      applyTextEdit: (request) => window.allstudio.applyTextEdit(id, request),
      previewClassEdit: (request) =>
        window.allstudio.previewClassEdit(id, request),
      applyClassEdit: (request) => window.allstudio.applyClassEdit(id, request),
      previewReorder: (request) => window.allstudio.previewReorder(id, request),
      applyReorder: (request) => window.allstudio.applyReorder(id, request),
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
          project ? (
            <>
              <nav className="project-toolbar" aria-label="Local project">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void open(() => window.allstudio.closeProject())
                  }
                >
                  Close project
                </button>
                <button
                  type="button"
                  disabled={busy || !recent[0]}
                  onClick={() =>
                    recent[0] &&
                    void open(() => window.allstudio.openRecent(recent[0].id))
                  }
                >
                  Reopen
                </button>
                <button
                  type="button"
                  disabled={busy}
                  aria-label="Open project"
                  onClick={() =>
                    void open(() => window.allstudio.chooseProject())
                  }
                >
                  Open another project
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
          ) : undefined
        }
        homeContent={
          <WorkspaceHome
            sidebarLabel="Workspace navigation"
            sidebarHeader={
              <div className="home-workspace-name">Local workspace</div>
            }
            sidebarNote={
              <p className="home-sidebar-note">
                Local files stay on this computer.
              </p>
            }
            search={search}
            searchLabel="Search projects"
            searchPlaceholder="Search projects…"
            onSearchChange={setSearch}
            sections={[
              {
                label: "Primary",
                items: [
                  {
                    label: "Recents",
                    icon: <span aria-hidden="true">◷</span>,
                    current: true,
                  },
                ],
              },
            ]}
            title="Recents"
            regionLabel="Recent local projects"
            actions={
              <>
                <button
                  type="button"
                  disabled={busy || !recent[0]}
                  onClick={() =>
                    recent[0] &&
                    void open(() => window.allstudio.openRecent(recent[0].id))
                  }
                >
                  Reopen
                </button>
                <button
                  type="button"
                  className="home-open-button"
                  aria-label="Open project"
                  disabled={busy}
                  onClick={() =>
                    void open(() => window.allstudio.chooseProject())
                  }
                >
                  ＋ Open project
                </button>
              </>
            }
            status={
              message !==
                "Choose a local project. Applying an edit saves it to disk." &&
              message !== "Project closed."
                ? message
                : undefined
            }
            items={recent.map((item) => ({
              id: item.id,
              name: item.name,
              detail:
                item.path.split(/[\\/]/).filter(Boolean).at(-1) ??
                "Local project",
              searchText: `${item.name} ${item.path}`,
              preview: item.thumbnail ? (
                // biome-ignore lint/performance/noImgElement: This is a bounded local JPEG thumbnail in the Electron shell.
                <img src={item.thumbnail} alt={`Preview of ${item.name}`} />
              ) : (
                <span>Open project to create a preview</span>
              ),
              onOpen: () =>
                void open(() => window.allstudio.openRecent(item.id)),
            }))}
            view={view}
            onViewChange={(nextView) => {
              setView(nextView);
              try {
                localStorage.setItem("allstudio:project-view", nextView);
              } catch {}
            }}
            busy={busy}
            emptyMessage="Open a local Next.js project to start editing its real source."
            noResultsMessage="No projects match your search."
          />
        }
        onPreviewCapture={capturePreview}
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
