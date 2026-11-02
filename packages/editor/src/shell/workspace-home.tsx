import { type ReactNode, useEffect, useRef } from "react";

export type WorkspaceHomeView = "grid" | "list";

export interface WorkspaceHomeNavigationItem {
  label: string;
  icon?: ReactNode;
  current?: boolean;
  count?: number;
  href?: string;
  onSelect?: () => void;
}

export interface WorkspaceHomeSection {
  label: string;
  heading?: ReactNode;
  items: readonly WorkspaceHomeNavigationItem[];
}

export interface WorkspaceHomeProject {
  id: string;
  name: string;
  detail: string;
  searchText?: string;
  badge?: ReactNode;
  preview?: ReactNode;
  onOpen: () => void;
}

export interface WorkspaceHomeProps {
  sidebarLabel: string;
  sidebarHeader: ReactNode;
  sidebarNote?: ReactNode;
  search: string;
  searchLabel: string;
  searchPlaceholder: string;
  onSearchChange(value: string): void;
  sections: readonly WorkspaceHomeSection[];
  title: string;
  regionLabel: string;
  actions: ReactNode;
  status?: ReactNode;
  items: readonly WorkspaceHomeProject[];
  view: WorkspaceHomeView;
  onViewChange(view: WorkspaceHomeView): void;
  busy: boolean;
  emptyMessage: string;
  noResultsMessage: string;
}

export function WorkspaceHome({
  sidebarLabel,
  sidebarHeader,
  sidebarNote,
  search,
  searchLabel,
  searchPlaceholder,
  onSearchChange,
  sections,
  title,
  regionLabel,
  actions,
  status,
  items,
  view,
  onViewChange,
  busy,
  emptyMessage,
  noResultsMessage,
}: WorkspaceHomeProps) {
  const searchInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const needle = search.trim().toLowerCase();
  const visibleItems = items.filter(
    (item) =>
      !needle ||
      `${item.name} ${item.searchText ?? ""}`.toLowerCase().includes(needle),
  );

  return (
    <div className="workspace-home">
      <aside className="home-sidebar" aria-label={sidebarLabel}>
        {sidebarHeader}
        <label className="home-search">
          <span className="sr-only">{searchLabel}</span>
          <input
            ref={searchInput}
            type="search"
            aria-label={searchLabel}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
          />
          <kbd>⌘F</kbd>
        </label>
        {sections.map((section) => (
          <nav
            className="nav-group"
            aria-label={section.label}
            key={section.label}
          >
            {section.heading ? (
              <div className="nav-heading">{section.heading}</div>
            ) : null}
            {section.items.map((item) => {
              const className = item.current ? "nav-item active" : "nav-item";
              const content = (
                <>
                  {item.icon}
                  <span>{item.label}</span>
                  {item.count ? (
                    <span className="nav-count">{item.count}</span>
                  ) : null}
                </>
              );
              return item.href ? (
                <a
                  className={className}
                  href={item.href}
                  aria-current={item.current ? "page" : undefined}
                  key={item.label}
                  onClick={item.onSelect}
                >
                  {content}
                </a>
              ) : item.onSelect ? (
                <button
                  type="button"
                  className={className}
                  aria-current={item.current ? "page" : undefined}
                  key={item.label}
                  onClick={item.onSelect}
                >
                  {content}
                </button>
              ) : (
                <span
                  className={className}
                  aria-current={item.current ? "page" : undefined}
                  key={item.label}
                >
                  {content}
                </span>
              );
            })}
          </nav>
        ))}
        {sidebarNote}
      </aside>
      <section className="home-projects" aria-label={regionLabel}>
        <div className="home-heading">
          <h2>{title}</h2>
          <div className="home-heading-actions">
            {actions}
            <fieldset className="view-switch">
              <legend className="sr-only">Project view</legend>
              <button
                type="button"
                aria-label="Grid view"
                aria-pressed={view === "grid"}
                onClick={() => onViewChange("grid")}
              >
                ▦
              </button>
              <button
                type="button"
                aria-label="List view"
                aria-pressed={view === "list"}
                onClick={() => onViewChange("list")}
              >
                ☷
              </button>
            </fieldset>
          </div>
        </div>
        {status ? <output className="home-status">{status}</output> : null}
        <div
          className={`project-grid${view === "list" ? " project-list" : ""}`}
        >
          {visibleItems.map((item) => (
            <button
              className="project-card"
              key={item.id}
              type="button"
              disabled={busy}
              aria-label={`Open ${item.name}`}
              onClick={item.onOpen}
            >
              <span className="project-card-title">
                {item.name}
                {item.badge}
              </span>
              <span className="project-card-preview">
                {item.preview ?? <span>Preview unavailable</span>}
              </span>
              <span className="project-card-meta">
                <span className="project-card-path">{item.detail}</span>
                <span className="project-card-open">Open →</span>
              </span>
            </button>
          ))}
        </div>
        {!items.length ? (
          <p className="home-empty">{emptyMessage}</p>
        ) : visibleItems.length === 0 ? (
          <p className="home-empty">{noResultsMessage}</p>
        ) : null}
      </section>
    </div>
  );
}
