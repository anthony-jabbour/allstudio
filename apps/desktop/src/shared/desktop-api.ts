export interface RuntimeInfo {
  version: string;
  electron: string;
  packaged: boolean;
}

export interface DesktopApi {
  listAssets(projectId: string): Promise<ProjectAsset[]>;
  previewAssetEdit(
    projectId: string,
    request: AssetEditRequest,
  ): Promise<TextEditResult>;
  applyAssetEdit(
    projectId: string,
    request: AssetEditRequest,
  ): Promise<TextEditResult>;
  captureProjectPreview(
    projectId: string,
    bounds: PreviewBounds,
  ): Promise<boolean>;
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
  previewReorder(
    projectId: string,
    request: ReorderEditRequest,
  ): Promise<TextEditResult>;
  applyReorder(
    projectId: string,
    request: ReorderEditRequest,
  ): Promise<TextEditResult>;
  getResponsiveCapabilities(projectId: string): Promise<ResponsiveCapabilities>;
  undo(projectId: string): Promise<TextEditResult>;
  redo(projectId: string): Promise<TextEditResult>;
  onChange(callback: (message: string) => void): () => void;
}

export const RUNTIME_CHANNEL = "allstudio:runtime";

import type {
  AssetEditRequest,
  ClassEditRequest,
  DiscoveredRoute,
  LocateElementResult,
  ProjectAsset,
  ReorderEditRequest,
  ResponsiveCapabilities,
  SelectRouteResult,
  TextEditRequest,
  TextEditResult,
  UnsupportedRoute,
} from "@allstudio/editor/site";

export interface RecentProject {
  id: string;
  name: string;
  path: string;
  thumbnail?: string;
}
export interface PreviewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function isPreviewBounds(value: unknown): value is PreviewBounds {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    Object.keys(item).sort().join(",") === "height,width,x,y" &&
    [item.x, item.y, item.width, item.height].every(
      (number) => typeof number === "number" && Number.isFinite(number),
    ) &&
    (item.x as number) >= 0 &&
    (item.y as number) >= 0 &&
    (item.width as number) >= 160 &&
    (item.height as number) >= 120 &&
    (item.width as number) <= 2048 &&
    (item.height as number) <= 1536
  );
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
