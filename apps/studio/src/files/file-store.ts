import {
  BoardDocumentError,
  type BoardDocumentV1,
  createBoardDocument,
  createBoardId,
  parseBoardDocument,
} from "@allstudio/project";

/**
 * Local-first file index for the browser Studio host.
 *
 * Files are portable board documents kept in this browser's storage; nothing
 * is sent anywhere. Every read goes back through `parseBoardDocument`, so a
 * corrupted or hand-edited entry is reported instead of rendered. Export and
 * import use the same JSON, which is the `.board.json` portable format.
 */

export interface StudioFile {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  /** The permanent scratchpad cannot be archived or deleted. */
  permanent?: boolean;
}

export interface StudioSettings {
  displayName: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class FileStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileStoreError";
  }
}

const INDEX_KEY = "allstudio.files.v1";
const SETTINGS_KEY = "allstudio.settings.v1";
const DOC_PREFIX = "allstudio.board.";
export const SCRATCHPAD_ID = "scratchpad";
const MAX_IMPORT_BYTES = 24 * 1024 * 1024;

function isFile(value: unknown): value is StudioFile {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.createdAt === "string" &&
    typeof v.updatedAt === "string" &&
    typeof v.archived === "boolean"
  );
}

export class FileStore {
  private listeners = new Set<() => void>();
  private cache: StudioFile[] | null = null;

  constructor(
    private readonly storage: StorageLike,
    private readonly now: () => Date = () => new Date(),
  ) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Re-read storage (e.g. after another tab changed it) and notify. */
  refresh(): void {
    this.cache = null;
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }

  private write(key: string, value: string) {
    try {
      this.storage.setItem(key, value);
    } catch {
      throw new FileStoreError(
        "This browser's storage is full. Export or delete files to free space.",
      );
    }
  }

  private readIndex(): StudioFile[] {
    if (this.cache) return this.cache;
    let files: StudioFile[] = [];
    try {
      const raw = this.storage.getItem(INDEX_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      files = Array.isArray(parsed) ? parsed.filter(isFile) : [];
    } catch {
      files = [];
    }
    this.cache = files;
    return files;
  }

  private writeIndex(files: StudioFile[]) {
    this.write(INDEX_KEY, JSON.stringify(files));
    this.cache = files;
    this.emit();
  }

  private writeNewDocument(
    document: BoardDocumentV1,
    file: StudioFile,
    files: StudioFile[],
  ) {
    const key = DOC_PREFIX + document.id;
    const next = [...files, file];
    this.write(key, JSON.stringify(document));
    try {
      this.write(INDEX_KEY, JSON.stringify(next));
    } catch (error) {
      try {
        this.storage.removeItem(key);
      } catch {
        throw new FileStoreError(
          "The file list could not be saved and the new board could not be rolled back. Restart AllStudio before retrying.",
        );
      }
      throw error;
    }
    this.cache = next;
  }

  /** All files, most recently edited first. Ensures the scratchpad exists. */
  list(): StudioFile[] {
    const recovery = this.ensureScratchpad();
    const files = [...this.readIndex(), ...(recovery ? [recovery] : [])];
    return files.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  get(id: string): StudioFile | undefined {
    return this.readIndex().find((file) => file.id === id);
  }

  /** Validated document, or a FileStoreError describing why it cannot open. */
  read(id: string): BoardDocumentV1 {
    const raw = this.storage.getItem(DOC_PREFIX + id);
    if (raw === null) throw new FileStoreError("This file no longer exists.");
    let document: BoardDocumentV1;
    try {
      document = parseBoardDocument(JSON.parse(raw));
    } catch (error) {
      throw new FileStoreError(
        error instanceof BoardDocumentError
          ? `This file is damaged and was not opened (${error.message}).`
          : "This file is damaged and was not opened.",
      );
    }
    if (document.id !== id) {
      throw new FileStoreError(
        "This file is damaged and was not opened because its ID does not match its storage key.",
      );
    }
    return document;
  }

  private ensureScratchpad(): StudioFile | undefined {
    const files = this.readIndex();
    if (files.some((file) => file.id === SCRATCHPAD_ID)) return;
    const stamp = new Date(0).toISOString();
    const damaged: StudioFile = {
      id: SCRATCHPAD_ID,
      name: "Scratchpad (damaged)",
      createdAt: stamp,
      updatedAt: stamp,
      archived: false,
      permanent: true,
    };
    const key = DOC_PREFIX + SCRATCHPAD_ID;
    const raw = this.storage.getItem(key);
    if (raw !== null) {
      let document: BoardDocumentV1;
      try {
        document = parseBoardDocument(JSON.parse(raw));
      } catch {
        return damaged;
      }
      if (document.id !== SCRATCHPAD_ID) return damaged;
      const file: StudioFile = {
        ...damaged,
        name: document.name,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      };
      const next = [...files, file];
      try {
        this.write(INDEX_KEY, JSON.stringify(next));
        this.cache = next;
      } catch {
        return { ...file, name: `${file.name} (not indexed)` };
      }
      return;
    }
    const doc = createBoardDocument("Scratchpad", undefined, stamp);
    doc.id = SCRATCHPAD_ID;
    const file: StudioFile = {
      id: SCRATCHPAD_ID,
      name: "Scratchpad (not saved)",
      createdAt: stamp,
      updatedAt: stamp,
      archived: false,
      permanent: true,
    };
    try {
      this.writeNewDocument(
        doc,
        {
          id: SCRATCHPAD_ID,
          name: "Scratchpad",
          createdAt: stamp,
          updatedAt: stamp,
          archived: false,
          permanent: true,
        },
        files,
      );
    } catch {
      return file;
    }
  }

  create(document: BoardDocumentV1): StudioFile {
    const doc = parseBoardDocument(document);
    const stamp = this.now().toISOString();
    const files = this.readIndex();
    if (files.some((file) => file.id === doc.id)) doc.id = createBoardId("b");
    doc.createdAt = stamp;
    doc.updatedAt = stamp;
    const file: StudioFile = {
      id: doc.id,
      name: doc.name,
      createdAt: stamp,
      updatedAt: stamp,
      archived: false,
    };
    this.writeNewDocument(doc, file, files);
    this.emit();
    return file;
  }

  /** Persist an edited document; validation runs before anything is written. */
  save(id: string, document: BoardDocumentV1): StudioFile {
    const files = this.readIndex();
    const file = files.find((item) => item.id === id);
    if (!file) throw new FileStoreError("This file no longer exists.");
    const doc = parseBoardDocument({ ...document, id });
    doc.updatedAt = this.now().toISOString();
    this.write(DOC_PREFIX + id, JSON.stringify(doc));
    const next = { ...file, name: doc.name, updatedAt: doc.updatedAt };
    this.writeIndex(files.map((item) => (item.id === id ? next : item)));
    return next;
  }

  rename(id: string, name: string): StudioFile {
    const trimmed = name.trim().slice(0, 200);
    if (!trimmed) throw new FileStoreError("A file name cannot be empty.");
    const doc = this.read(id);
    return this.save(id, { ...doc, name: trimmed });
  }

  duplicate(id: string): StudioFile {
    const doc = this.read(id);
    return this.create({
      ...structuredClone(doc),
      id: createBoardId("b"),
      name: `${doc.name} copy`.slice(0, 200),
    });
  }

  setArchived(id: string, archived: boolean): void {
    const files = this.readIndex();
    const file = files.find((item) => item.id === id);
    if (!file) throw new FileStoreError("This file no longer exists.");
    if (file.permanent) {
      throw new FileStoreError("The scratchpad is permanent and stays here.");
    }
    this.writeIndex(
      files.map((item) => (item.id === id ? { ...item, archived } : item)),
    );
  }

  /** Permanently delete. Only archived files can be deleted. */
  remove(id: string): void {
    const files = this.readIndex();
    const file = files.find((item) => item.id === id);
    if (!file) return;
    if (file.permanent || !file.archived) {
      throw new FileStoreError("Archive a file before deleting it.");
    }
    this.storage.removeItem(DOC_PREFIX + id);
    this.writeIndex(files.filter((item) => item.id !== id));
  }

  exportJson(id: string): string {
    return `${JSON.stringify(this.read(id), null, 2)}\n`;
  }

  importJson(text: string): StudioFile {
    if (text.length > MAX_IMPORT_BYTES) {
      throw new FileStoreError("This file is too large to import.");
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new FileStoreError("This is not a valid board JSON file.");
    }
    try {
      return this.create(parseBoardDocument(value));
    } catch (error) {
      throw new FileStoreError(
        error instanceof Error
          ? `Import refused: ${error.message}`
          : "Import refused.",
      );
    }
  }

  settings(): StudioSettings {
    try {
      const raw = this.storage.getItem(SETTINGS_KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<StudioSettings>) : {};
      return {
        displayName:
          typeof parsed.displayName === "string"
            ? parsed.displayName.slice(0, 60)
            : "",
      };
    } catch {
      return { displayName: "" };
    }
  }

  saveSettings(settings: StudioSettings): void {
    this.write(
      SETTINGS_KEY,
      JSON.stringify({ displayName: settings.displayName.trim().slice(0, 60) }),
    );
    this.emit();
  }
}

/** In-memory storage for tests and for browsers that block localStorage. */
export function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

export function browserStorage(): StorageLike {
  try {
    const storage = window.localStorage;
    storage.getItem("allstudio.probe");
    return storage;
  } catch {
    return memoryStorage();
  }
}

export function formatEdited(iso: string, now = new Date()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then) || then <= 0) return "Never edited";
  const seconds = Math.max(0, Math.round((now.getTime() - then) / 1000));
  if (seconds < 45) return "Edited just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60)
    return `Edited ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Edited ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Edited yesterday";
  if (days < 30) return `Edited ${days} days ago`;
  return `Edited ${new Date(then).toLocaleDateString()}`;
}
