import { BoardEditor } from "@allstudio/editor/board";
import type { BoardDocumentV1 } from "@allstudio/project";
import { useMemo } from "react";
import { useFileStore } from "../files/use-files.ts";
import { href, navigate } from "../router.ts";
import { downloadText, safeFilename } from "../ui/controls.tsx";
import { Icon } from "../ui/icons.tsx";
import type { ThemePreference } from "../ui/theme.ts";

/** Opens a stored board in the editor; saves go back through the store. */
export function FileEditor({
  id,
  resolvedTheme,
  onTheme,
  onOpenWebsiteEditor,
  active = true,
}: {
  id: string;
  resolvedTheme: "light" | "dark";
  onTheme: (theme: ThemePreference) => void;
  onOpenWebsiteEditor?: () => void;
  active?: boolean;
}) {
  const store = useFileStore();
  // Read once per file id: the editor owns the document while open.
  const loaded = useMemo((): BoardDocumentV1 | Error => {
    try {
      return store.read(id);
    } catch (error) {
      return error instanceof Error ? error : new Error("Unreadable file.");
    }
  }, [store, id]);

  if (loaded instanceof Error) {
    return (
      <div className="empty" role="alert">
        <Icon.File size={28} />
        <h2>This file can’t be opened</h2>
        <p>{loaded.message}</p>
        <a
          className="button secondary"
          href={href({ name: "home", section: "recents" })}
        >
          Back to files
        </a>
      </div>
    );
  }
  return (
    <BoardEditor
      key={id}
      document={loaded}
      appearance={resolvedTheme}
      active={active}
      onToggleAppearance={() =>
        onTheme(resolvedTheme === "dark" ? "light" : "dark")
      }
      onSave={(doc) => {
        store.save(id, doc);
      }}
      onExit={() => navigate({ name: "home", section: "recents" })}
      onExport={(doc) =>
        downloadText(
          `${safeFilename(doc.name)}.board.json`,
          `${JSON.stringify(doc, null, 2)}\n`,
        )
      }
      menu={[
        {
          label: "Studio home",
          onSelect: () => navigate({ name: "studio", section: "home" }),
        },
        ...(onOpenWebsiteEditor
          ? [{ label: "Website projects", onSelect: onOpenWebsiteEditor }]
          : []),
      ]}
    />
  );
}
