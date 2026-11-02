import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import type { FileStore, StudioFile } from "./file-store.ts";

export const FileStoreContext = createContext<FileStore | null>(null);

export function useFileStore(): FileStore {
  const store = useContext(FileStoreContext);
  if (!store) throw new Error("FileStoreContext is missing.");
  return store;
}

/** Live file list; re-renders on local changes and other tabs' writes. */
export function useFiles(): StudioFile[] {
  const store = useFileStore();
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key?.startsWith("allstudio.")) store.refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [store]);
  const snapshot = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => JSON.stringify(store.list()),
  );
  return JSON.parse(snapshot) as StudioFile[];
}
