export interface RuntimeInfo {
  version: string;
  electron: string;
  packaged: boolean;
}

export interface DesktopApi {
  runtime(): Promise<RuntimeInfo>;
}

export const RUNTIME_CHANNEL = "allstudio:runtime";
