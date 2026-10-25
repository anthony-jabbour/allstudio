import {
  type ClassEditRequest,
  type LocateElementResult,
  type SourceEditWorkspace,
  sourceEditFailure,
  type TextEditRequest,
  type TextEditResult,
} from "@allstudio/editor/shell";

const API_PREFIX = "/__allstudio/workspace/";

/** Browser client for the development workspace API (`dev/workspace-api.ts`). */
export function createHttpWorkspace(
  sessionToken: string,
  fixtureId: string,
): SourceEditWorkspace {
  async function call<T>(action: string, body: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${API_PREFIX}${fixtureId}/${action}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-allstudio-session": sessionToken,
        },
        body: JSON.stringify(body),
      });
    } catch {
      return sourceEditFailure("unavailable") as T;
    }
    try {
      return (await response.json()) as T;
    } catch {
      return sourceEditFailure("unavailable") as T;
    }
  }

  return {
    locate: (oid) => call<LocateElementResult>("locate", { oid }),
    previewTextEdit: (request: TextEditRequest) =>
      call<TextEditResult>("preview-text", request),
    applyTextEdit: (request: TextEditRequest) =>
      call<TextEditResult>("apply-text", request),
    previewClassEdit: (request: ClassEditRequest) =>
      call<TextEditResult>("preview-class", request),
    applyClassEdit: (request: ClassEditRequest) =>
      call<TextEditResult>("apply-class", request),
  };
}

export function readMeta(name: string): string | null {
  return (
    document
      .querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
      ?.getAttribute("content") ?? null
  );
}

export interface PlaygroundFixture {
  id: string;
  name: string;
  previewUrl: string;
}

/** Fixture list injected by the dev-workspace plugin; empty in `vite build`. */
export function readFixtures(): PlaygroundFixture[] {
  try {
    const parsed: unknown = JSON.parse(readMeta("allstudio-fixtures") ?? "[]");
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is PlaygroundFixture =>
        typeof item?.id === "string" &&
        typeof item?.name === "string" &&
        typeof item?.previewUrl === "string",
    );
  } catch {
    return [];
  }
}
