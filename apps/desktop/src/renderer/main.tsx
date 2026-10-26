import { EditorShell } from "@allstudio/editor/shell";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { DesktopApi, RuntimeInfo } from "../shared/desktop-api.ts";
import "../../../playground/src/styles.css";

declare global {
  interface Window {
    allstudio: DesktopApi;
  }
}

function App() {
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    window.allstudio
      .runtime()
      .then(setRuntime)
      .catch(() => setError(true));
  }, []);
  return (
    <main className="page">
      <output>
        {error
          ? "Desktop connection failed."
          : runtime
            ? `Electron ${runtime.electron} · ${runtime.packaged ? "Packaged" : "Development"} · Local editor`
            : "Connecting to desktop…"}
      </output>
      <EditorShell />
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Desktop root element #root was not found.");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
