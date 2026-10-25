import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createBridgeNonce,
  createEditorMessage,
  type PreviewElementSnapshot,
  type PreviewMessageRejection,
  parsePreviewMessage,
} from "../preview-bridge/protocol.ts";

export interface PreviewBridgeHandlers {
  onSelect(clickedTag: string, element: PreviewElementSnapshot | null): void;
  onElement(oid: string, element: PreviewElementSnapshot | null): void;
}

export interface PreviewBridge {
  connected: boolean;
  /** Last message from the preview origin that failed validation. */
  lastRejection: PreviewMessageRejection | null;
  track(oid: string | null): void;
  /** Call from the iframe `load` event. */
  handleFrameLoad(): void;
}

/**
 * Editor side of the preview handshake: `boot` from the bridge → `hello` with
 * a fresh nonce → `ready`. Messages are accepted only from the preview origin,
 * from this iframe's window, and with the current nonce.
 */
export function usePreviewBridge(
  frame: RefObject<HTMLIFrameElement | null>,
  previewOrigin: string,
  handlers: PreviewBridgeHandlers,
): PreviewBridge {
  const [connected, setConnected] = useState(false);
  const [lastRejection, setLastRejection] =
    useState<PreviewMessageRejection | null>(null);
  const nonce = useRef<string | null>(null);
  const connectedRef = useRef(false);
  const tracked = useRef<string | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const post = useCallback(
    (message: Parameters<typeof createEditorMessage>[0]) => {
      frame.current?.contentWindow?.postMessage(
        createEditorMessage(message),
        previewOrigin,
      );
    },
    [frame, previewOrigin],
  );

  const sendHello = useCallback(() => {
    const next = createBridgeNonce();
    nonce.current = next;
    connectedRef.current = false;
    setConnected(false);
    post({ type: "hello", nonce: next });
  }, [post]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const parsed = parsePreviewMessage(event, {
        previewOrigin,
        previewWindow: frame.current?.contentWindow ?? null,
        nonce: nonce.current,
      });
      if (!parsed.ok) {
        // Other origins (devtools, extensions) are dropped without noise.
        if (event.origin === previewOrigin) {
          setLastRejection(parsed.reason);
        }
        return;
      }
      const { message } = parsed;
      if (message.type === "boot") {
        sendHello();
        return;
      }
      if (message.type === "ready") {
        connectedRef.current = true;
        setConnected(true);
        if (tracked.current && nonce.current) {
          post({ type: "track", nonce: nonce.current, oid: tracked.current });
        }
        return;
      }
      if (message.type === "select") {
        tracked.current = message.element?.oid ?? null;
        handlersRef.current.onSelect(message.clickedTag, message.element);
        return;
      }
      handlersRef.current.onElement(message.oid, message.element);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frame, previewOrigin, post, sendHello]);

  const track = useCallback(
    (oid: string | null) => {
      tracked.current = oid;
      if (connectedRef.current && nonce.current) {
        post({ type: "track", nonce: nonce.current, oid });
      }
    },
    [post],
  );

  const handleFrameLoad = useCallback(() => {
    // `boot` normally arrives first; this covers a boot sent before we listened.
    if (!connectedRef.current) {
      sendHello();
    }
  }, [sendHello]);

  return { connected, lastRejection, track, handleFrameLoad };
}
