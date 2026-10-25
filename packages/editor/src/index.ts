export type { EditorShellProps } from "./shell/editor-shell.tsx";
export { EDITOR_STATUS, EditorShell } from "./shell/editor-shell.tsx";
export type {
  ElementEdit,
  InstrumentResult,
  LocateSourceOptions,
  PreviewPatchResult,
  SourceLocation,
  SourceMapperError,
} from "./source-mapper/index.ts";
export {
  instrumentSource,
  locateSource,
  previewPatch,
} from "./source-mapper/index.ts";
