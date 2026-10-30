import { EditorShell } from "@allstudio/editor/shell";
import { parseProjectManifest } from "@allstudio/project";
import { useMemo, useState } from "react";
import {
  createHttpWorkspace,
  readFixtures,
  readMeta,
} from "./workspace-client.ts";

// Injected by the dev-workspace Vite plugin; absent in `vite build` output.
const sessionToken = readMeta("allstudio-dev-session");
const fixtures = readFixtures();

function manifestFor(id: string, name: string) {
  return parseProjectManifest({
    schemaVersion: 1,
    projectId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    name,
    artifacts: [{ id: "site", kind: "site", path: `.workspace/${id}` }],
    sourceFramework: "nextjs-react",
    createdAt: "2026-10-24T00:00:00.000Z",
  });
}

export function App() {
  const [fixtureId, setFixtureId] = useState(fixtures[0]?.id ?? "");
  const fixture = fixtures.find((item) => item.id === fixtureId);
  const workspace = useMemo(
    () =>
      sessionToken && fixture
        ? createHttpWorkspace(sessionToken, fixture.id)
        : undefined,
    [fixture],
  );

  return (
    <div className="page">
      {fixtures.length > 0 ? (
        <label className="fixture-picker">
          Fixture
          <select
            value={fixtureId}
            onChange={(event) => setFixtureId(event.target.value)}
          >
            {fixtures.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <EditorShell
        key={fixtureId}
        manifest={fixture ? manifestFor(fixture.id, fixture.name) : undefined}
        previewUrl={fixture?.previewUrl}
        routes={fixture?.routes}
        unsupportedRoutes={fixture?.unsupportedRoutes}
        activeRoute={fixture?.activeRoute}
        workspace={workspace}
      />
      <section className="developer-notes">
        <h2>Developer notes</h2>
        <p>
          Each fixture is a git-ignored copy of a project in
          <code> examples/ </code>
          under <code>apps/playground/.workspace/</code>, with its own Next.js
          dev server. Edits are written there, never to <code>examples/</code>.
          Delete that folder (or start with
          <code> ALLSTUDIO_RESET_WORKSPACE=1</code>) to start over.
        </p>
      </section>
    </div>
  );
}
