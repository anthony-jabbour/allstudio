import type { ProjectManifestV1 } from "@allstudio/project";

export const EDITOR_STATUS = "scaffold" as const;

export interface EditorShellProps {
  manifest?: ProjectManifestV1;
}

export function EditorShell({ manifest }: EditorShellProps) {
  return (
    <main>
      <p>allstudio playground</p>
      <h1>Editor scaffold</h1>
      <p>
        Shared editor package status: {EDITOR_STATUS}. Source mapping, canvas
        tools, and Onlook extraction are not implemented yet.
      </p>
      {manifest ? (
        <p>
          Loaded project: {manifest.name} ({manifest.projectId})
        </p>
      ) : (
        <p>No project manifest loaded.</p>
      )}
    </main>
  );
}
