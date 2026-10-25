import { NavLink } from "./nav-link";
import { NewNoteButton } from "./new-note-button";

export function SiteHeader() {
  return (
    <header className="border-b border-stone-200 bg-white">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4"
      >
        <span className="font-semibold">Lumen</span>
        <div className="flex items-center gap-4">
          <NavLink href="#intro">Overview</NavLink>
          <NavLink href="#notes">Notes</NavLink>
          <NewNoteButton />
        </div>
      </nav>
    </header>
  );
}
