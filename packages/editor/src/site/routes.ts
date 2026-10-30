export interface DiscoveredRoute {
  /** Normalized static route path, e.g. `/` or `/about`. */
  route: string;
  /** Workspace-relative POSIX source path, e.g. `src/app/page.tsx`. */
  sourcePath: string;
}

export type UnsupportedRouteReason =
  | "dynamic-route"
  | "catch-all-route"
  | "parallel-route"
  | "intercepting-route"
  | "private-route"
  | "ambiguous-route"
  | "invalid-segment";

export interface UnsupportedRoute {
  /** Route display pattern, e.g. `/journal/[slug]` or `/@modal/login`. */
  route: string;
  /** Workspace-relative POSIX source path, e.g. `src/app/journal/[slug]/page.tsx`. */
  sourcePath: string;
  reason: UnsupportedRouteReason;
  message: string;
}

export interface ProjectRoutesSnapshot {
  routes: DiscoveredRoute[];
  unsupported: UnsupportedRoute[];
}

export type ValidateRoutePathResult =
  | { ok: true; route: string }
  | { ok: false; reason: "invalid-request"; message: string };

export type ResolvePreviewRouteUrlResult =
  | {
      ok: true;
      route: string;
      sourcePath: string;
      previewUrl: string;
    }
  | {
      ok: false;
      reason: "invalid-request" | "route-not-found" | "route-unsupported";
      message: string;
    };

const MAX_ROUTE_LENGTH = 256;
const APP_PAGE_PATTERN = /^src\/app\/(?:(.+)\/)?page\.(tsx|jsx)$/;
const ROUTE_GROUP_PATTERN = /^\([a-zA-Z0-9_-]+\)$/;
const STATIC_SEGMENT_PATTERN = /^[a-zA-Z0-9._-]+$/;
const HOSTILE_ROUTE_CHARS_PATTERN = /[\\:?#%]/;

function hasControlCharacters(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
      return true;
    }
  }
  return false;
}

function isRouteGroupSegment(segment: string): boolean {
  return ROUTE_GROUP_PATTERN.test(segment);
}

function isStaticSegment(segment: string): boolean {
  return (
    segment !== "." && segment !== ".." && STATIC_SEGMENT_PATTERN.test(segment)
  );
}

function classifyUnsupportedSegments(
  segments: readonly string[],
): Exclude<UnsupportedRouteReason, "ambiguous-route"> | null {
  if (segments.some((segment) => segment.startsWith("_"))) {
    return "private-route";
  }
  if (
    segments.some(
      (segment) =>
        segment.includes("(.)") ||
        segment.includes("(..)") ||
        segment.includes("(...)"),
    )
  ) {
    return "intercepting-route";
  }
  if (segments.some((segment) => segment.startsWith("@"))) {
    return "parallel-route";
  }
  if (segments.some((segment) => segment.includes("[..."))) {
    return "catch-all-route";
  }
  if (
    segments.some((segment) => segment.includes("[") || segment.includes("]"))
  ) {
    return "dynamic-route";
  }
  for (const segment of segments) {
    if (isRouteGroupSegment(segment)) {
      continue;
    }
    if (!isStaticSegment(segment)) {
      return "invalid-segment";
    }
  }
  return null;
}

function describeUnsupportedRoute(
  reason: Exclude<UnsupportedRouteReason, "ambiguous-route">,
  route: string,
  sourcePath: string,
): string {
  switch (reason) {
    case "dynamic-route":
      return `Dynamic route ${route} (${sourcePath}) requires runtime parameters and cannot be previewed directly.`;
    case "catch-all-route":
      return `Catch-all route ${route} (${sourcePath}) requires runtime parameters and cannot be previewed directly.`;
    case "parallel-route":
      return `Parallel route slot ${route} (${sourcePath}) cannot be navigated to as a standalone page.`;
    case "intercepting-route":
      return `Intercepting route ${route} (${sourcePath}) depends on client navigation state and cannot be previewed directly.`;
    case "private-route":
      return `Private folder route ${route} (${sourcePath}) is excluded from Next.js routing.`;
    case "invalid-segment":
      return `Route ${route} (${sourcePath}) contains an unsupported path segment.`;
  }
}

export function discoverAppRouterRoutes(
  sourcePaths: readonly string[],
): ProjectRoutesSnapshot {
  const uniquePaths = Array.from(new Set(sourcePaths));
  const candidatesByRoute = new Map<string, DiscoveredRoute[]>();
  const unsupported: UnsupportedRoute[] = [];

  for (const sourcePath of uniquePaths) {
    const match = APP_PAGE_PATTERN.exec(sourcePath);
    if (!match) {
      continue;
    }
    const rawSegments = match[1] ? match[1].split("/") : [];
    const urlSegments = rawSegments.filter(
      (segment) => !isRouteGroupSegment(segment),
    );
    const route = urlSegments.length === 0 ? "/" : `/${urlSegments.join("/")}`;
    const unsupportedReason = classifyUnsupportedSegments(rawSegments);

    if (unsupportedReason !== null) {
      unsupported.push({
        route,
        sourcePath,
        reason: unsupportedReason,
        message: describeUnsupportedRoute(unsupportedReason, route, sourcePath),
      });
      continue;
    }

    const existing = candidatesByRoute.get(route);
    if (existing) {
      existing.push({ route, sourcePath });
    } else {
      candidatesByRoute.set(route, [{ route, sourcePath }]);
    }
  }

  const routes: DiscoveredRoute[] = [];
  for (const [route, candidates] of candidatesByRoute.entries()) {
    if (candidates.length === 1 && candidates[0]) {
      routes.push(candidates[0]);
      continue;
    }
    const sortedCandidates = [...candidates].sort((a, b) =>
      a.sourcePath < b.sourcePath ? -1 : a.sourcePath > b.sourcePath ? 1 : 0,
    );
    const collidingSources = sortedCandidates
      .map((candidate) => candidate.sourcePath)
      .join(", ");
    for (const candidate of sortedCandidates) {
      unsupported.push({
        route,
        sourcePath: candidate.sourcePath,
        reason: "ambiguous-route",
        message: `Multiple page files resolve to ${route} (${collidingSources}). Refusing to guess which file to preview.`,
      });
    }
  }

  routes.sort((a, b) => {
    if (a.route === b.route) {
      return a.sourcePath < b.sourcePath
        ? -1
        : a.sourcePath > b.sourcePath
          ? 1
          : 0;
    }
    if (a.route === "/") {
      return -1;
    }
    if (b.route === "/") {
      return 1;
    }
    return a.route < b.route ? -1 : 1;
  });

  unsupported.sort((a, b) =>
    a.sourcePath < b.sourcePath ? -1 : a.sourcePath > b.sourcePath ? 1 : 0,
  );

  return { routes, unsupported };
}

function invalidRoute(message: string): {
  ok: false;
  reason: "invalid-request";
  message: string;
} {
  return { ok: false, reason: "invalid-request", message };
}

function isNonHostileRouteCandidate(route: unknown): route is string {
  if (typeof route !== "string") {
    return false;
  }
  if (route.length === 0 || route.length > MAX_ROUTE_LENGTH) {
    return false;
  }
  if (route.trim() !== route || /\s/.test(route)) {
    return false;
  }
  if (hasControlCharacters(route)) {
    return false;
  }
  if (!route.startsWith("/")) {
    return false;
  }
  if (route.includes("//") || HOSTILE_ROUTE_CHARS_PATTERN.test(route)) {
    return false;
  }
  if (route.length > 1 && route.endsWith("/")) {
    return false;
  }
  if (route !== "/") {
    const segments = route.slice(1).split("/");
    if (
      segments.some(
        (segment) => segment === "" || segment === "." || segment === "..",
      )
    ) {
      return false;
    }
  }
  return true;
}

export function validateRoutePath(route: unknown): ValidateRoutePathResult {
  if (!isNonHostileRouteCandidate(route)) {
    return invalidRoute("The requested route path is malformed.");
  }
  if (route.includes("[") || route.includes("]")) {
    return invalidRoute(
      "Dynamic route brackets are not valid static route paths.",
    );
  }
  if (route !== "/") {
    const segments = route.slice(1).split("/");
    if (!segments.every(isStaticSegment)) {
      return invalidRoute(
        "Route segments may only contain letters, digits, '.', '_', or '-'.",
      );
    }
  }
  return { ok: true, route };
}

export function resolvePreviewRouteUrl(
  basePreviewUrl: string,
  routeInput: unknown,
  snapshot: ProjectRoutesSnapshot,
): ResolvePreviewRouteUrlResult {
  if (!isNonHostileRouteCandidate(routeInput)) {
    return invalidRoute("The requested route path is malformed.");
  }

  const unsupportedMatch = snapshot.unsupported.find(
    (entry) => entry.route === routeInput,
  );
  if (unsupportedMatch) {
    return {
      ok: false,
      reason: "route-unsupported",
      message: unsupportedMatch.message,
    };
  }

  const validated = validateRoutePath(routeInput);
  if (!validated.ok) {
    return validated;
  }

  const matched = snapshot.routes.find(
    (entry) => entry.route === validated.route,
  );
  if (!matched) {
    return {
      ok: false,
      reason: "route-not-found",
      message: `Route ${validated.route} does not exist in this project.`,
    };
  }

  let base: URL;
  try {
    base = new URL(basePreviewUrl);
  } catch {
    return invalidRoute("The base preview URL is invalid.");
  }

  if (
    (base.protocol !== "http:" && base.protocol !== "https:") ||
    (base.hostname !== "127.0.0.1" &&
      base.hostname !== "localhost" &&
      base.hostname !== "[::1]")
  ) {
    return invalidRoute("The preview URL must use a loopback origin.");
  }

  const resolved = new URL(matched.route, base.origin);
  if (
    resolved.origin !== base.origin ||
    resolved.pathname !== matched.route ||
    resolved.search !== "" ||
    resolved.hash !== ""
  ) {
    return invalidRoute(
      "The resolved preview URL did not preserve the loopback origin.",
    );
  }

  return {
    ok: true,
    route: matched.route,
    sourcePath: matched.sourcePath,
    previewUrl: resolved.toString(),
  };
}
