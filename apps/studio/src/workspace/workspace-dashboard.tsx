import { BOARD_TEMPLATES, BoardThumbnail } from "@allstudio/editor/board";
import { useMemo, useState } from "react";
import { useFileActions } from "../files/file-actions.tsx";
import { FileThumbnail, useElementSize } from "../files/file-card.tsx";
import { formatEdited, type StudioFile } from "../files/file-store.ts";
import { useFileStore, useFiles } from "../files/use-files.ts";
import { href, navigate, type Route } from "../router.ts";
import { Menu } from "../ui/controls.tsx";
import { Icon } from "../ui/icons.tsx";
import type { ThemePreference } from "../ui/theme.ts";

type Section = Extract<Route, { name: "studio" }>["section"];

export function greeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function TemplateCard({
  template,
  onUse,
}: {
  template: (typeof BOARD_TEMPLATES)[number];
  onUse: () => void;
}) {
  const doc = useMemo(() => template.create(), [template]);
  const [ref, size] = useElementSize<HTMLDivElement>();
  return (
    <button
      type="button"
      className="template-card"
      onClick={onUse}
      data-template={template.id}
    >
      <div ref={ref} className="template-preview">
        {size.width > 0 ? (
          <BoardThumbnail
            document={doc}
            width={size.width}
            height={size.height}
          />
        ) : null}
        {template.id === "blank" ? (
          <span className="template-blank">
            <Icon.Plus size={22} />
          </span>
        ) : null}
      </div>
      <span className="template-name">{template.name}</span>
      <span className="template-desc">{template.description}</span>
    </button>
  );
}

function ProjectCard({
  file,
  now,
  menu,
  onOpen,
}: {
  file: StudioFile;
  now: Date;
  menu: ReturnType<ReturnType<typeof useFileActions>["menu"]>;
  onOpen: () => void;
}) {
  return (
    <article className="project-card" data-file-id={file.id}>
      <button
        type="button"
        className="project-preview"
        onClick={onOpen}
        aria-label={`Open ${file.name}`}
      >
        <FileThumbnail file={file} />
      </button>
      <footer>
        <button type="button" className="project-meta" onClick={onOpen}>
          <strong>{file.name}</strong>
          <span>
            {file.permanent
              ? "Permanent draft"
              : formatEdited(file.updatedAt, now)}
          </span>
        </button>
        <Menu
          label={`Actions for ${file.name}`}
          trigger={<Icon.Dots />}
          items={menu}
        />
      </footer>
    </article>
  );
}

/** Framer-inspired inner Studio home: greeting, hero, projects, templates. */
export function WorkspaceDashboard({
  section,
  theme,
  onTheme,
}: {
  section: Section;
  theme: ThemePreference;
  onTheme: (theme: ThemePreference) => void;
}) {
  const files = useFiles();
  const store = useFileStore();
  const actions = useFileActions();
  const [query, setQuery] = useState("");
  const now = new Date();
  const name = store.settings().displayName;
  const active = files.filter((file) => !file.archived);
  const recent = active.filter((file) => !file.permanent).slice(0, 6);
  const latest = active[0];
  const filtered = active.filter((file) =>
    file.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const navItem = (
    label: string,
    icon: React.ReactNode,
    target: string,
    current: boolean,
  ) => (
    <a
      className={current ? "ws-nav active" : "ws-nav"}
      href={target}
      aria-current={current ? "page" : undefined}
    >
      {icon}
      <span>{label}</span>
    </a>
  );

  return (
    <div className="workspace">
      <aside className="ws-sidebar" aria-label="Studio navigation">
        <a
          className="ws-brand"
          href={href({ name: "studio", section: "home" })}
        >
          <Icon.Logo /> <strong>allstudio</strong>
          <span className="ws-brand-sub">/ local</span>
        </a>
        <nav aria-label="Studio">
          {navItem(
            "Home",
            <Icon.Home />,
            href({ name: "studio", section: "home" }),
            section === "home",
          )}
          {navItem(
            "Projects",
            <Icon.Studio />,
            href({ name: "studio", section: "projects" }),
            section === "projects",
          )}
          {navItem(
            "Templates",
            <Icon.Template />,
            href({ name: "studio", section: "templates" }),
            section === "templates",
          )}
          {navItem(
            "Files",
            <Icon.Grid />,
            href({ name: "home", section: "recents" }),
            false,
          )}
          <span
            className="ws-nav disabled"
            aria-disabled="true"
            title="Local AI (bring your own key) is planned for Phase 5."
          >
            <Icon.Chat />
            <span>Chat</span>
            <span className="pill">Soon</span>
          </span>
        </nav>
        <h2 className="ws-heading">Your projects</h2>
        <nav aria-label="Your projects" className="ws-projects">
          {active.slice(0, 7).map((file) => (
            <a
              key={file.id}
              className="ws-nav"
              href={href({ name: "file", id: file.id })}
            >
              <Icon.File />
              <span>{file.name}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <Menu
          label="Appearance"
          className="ws-account"
          align="start"
          trigger={
            <>
              <span className="avatar small" aria-hidden="true">
                {(name || "A")[0]?.toUpperCase()}
              </span>
              <span>{name || "Local studio"}</span>
              <span className="ws-plan">· Offline</span>
            </>
          }
          items={(["system", "light", "dark"] as const).map((option) => ({
            label: `${option[0]?.toUpperCase()}${option.slice(1)} theme`,
            icon:
              option === "system" ? (
                <Icon.Monitor />
              ) : option === "light" ? (
                <Icon.Sun />
              ) : (
                <Icon.Moon />
              ),
            shortcut: theme === option ? "✓" : undefined,
            onSelect: () => onTheme(option),
          }))}
        />
      </aside>

      <main className="ws-main">
        <header className="ws-topbar">
          <label className="ws-search">
            <Icon.Search />
            <input
              type="search"
              placeholder="Search projects"
              aria-label="Search projects"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (section !== "projects")
                  navigate({ name: "studio", section: "projects" });
              }}
            />
          </label>
          <button
            type="button"
            className="button secondary"
            onClick={actions.chooseImport}
          >
            <Icon.Upload /> Import
          </button>
          <button
            type="button"
            className="button dark"
            disabled={!latest}
            onClick={() => latest && actions.open(latest)}
          >
            Open in Studio
          </button>
        </header>

        {section === "home" ? (
          <>
            <section className="ws-greeting">
              <h1>
                {greeting(now)}
                {name ? `, ${name}.` : "."}
              </h1>
              <p>
                Pick up where you left off, or start something entirely new.
              </p>
            </section>

            <section className="ws-hero" aria-label="Start something new">
              <div className="ws-hero-copy">
                <span className="eyebrow">Your next idea starts here</span>
                <h2>Build something remarkable.</h2>
                <div className="ws-hero-actions">
                  <button
                    type="button"
                    className="button dark pill"
                    onClick={() => actions.createFrom("blank")}
                  >
                    <Icon.Plus /> New blank board
                  </button>
                  <button
                    type="button"
                    className="button light pill"
                    onClick={() =>
                      navigate({ name: "studio", section: "templates" })
                    }
                  >
                    Start from a template
                  </button>
                </div>
              </div>
              <div className="ws-hero-art" aria-hidden="true">
                <span className="orb" />
                <span className="dome" />
              </div>
            </section>

            <section className="ws-section">
              <header>
                <h2>Recent projects</h2>
                <a
                  href={href({ name: "studio", section: "projects" })}
                  className="ws-link"
                >
                  View all projects <Icon.Arrow />
                </a>
              </header>
              {recent.length ? (
                <div className="project-grid">
                  {recent.map((file) => (
                    <ProjectCard
                      key={file.id}
                      file={file}
                      now={now}
                      menu={actions.menu(file)}
                      onOpen={() => actions.open(file)}
                    />
                  ))}
                </div>
              ) : (
                <p className="ws-empty">
                  No projects yet — start with a template below.
                </p>
              )}
            </section>

            <section className="ws-section">
              <header>
                <h2>Start from a template</h2>
                <a
                  href={href({ name: "studio", section: "templates" })}
                  className="ws-link"
                >
                  All templates <Icon.Arrow />
                </a>
              </header>
              <div className="template-row">
                {BOARD_TEMPLATES.slice(0, 4).map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onUse={() => actions.createFrom(template.id)}
                  />
                ))}
              </div>
            </section>

            <section className="ws-footer-card">
              <div>
                <strong>Your work, your files, your studio.</strong>
                <p>
                  Boards are portable JSON you can export, back up and reopen
                  anywhere.
                </p>
              </div>
              <a
                className="button secondary pill"
                href={href({ name: "home", section: "files" })}
              >
                Explore files
              </a>
            </section>
          </>
        ) : section === "templates" ? (
          <section className="ws-section">
            <header>
              <h1 className="ws-title">Templates</h1>
            </header>
            <div className="template-row wrap">
              {BOARD_TEMPLATES.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onUse={() => actions.createFrom(template.id)}
                />
              ))}
            </div>
          </section>
        ) : (
          <section className="ws-section">
            <header>
              <h1 className="ws-title">Projects</h1>
              <span className="ws-count">
                {filtered.length} of {active.length}
              </span>
            </header>
            {filtered.length ? (
              <div className="project-grid">
                {filtered.map((file) => (
                  <ProjectCard
                    key={file.id}
                    file={file}
                    now={now}
                    menu={actions.menu(file)}
                    onOpen={() => actions.open(file)}
                  />
                ))}
              </div>
            ) : (
              <p className="ws-empty">No projects match “{query}”.</p>
            )}
          </section>
        )}
      </main>
      {actions.dialogs}
    </div>
  );
}
