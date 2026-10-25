export interface Note {
  id: string;
  title: string;
  excerpt: string;
}

export const notes: Note[] = [
  {
    id: "garden",
    title: "Garden plan",
    excerpt: "Raised beds on the south fence, herbs by the door.",
  },
  {
    id: "reading",
    title: "Reading list",
    excerpt: "Three essays on craft and one long novel.",
  },
  {
    id: "trip",
    title: "Coast trip",
    excerpt: "Ferry times, a map of the cliff path, packing notes.",
  },
];

export const isSynced = notes.length > 0;
