// Browser-safe entry: editor UI, preview protocol, and the workspace contract.
// It must not import the Babel-based source mapper, which runs in the
// workspace adapter (dev server today, Electron main process later).
export type {
  PreviewElementSnapshot,
  PreviewLayerNode,
  PreviewLayersSnapshot,
  PreviewMessage,
  PreviewMessageRejection,
  PreviewTypography,
} from "../preview-bridge/protocol.ts";
export type {
  ClassEditRequest,
  LocateElementResult,
  SourceEditFailure,
  SourceEditFailureReason,
  SourceEditWorkspace,
  SourceElementInfo,
  TextEditRequest,
  TextEditResult,
} from "../site/source-edit-workspace.ts";
export {
  describeSourceEditFailure,
  sourceEditFailure,
} from "../site/source-edit-workspace.ts";
export type { EditorShellProps } from "./editor-shell.tsx";
export { EDITOR_STATUS, EditorShell } from "./editor-shell.tsx";
