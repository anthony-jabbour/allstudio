import { BOARD_TEMPLATES } from "@allstudio/editor/board";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useFileActions } from "../files/file-actions.tsx";
import { FileCard } from "../files/file-card.tsx";
import { formatEdited, type StudioFile } from "../files/file-store.ts";
import { useFileStore, useFiles } from "../files/use-files.ts";
import { href, navigate, type Route } from "../router.ts";
import { Menu, useToast } from "../ui/controls.tsx";
import { Icon } from "../ui/icons.tsx";
import type { ThemePreference } from "../ui/theme.ts";

type Section = Extract<Route, { name: "home" }>["section"];
type View = "grid" | "list";

const TITLES: Record<Section, string> = {
  recents: "Recents",
  files: "Files",
  archive: "Archive",
  settings: "Settings",
};

function readView(): View {
  try {
    return window.localStorage.getItem("allstudio.view") === "list"
      ? "list"
      : "grid";
  } catch {
    return "grid";
  }
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "A"
  );
}

export function WebsiteEditorEntry({
  onOpen,
  className = "nav-item",
}: {
  onOpen: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      aria-label="Website projects"
      onClick={onOpen}
    >
      <Icon.Studio />
      <span>Website projects</span>
    </button>
  );
}

/** Paper-inspired file home: quiet sidebar, large title, real file cards. */
export function Home({
  section,
  theme,
  onTheme,
  onOpenWebsiteEditor,
}: {
  section: Section;
  theme: ThemePreference;
  onTheme: (theme: ThemePreference) => void;
  onOpenWebsiteEditor?: () => void;
}) {
  const files = useFiles();
  const store = useFileStore();
  const actions = useFileActions();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>(readView);
  const [dragging, setDragging] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const now = new Date();
  const settings = store.settings();
  const owner = settings.displayName || "Local studio";

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let list: StudioFile[] =
      section === "archive"
        ? files.filter((file) => file.archived)
        : files.filter((file) => !file.archived);
    if (section === "files") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (section === "recents") {
      // Scratchpad leads Recents, like a pinned permanent draft.
      list = [
        ...list.filter((file) => file.permanent),
        ...list.filter((file) => !file.permanent),
      ];
    }
    return needle
      ? list.filter((file) => file.name.toLowerCase().includes(needle))
      : list;
  }, [files, query, section]);

  const changeView = (next: View) => {
    setView(next);
    try {
      window.localStorage.setItem("allstudio.view", next);
    } catch {
      // Not persisted when storage is blocked.
    }
  };

  const nav = (target: Section, icon: ReactNode, count?: number) => (
    <a
      className={section === target ? "nav-item active" : "nav-item"}
      href={href({ name: "home", section: target })}
      aria-current={section === target ? "page" : undefined}
    >
      {icon}
      <span>{TITLES[target]}</span>
      {count ? <span className="nav-count">{count}</span> : null}
    </a>
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: file drop target; the Import file button is the keyboard path
    <div
      className="home"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void actions.importFiles(event.dataTransfer.files);
      }}
    >
      <aside className="home-sidebar" aria-label="Files navigation">
        <Menu
          label="Account and appearance"
          className="account"
          align="start"
          trigger={
            <>
              <span className="avatar" aria-hidden="true">
                {initials(owner)}
              </span>
              <span className="account-name">{owner}</span>
              <Icon.Chevron />
            </>
          }
          items={[
            {
              label: "System theme",
              icon: <Icon.Monitor />,
              shortcut: theme === "system" ? "✓" : undefined,
              onSelect: () => onTheme("system"),
            },
            {
              label: "Light theme",
              icon: <Icon.Sun />,
              shortcut: theme === "light" ? "✓" : undefined,
              onSelect: () => onTheme("light"),
            },
            {
              label: "Dark theme",
              icon: <Icon.Moon />,
              shortcut: theme === "dark" ? "✓" : undefined,
              onSelect: () => onTheme("dark"),
            },
            "separator",
            {
              label: "Settings",
              icon: <Icon.Settings />,
              onSelect: () => navigate({ name: "home", section: "settings" }),
            },
          ]}
        />
        <label className="search">
          <Icon.Search />
          <input
            ref={search}
            type="search"
            placeholder="Search"
            aria-label="Search files"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd>⌘F</kbd>
        </label>
        <nav className="nav-group" aria-label="Primary">
          {nav("recents", <Icon.Clock />)}
          <a
            className="nav-item"
            href={href({ name: "studio", section: "home" })}
          >
            <Icon.Studio />
            <span>Studio home</span>
            <span className="dot" aria-hidden="true" />
          </a>
          {onOpenWebsiteEditor ? (
            <WebsiteEditorEntry onOpen={onOpenWebsiteEditor} />
          ) : null}
        </nav>
        <div className="sidebar-divider" />
        <nav className="nav-group" aria-label="Local workspace">
          <div className="nav-heading">
            <Icon.Folder />
            <span>
              {settings.displayName ? `${owner}'s studio` : "This device"}
            </span>
            <span className="pill">Local</span>
          </div>
          {nav("files", <Icon.Grid />)}
          {nav(
            "archive",
            <Icon.Archive />,
            files.filter((file) => file.archived).length,
          )}
          {nav("settings", <Icon.Settings />)}
        </nav>
        <section className="sidebar-card" aria-label="Local files">
          <h2>Your files stay on this device</h2>
          <p>
            Nothing is uploaded. Export a file to share it, or import a
            <code>.board.json</code> here.
          </p>
          <button
            type="button"
            className="button secondary block"
            onClick={actions.chooseImport}
          >
            <Icon.Upload /> Import file
          </button>
        </section>
        <div className="sidebar-spacer" />
        <a
          className="sidebar-cta"
          href={href({ name: "studio", section: "home" })}
        >
          <Icon.Studio /> Open Studio
        </a>
        <footer className="sidebar-footer">
          <a href={href({ name: "studio", section: "templates" })}>Templates</a>
          <span aria-hidden="true">·</span>
          <a href={href({ name: "home", section: "archive" })}>Archive</a>
        </footer>
      </aside>

      <main className="home-main">
        <header className="home-header">
          <h1>{TITLES[section]}</h1>
          {section !== "settings" ? (
            <div className="home-actions">
              <Menu
                label="New file"
                className="button primary"
                trigger={
                  <>
                    <Icon.Plus /> New file
                  </>
                }
                items={BOARD_TEMPLATES.map((template) => ({
                  label: template.name,
                  icon:
                    template.id === "blank" ? <Icon.File /> : <Icon.Template />,
                  onSelect: () => actions.createFrom(template.id),
                }))}
              />
              {/* biome-ignore lint/a11y/useSemanticElements: compact toggle group */}
              <div className="segmented" role="group" aria-label="View">
                <button
                  type="button"
                  aria-label="Grid view"
                  aria-pressed={view === "grid"}
                  onClick={() => changeView("grid")}
                >
                  <Icon.Grid />
                </button>
                <button
                  type="button"
                  aria-label="List view"
                  aria-pressed={view === "list"}
                  onClick={() => changeView("list")}
                >
                  <Icon.List />
                </button>
              </div>
            </div>
          ) : null}
        </header>

        {section === "settings" ? (
          <Settings theme={theme} onTheme={onTheme} />
        ) : shown.length === 0 ? (
          <div className="empty">
            <Icon.File size={28} />
            <h2>
              {query
                ? `No files match “${query}”`
                : section === "archive"
                  ? "Archive is empty"
                  : "No files yet"}
            </h2>
            <p>
              {section === "archive"
                ? "Archived files appear here and can be restored or deleted."
                : "Create a file from a template, or drop a .board.json here."}
            </p>
          </div>
        ) : view === "grid" ? (
          <div className="file-grid">
            {shown.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                now={now}
                onOpen={actions.open}
                menu={actions.menu(file)}
              />
            ))}
          </div>
        ) : (
          <table className="file-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Edited</th>
                <th scope="col">Created</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((file) => (
                <tr
                  key={file.id}
                  data-file-id={file.id}
                  onDoubleClick={() => actions.open(file)}
                >
                  <td>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => actions.open(file)}
                    >
                      <Icon.File /> {file.name}
                    </button>
                  </td>
                  <td>
                    {file.permanent
                      ? "Permanent draft"
                      : formatEdited(file.updatedAt, now)}
                  </td>
                  <td>
                    {file.permanent
                      ? "—"
                      : new Date(file.createdAt).toLocaleDateString()}
                  </td>
                  <td className="cell-actions">
                    <Menu
                      label={`Actions for ${file.name}`}
                      trigger={<Icon.Dots />}
                      items={actions.menu(file)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
      {dragging ? (
        <div className="drop-overlay" aria-hidden="true">
          Drop .board.json files to import
        </div>
      ) : null}
      {actions.dialogs}
    </div>
  );
}

function Settings({
  theme,
  onTheme,
}: {
  theme: ThemePreference;
  onTheme: (theme: ThemePreference) => void;
}) {
  const store = useFileStore();
  const toast = useToast();
  const files = useFiles();
  const [name, setName] = useState(() => store.settings().displayName);
  return (
    <div className="settings">
      <section className="settings-card">
        <h2>Profile</h2>
        <p>Used for your greeting. Stored only in this browser.</p>
        <form
          className="settings-row"
          onSubmit={(event) => {
            event.preventDefault();
            store.saveSettings({ displayName: name });
            toast("Profile saved.");
          }}
        >
          <label className="field grow">
            <span>Display name</span>
            <input
              value={name}
              maxLength={60}
              placeholder="Your name"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button type="submit" className="button primary">
            Save
          </button>
        </form>
      </section>
      <section className="settings-card">
        <h2>Appearance</h2>
        <p>Changes the app chrome only; board content keeps its own colors.</p>
        {/* biome-ignore lint/a11y/useSemanticElements: compact toggle group */}
        <div className="segmented wide" role="group" aria-label="Theme">
          {(["system", "light", "dark"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={theme === option}
              onClick={() => onTheme(option)}
            >
              {option === "system" ? (
                <Icon.Monitor />
              ) : option === "light" ? (
                <Icon.Sun />
              ) : (
                <Icon.Moon />
              )}
              {option[0]?.toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>
      </section>
      <section className="settings-card">
        <h2>Storage</h2>
        <p>
          {files.length} file{files.length === 1 ? "" : "s"} in this
          browser&apos;s local storage. Export important work as
          <code>.board.json</code>; clearing site data removes local files.
        </p>
      </section>
    </div>
  );
}
