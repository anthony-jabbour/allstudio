import type { Note } from "@/lib/notes";
import { NoteCard } from "./note-card";

export function NoteList({ notes }: { notes: Note[] }) {
  return (
    <section id="notes" className="grid gap-4 md:grid-cols-2">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} />
      ))}
    </section>
  );
}
