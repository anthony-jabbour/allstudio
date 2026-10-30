// Browser-safe entry: editor UI, preview protocol, and the workspace contract.
// It must not import the Babel-based source mapper, which runs in the
// workspace adapter (dev server today, Electron main process later).
export type {
  PreviewAppearance,
  PreviewElementSnapshot,
  PreviewLayerNode,
  PreviewLayersSnapshot,
  PreviewLayout,
  PreviewMessage,
  PreviewMessageRejection,
  PreviewSpacing,
  PreviewTypography,
} from "../preview-bridge/protocol.ts";
export type {
  ClassEditRequest,
  DiscoveredRoute,
  LocateElementResult,
  ProjectRoutesSnapshot,
  ResolvePreviewRouteUrlResult,
  SelectRouteRequest,
  SelectRouteResult,
  SelectRouteSuccess,
  SourceEditFailure,
  SourceEditFailureReason,
  SourceEditWorkspace,
  SourceElementInfo,
  TextEditRequest,
  TextEditResult,
  UnsupportedRoute,
  UnsupportedRouteReason,
  ValidateRoutePathResult,
} from "../site/source-edit-workspace.ts";
export {
  describeSourceEditFailure,
  discoverAppRouterRoutes,
  parseSelectRouteBody,
  resolvePreviewRouteUrl,
  sourceEditFailure,
  validateRoutePath,
} from "../site/source-edit-workspace.ts";
export type { EditorShellProps } from "./editor-shell.tsx";
export {
  EDITOR_STATUS,
  EditorShell,
  hasUnsavedInspectorDraft,
} from "./editor-shell.tsx";
