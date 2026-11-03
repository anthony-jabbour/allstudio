import type { BoardDocumentV1 } from "@allstudio/project";

/**
 * Undo/redo over immutable documents. Continuous gestures (dragging,
 * resizing, scrubbing) apply transient updates and commit one history entry
 * when the gesture ends, so a drag is a single undo step.
 */
export interface HistoryState {
  doc: BoardDocumentV1;
  past: BoardDocumentV1[];
  future: BoardDocumentV1[];
  /** Document before the in-flight gesture, if any. */
  gestureBase: BoardDocumentV1 | null;
}

export type HistoryAction =
  | { type: "set"; doc: BoardDocumentV1; transient?: boolean }
  | { type: "commitGesture" }
  | { type: "cancelGesture" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; doc: BoardDocumentV1 };

export const HISTORY_LIMIT = 200;

export function initialHistory(doc: BoardDocumentV1): HistoryState {
  return { doc, past: [], future: [], gestureBase: null };
}

function push(past: BoardDocumentV1[], doc: BoardDocumentV1) {
  const next = [...past, doc];
  return next.length > HISTORY_LIMIT ? next.slice(-HISTORY_LIMIT) : next;
}

export function historyReducer(
  state: HistoryState,
  action: HistoryAction,
): HistoryState {
  switch (action.type) {
    case "set": {
      if (action.doc === state.doc) return state;
      if (action.transient) {
        return {
          ...state,
          doc: action.doc,
          gestureBase: state.gestureBase ?? state.doc,
        };
      }
      const base = state.gestureBase ?? state.doc;
      return {
        doc: action.doc,
        past: push(state.past, base),
        future: [],
        gestureBase: null,
      };
    }
    case "commitGesture": {
      if (!state.gestureBase) return state;
      if (state.gestureBase === state.doc) {
        return { ...state, gestureBase: null };
      }
      return {
        doc: state.doc,
        past: push(state.past, state.gestureBase),
        future: [],
        gestureBase: null,
      };
    }
    case "cancelGesture":
      return state.gestureBase
        ? { ...state, doc: state.gestureBase, gestureBase: null }
        : state;
    case "undo": {
      const previous = state.past.at(-1);
      if (!previous || state.gestureBase) return state;
      return {
        doc: previous,
        past: state.past.slice(0, -1),
        future: [state.doc, ...state.future],
        gestureBase: null,
      };
    }
    case "redo": {
      const [next, ...rest] = state.future;
      if (!next || state.gestureBase) return state;
      return {
        doc: next,
        past: push(state.past, state.doc),
        future: rest,
        gestureBase: null,
      };
    }
    case "reset":
      return initialHistory(action.doc);
  }
}
