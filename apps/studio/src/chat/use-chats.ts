import { createContext, useContext, useSyncExternalStore } from "react";
import type { ChatStore, Conversation } from "./chat-model.ts";

export const ChatStoreContext = createContext<ChatStore | null>(null);

export function useChatStore(): ChatStore {
  const store = useContext(ChatStoreContext);
  if (!store) throw new Error("ChatStoreContext is missing.");
  return store;
}

export function useConversations(): Conversation[] {
  const store = useChatStore();
  return useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.list(),
  );
}
