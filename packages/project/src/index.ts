export const PROJECT_SCHEMA_VERSION = 1 as const;

export type ArtifactKind = "site" | "board";

export interface ProjectArtifactV1 {
  id: string;
  kind: ArtifactKind;
  path: string;
}

export interface ProjectManifestV1 {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  projectId: string;
  name: string;
  artifacts: ProjectArtifactV1[];
  sourceFramework?: "nextjs-react";
  createdAt: string;
}

export class ProjectManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectManifestError";
  }
}

export function isSafeRelativePath(path: string): boolean {
  if (path.length === 0 || path.startsWith("/") || path.includes("\\")) {
    return false;
  }
  const segments = path.split("/");
  return segments.every(
    (segment) => segment !== "" && segment !== "." && segment !== "..",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isArtifactKind(value: unknown): value is ArtifactKind {
  return value === "site" || value === "board";
}

export function parseProjectManifest(value: unknown): ProjectManifestV1 {
  if (!isRecord(value)) {
    throw new ProjectManifestError("Manifest must be an object.");
  }
  if (value.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new ProjectManifestError(
      `Unsupported schemaVersion: ${String(value.schemaVersion)}`,
    );
  }
  if (typeof value.projectId !== "string" || value.projectId.length === 0) {
    throw new ProjectManifestError("projectId must be a non-empty string.");
  }
  if (typeof value.name !== "string" || value.name.length === 0) {
    throw new ProjectManifestError("name must be a non-empty string.");
  }
  if (typeof value.createdAt !== "string" || value.createdAt.length === 0) {
    throw new ProjectManifestError("createdAt must be a non-empty string.");
  }
  if (!Array.isArray(value.artifacts)) {
    throw new ProjectManifestError("artifacts must be an array.");
  }

  const artifacts: ProjectArtifactV1[] = value.artifacts.map(
    (artifact, index) => {
      if (!isRecord(artifact)) {
        throw new ProjectManifestError(
          `artifacts[${index}] must be an object.`,
        );
      }
      if (typeof artifact.id !== "string" || artifact.id.length === 0) {
        throw new ProjectManifestError(`artifacts[${index}].id is required.`);
      }
      if (!isArtifactKind(artifact.kind)) {
        throw new ProjectManifestError(
          `artifacts[${index}].kind must be "site" or "board".`,
        );
      }
      if (
        typeof artifact.path !== "string" ||
        !isSafeRelativePath(artifact.path)
      ) {
        throw new ProjectManifestError(
          `artifacts[${index}].path must be a safe relative path.`,
        );
      }
      return {
        id: artifact.id,
        kind: artifact.kind,
        path: artifact.path,
      };
    },
  );

  const manifest: ProjectManifestV1 = {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: value.projectId,
    name: value.name,
    artifacts,
    createdAt: value.createdAt,
  };

  if (value.sourceFramework !== undefined) {
    if (value.sourceFramework !== "nextjs-react") {
      throw new ProjectManifestError(
        `Unsupported sourceFramework: ${String(value.sourceFramework)}`,
      );
    }
    manifest.sourceFramework = "nextjs-react";
  }

  return manifest;
}
