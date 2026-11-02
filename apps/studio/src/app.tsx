import { useMemo } from "react";
import { browserStorage, FileStore } from "./files/file-store.ts";
import { FileStoreContext } from "./files/use-files.ts";
import { Home } from "./home/home.tsx";
import { useRoute } from "./router.ts";
import { ToastProvider } from "./ui/controls.tsx";
import { useTheme } from "./ui/theme.ts";
import { FileViewer } from "./viewer/file-viewer.tsx";
import { WorkspaceDashboard } from "./workspace/workspace-dashboard.tsx";

export function App() {
  const store = useMemo(() => new FileStore(browserStorage()), []);
  const route = useRoute();
  const theme = useTheme();
  return (
    <FileStoreContext.Provider value={store}>
      <ToastProvider>
        {route.name === "file" ? (
          <FileViewer id={route.id} />
        ) : route.name === "studio" ? (
          <WorkspaceDashboard
            section={route.section}
            theme={theme.preference}
            onTheme={theme.set}
          />
        ) : (
          <Home
            section={route.section}
            theme={theme.preference}
            onTheme={theme.set}
          />
        )}
      </ToastProvider>
    </FileStoreContext.Provider>
  );
}
