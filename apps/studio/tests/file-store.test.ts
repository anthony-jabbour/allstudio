import { BOARD_TEMPLATES, createFromTemplate } from "@allstudio/editor/board";
import { parseBoardDocument } from "@allstudio/project";
import { describe, expect, it, vi } from "vitest";
import {
  browserStorage,
  FileStore,
  FileStoreError,
  formatEdited,
  memoryStorage,
  SCRATCHPAD_ID,
} from "../src/files/file-store.ts";
import { parseRoute } from "../src/router.ts";

function store() {
  let tick = Date.parse("2026-11-02T10:00:00.000Z");
  return new FileStore(memoryStorage(), () => {
    tick += 1000;
    return new Date(tick);
  });
}

describe("FileStore", () => {
  it("always provides a permanent scratchpad", () => {
    const s = store();
    const [scratch] = s.list();
    expect(scratch?.id).toBe(SCRATCHPAD_ID);
    expect(() => s.setArchived(SCRATCHPAD_ID, true)).toThrow(FileStoreError);
  });

  it("creates, saves, renames, duplicates and orders by last edit", () => {
    const s = store();
    const a = s.create(createFromTemplate("landing"));
    const b = s.create(createFromTemplate("mobile"));
    expect(s.list()[0]?.id).toBe(b.id);
    const doc = s.read(a.id);
    s.save(a.id, { ...doc, name: "Renamed by save" });
    expect(s.list()[0]?.name).toBe("Renamed by save");
    s.rename(b.id, "  Phone  ");
    expect(s.get(b.id)?.name).toBe("Phone");
    const copy = s.duplicate(b.id);
    expect(copy.name).toBe("Phone copy");
    expect(s.read(copy.id).pages).toEqual(s.read(b.id).pages);
  });

  it("archives before deleting and refuses to delete active files", () => {
    const s = store();
    const file = s.create(createFromTemplate("blank"));
    expect(() => s.remove(file.id)).toThrow(/Archive/);
    s.setArchived(file.id, true);
    s.remove(file.id);
    expect(s.get(file.id)).toBeUndefined();
    expect(() => s.read(file.id)).toThrow(/no longer exists/);
  });

  it("exports and re-imports the portable JSON; refuses hostile imports", () => {
    const s = store();
    const file = s.create(createFromTemplate("moodboard"));
    const imported = s.importJson(s.exportJson(file.id));
    expect(imported.id).not.toBe(file.id);
    expect(s.read(imported.id).pages).toEqual(s.read(file.id).pages);
    expect(() => s.importJson("{nope")).toThrow(/valid board JSON/);
    const hostile = JSON.parse(s.exportJson(file.id));
    hostile.pages[0].nodes[0].fill = "url(https://evil.example)";
    expect(() => s.importJson(JSON.stringify(hostile))).toThrow(
      /Import refused/,
    );
  });

  it("reports damaged stored documents instead of rendering them", () => {
    const storage = memoryStorage();
    const s = new FileStore(storage);
    const file = s.create(createFromTemplate("blank"));
    storage.setItem(`allstudio.board.${file.id}`, '{"schemaVersion":1}');
    expect(() => s.read(file.id)).toThrow(/damaged/);
  });

  it("surfaces quota failures", () => {
    const s = new FileStore({
      ...memoryStorage(),
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    });
    expect(() => s.list()).toThrow(/storage is full/);
  });

  it("keeps readable persistent storage when writes are quota-blocked", () => {
    const values = new Map([["existing-board", "persisted"]]);
    const persistentStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: (key: string) => values.delete(key),
    };
    vi.stubGlobal("window", { localStorage: persistentStorage });

    try {
      const storage = browserStorage();
      expect(storage.getItem("existing-board")).toBe("persisted");
      expect(() => storage.setItem("new-board", "data")).toThrow(
        "QuotaExceededError",
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("removes a new board document when the index write fails", () => {
    const backing = memoryStorage();
    const writes: string[] = [];
    const removed: string[] = [];
    const storage = {
      getItem: (key: string) => backing.getItem(key),
      setItem: (key: string, value: string) => {
        writes.push(key);
        if (key === "allstudio.files.v1") throw new Error("QuotaExceededError");
        backing.setItem(key, value);
      },
      removeItem: (key: string) => {
        removed.push(key);
        backing.removeItem(key);
      },
    };
    const s = new FileStore(storage);

    expect(() => s.create(createFromTemplate("blank"))).toThrow(
      /storage is full/,
    );
    expect(writes).toHaveLength(2);
    const documentKey = writes[0];
    expect(removed).toEqual([documentKey]);
    expect(backing.getItem(documentKey ?? "")).toBeNull();
  });

  it("rolls back the scratchpad document when its index write fails", () => {
    const backing = memoryStorage();
    const writes: string[] = [];
    const removed: string[] = [];
    const storage = {
      getItem: (key: string) => backing.getItem(key),
      setItem: (key: string, value: string) => {
        writes.push(key);
        if (key === "allstudio.files.v1") throw new Error("QuotaExceededError");
        backing.setItem(key, value);
      },
      removeItem: (key: string) => {
        removed.push(key);
        backing.removeItem(key);
      },
    };

    expect(() => new FileStore(storage).list()).toThrow(/storage is full/);
    expect(writes).toHaveLength(2);
    expect(removed).toEqual([writes[0]]);
    expect(backing.getItem(writes[0] ?? "")).toBeNull();
  });
});

describe("templates", () => {
  it.each(
    BOARD_TEMPLATES.map((t) => [t.id]),
  )("%s produces a valid board", (id) => {
    const doc = createFromTemplate(id);
    expect(parseBoardDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });
});

describe("routes and labels", () => {
  it("parses hash routes", () => {
    expect(parseRoute("#/file/b_12")).toEqual({ name: "file", id: "b_12" });
    expect(parseRoute("#/studio/templates")).toEqual({
      name: "studio",
      section: "templates",
    });
    expect(parseRoute("#/archive")).toEqual({
      name: "home",
      section: "archive",
    });
    expect(parseRoute("#/whatever")).toEqual({
      name: "home",
      section: "recents",
    });
  });
  it("formats edit times", () => {
    const now = new Date("2026-11-02T12:00:00Z");
    expect(formatEdited("2026-11-02T11:59:50Z", now)).toBe("Edited just now");
    expect(formatEdited("2026-10-22T12:00:00Z", now)).toBe(
      "Edited 11 days ago",
    );
  });
});
