import { NoteList } from "@/components/note-list";
import { SiteHeader } from "@/components/site-header";
import { SyncBanner } from "@/components/sync-banner";
import { isSynced, notes } from "@/lib/notes";

export default function Home() {
  return (
    <div className="min-h-full">
      <SiteHeader />
      <main className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-16">
        <section id="intro" className="flex flex-col gap-4">
          <h1
            id="lumen-heading"
            className="text-4xl font-semibold tracking-tight text-stone-900"
          >
            Lumen Notes
          </h1>
          <p className="text-lg text-stone-600">
            Capture ideas, link them, and find them again.
          </p>
          <p id="note-count" className="text-sm text-stone-500">
            {notes.length} notes in this workspace
          </p>
          {isSynced ? (
            <span
              id="sync-status"
              className="w-fit rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-800"
            >
              Synced
            </span>
          ) : (
            <span className="w-fit rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
              Offline
            </span>
          )}
        </section>
        <NoteList notes={notes} />
        <SyncBanner visible={isSynced} />
      </main>
    </div>
  );
}
