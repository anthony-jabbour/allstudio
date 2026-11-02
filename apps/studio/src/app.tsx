import { useMemo } from "react";
import { ChatStore } from "./chat/chat-model.ts";
import { ChatPage } from "./chat/chat-page.tsx";
import { ChatStoreContext } from "./chat/use-chats.ts";
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
  const chats = useMemo(() => new ChatStore(browserStorage()), []);
  const route = useRoute();
  const theme = useTheme();
  return (
    <FileStoreContext.Provider value={store}>
      <ChatStoreContext.Provider value={chats}>
        <ToastProvider>
          {route.name === "chat" ? (
            <ChatPage
              conversationId={route.id}
              theme={theme.preference}
              onTheme={theme.set}
            />
          ) : route.name === "file" ? (
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
      </ChatStoreContext.Provider>
    </FileStoreContext.Provider>
  );
}
