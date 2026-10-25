import type { Note } from "@/lib/notes";

export function NoteCard({ note }: { note: Note }) {
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-5">
      <h2 className="font-medium">{note.title}</h2>
      <p className="mt-2 text-sm text-stone-600">{note.excerpt}</p>
    </article>
  );
}
