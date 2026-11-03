import { createFromTemplate } from "@allstudio/editor/board";
import { useCallback, useRef, useState } from "react";
import { navigate } from "../router.ts";
import {
  downloadText,
  type MenuEntry,
  PromptDialog,
  safeFilename,
  useToast,
} from "../ui/controls.tsx";
import { Icon } from "../ui/icons.tsx";
import type { StudioFile } from "./file-store.ts";
import { useFileStore } from "./use-files.ts";

function message(error: unknown) {
  return error instanceof Error ? error.message : "The operation failed.";
}

/** Shared file commands for every dashboard, with real persistence. */
export function useFileActions() {
  const store = useFileStore();
  const toast = useToast();
  const [renaming, setRenaming] = useState<StudioFile | null>(null);
  const importInput = useRef<HTMLInputElement>(null);

  const run = useCallback(
    (task: () => void) => {
      try {
        task();
      } catch (error) {
        toast(message(error), "error");
      }
    },
    [toast],
  );

  const open = useCallback((file: StudioFile) => {
    navigate({ name: "file", id: file.id });
  }, []);

  const createFrom = useCallback(
    (templateId: string, openAfter = true) => {
      run(() => {
        const file = store.create(createFromTemplate(templateId));
        if (openAfter) navigate({ name: "file", id: file.id });
        else toast(`Created “${file.name}”.`);
      });
    },
    [run, store, toast],
  );

  const importFiles = useCallback(
    async (files: FileList | File[]) => {
      for (const file of [...files]) {
        try {
          const created = store.importJson(await file.text());
          toast(`Imported “${created.name}”.`);
        } catch (error) {
          toast(`${file.name}: ${message(error)}`, "error");
        }
      }
    },
    [store, toast],
  );

  const menu = useCallback(
    (file: StudioFile): MenuEntry[] => {
      const entries: MenuEntry[] = [
        { label: "Open", icon: <Icon.Arrow />, onSelect: () => open(file) },
        {
          label: "Rename",
          icon: <Icon.Pencil />,
          onSelect: () => setRenaming(file),
        },
        {
          label: "Duplicate",
          icon: <Icon.Copy />,
          onSelect: () =>
            run(() => toast(`Created “${store.duplicate(file.id).name}”.`)),
        },
        {
          label: "Export .board.json",
          icon: <Icon.Download />,
          onSelect: () =>
            run(() =>
              downloadText(
                `${safeFilename(file.name)}.board.json`,
                store.exportJson(file.id),
              ),
            ),
        },
      ];
      if (file.permanent) return entries;
      entries.push("separator");
      if (file.archived) {
        entries.push(
          {
            label: "Restore",
            icon: <Icon.Restore />,
            onSelect: () =>
              run(() => {
                store.setArchived(file.id, false);
                toast(`Restored “${file.name}”.`);
              }),
          },
          {
            label: "Delete forever",
            icon: <Icon.Trash />,
            danger: true,
            onSelect: () => {
              if (
                window.confirm(
                  `Delete “${file.name}” forever? This cannot be undone.`,
                )
              ) {
                run(() => store.remove(file.id));
              }
            },
          },
        );
      } else {
        entries.push({
          label: "Move to archive",
          icon: <Icon.Archive />,
          onSelect: () =>
            run(() => {
              store.setArchived(file.id, true);
              toast(`Archived “${file.name}”.`);
            }),
        });
      }
      return entries;
    },
    [open, run, store, toast],
  );

  const dialogs = (
    <>
      {renaming ? (
        <PromptDialog
          title="Rename file"
          label="Name"
          initial={renaming.name}
          confirm="Rename"
          onCancel={() => setRenaming(null)}
          onSubmit={(value) => {
            run(() => store.rename(renaming.id, value));
            setRenaming(null);
          }}
        />
      ) : null}
      <input
        ref={importInput}
        type="file"
        accept=".json,application/json"
        multiple
        hidden
        data-testid="import-input"
        onChange={(event) => {
          if (event.target.files) void importFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </>
  );

  return {
    open,
    createFrom,
    menu,
    dialogs,
    importFiles,
    chooseImport: () => importInput.current?.click(),
  };
}
