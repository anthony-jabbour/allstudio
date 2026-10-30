export interface RuntimeInfo {
  version: string;
  electron: string;
  packaged: boolean;
}

export interface DesktopApi {
  runtime(): Promise<RuntimeInfo>;
  recent(): Promise<RecentProject[]>;
  chooseProject(): Promise<ProjectResult>;
  openRecent(id: string): Promise<ProjectResult>;
  closeProject(): Promise<ProjectResult>;
  locate(projectId: string, oid: string): Promise<LocateElementResult>;
  previewTextEdit(
    projectId: string,
    request: TextEditRequest,
  ): Promise<TextEditResult>;
  applyTextEdit(
    projectId: string,
    request: TextEditRequest,
  ): Promise<TextEditResult>;
  previewClassEdit(
    projectId: string,
    request: ClassEditRequest,
  ): Promise<TextEditResult>;
  applyClassEdit(
    projectId: string,
    request: ClassEditRequest,
  ): Promise<TextEditResult>;
  selectRoute(projectId: string, route: string): Promise<SelectRouteResult>;
  undo(projectId: string): Promise<TextEditResult>;
  redo(projectId: string): Promise<TextEditResult>;
  onChange(callback: (message: string) => void): () => void;
}

export const RUNTIME_CHANNEL = "allstudio:runtime";

import type {
  ClassEditRequest,
  DiscoveredRoute,
  LocateElementResult,
  SelectRouteResult,
  TextEditRequest,
  TextEditResult,
  UnsupportedRoute,
} from "@allstudio/editor/site";

export interface RecentProject {
  id: string;
  name: string;
  path: string;
}
export interface OpenProject extends RecentProject {
  previewUrl: string;
  activeRoute: string;
  routes: DiscoveredRoute[];
  unsupportedRoutes: UnsupportedRoute[];
}
export type ProjectResult =
  | { ok: true; project: OpenProject | null; unchanged?: boolean }
  | { ok: false; message: string; project: OpenProject | null };
export const PROJECT_CHANNEL = "allstudio:project";
export const CHANGE_CHANNEL = "allstudio:change";
