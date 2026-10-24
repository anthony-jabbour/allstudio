import { EditorShell } from "@allstudio/editor";
import { parseProjectManifest } from "@allstudio/project";

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

export function App() {
  return (
    <div className="page">
      <EditorShell manifest={fixtureManifest} />
      <section>
        <h2>Developer notes</h2>
        <p>
          This playground exists to prove workspace imports of
          <code> @allstudio/editor </code>
          and
          <code> @allstudio/project </code>
          resolve. It is not the product editor.
        </p>
        <p>
          Next recommended work: Phase 0 — reproduce Onlook source-editing
          outside this repository, then extract a proven slice.
        </p>
      </section>
    </div>
  );
}
