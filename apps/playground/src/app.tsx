import { EditorShell } from "@allstudio/editor/shell";
import { parseProjectManifest } from "@allstudio/project";
import { createHttpWorkspace, readMeta } from "./workspace-client.ts";

const fixtureManifest = parseProjectManifest({
  schemaVersion: 1,
  projectId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  name: "nextjs-site-fixture",
  artifacts: [
    {
      id: "site",
      kind: "site",
      path: "examples/nextjs-site-fixture",
    },
  ],
  sourceFramework: "nextjs-react",
  createdAt: "2026-10-24T00:00:00.000Z",
});

// Injected by the dev-workspace Vite plugin; absent in `vite build` output.
const sessionToken = readMeta("allstudio-dev-session");
const previewUrl = readMeta("allstudio-preview-url");
const workspace = sessionToken ? createHttpWorkspace(sessionToken) : undefined;

export function App() {
  return (
    <div className="page">
      <EditorShell
        manifest={fixtureManifest}
        previewUrl={previewUrl ?? undefined}
        workspace={workspace}
      />
      <section>
        <h2>Developer notes</h2>
        <p>
          The preview is a git-ignored copy of
          <code> examples/nextjs-site-fixture </code>
          in <code>apps/playground/.workspace/</code>. Edits are written there,
          never to the fixture. Delete that folder (or start with
          <code> ALLSTUDIO_RESET_WORKSPACE=1</code>) to start over.
        </p>
      </section>
    </div>
  );
}
