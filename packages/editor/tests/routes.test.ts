import { describe, expect, it } from "vitest";
import {
  type DiscoveredRoute,
  discoverAppRouterRoutes,
  type ProjectRoutesSnapshot,
  parseSelectRouteBody,
  resolvePreviewRouteUrl,
  sourceEditFailure,
  type UnsupportedRoute,
  validateRoutePath,
} from "../src/index.ts";
import {
  discoverAppRouterRoutes as shellDiscoverAppRouterRoutes,
  parseSelectRouteBody as shellParseSelectRouteBody,
  resolvePreviewRouteUrl as shellResolvePreviewRouteUrl,
  validateRoutePath as shellValidateRoutePath,
} from "../src/shell/index.ts";

describe("discoverAppRouterRoutes", () => {
  it("discovers root and nested static App Router page.tsx and page.jsx routes", () => {
    const snapshot = discoverAppRouterRoutes([
      "src/app/company/team/page.jsx",
      "src/app/about/page.tsx",
      "src/app/page.tsx",
    ]);

    expect(snapshot.routes).toEqual<DiscoveredRoute[]>([
      { route: "/", sourcePath: "src/app/page.tsx" },
      { route: "/about", sourcePath: "src/app/about/page.tsx" },
      { route: "/company/team", sourcePath: "src/app/company/team/page.jsx" },
    ]);
    expect(snapshot.unsupported).toEqual([]);
  });

  it("ignores non-page files and files outside src/app", () => {
    const snapshot = discoverAppRouterRoutes([
      "src/app/page.tsx",
      "src/app/layout.tsx",
      "src/app/loading.tsx",
      "src/app/error.tsx",
      "src/app/not-found.tsx",
      "src/app/template.tsx",
      "src/app/default.tsx",
      "src/app/api/route.ts",
      "src/components/header.tsx",
      "pages/index.tsx",
    ]);

    expect(snapshot.routes).toEqual([
      { route: "/", sourcePath: "src/app/page.tsx" },
    ]);
    expect(snapshot.unsupported).toEqual([]);
  });

  it("unwraps unambiguous single, nested, and root route groups", () => {
    const nested = discoverAppRouterRoutes([
      "src/app/(marketing)/pricing/page.tsx",
      "src/app/(marketing)/(landing)/features/page.tsx",
      "src/app/(marketing)/page.tsx",
    ]);

    expect(nested.routes).toEqual<DiscoveredRoute[]>([
      { route: "/", sourcePath: "src/app/(marketing)/page.tsx" },
      {
        route: "/features",
        sourcePath: "src/app/(marketing)/(landing)/features/page.tsx",
      },
      {
        route: "/pricing",
        sourcePath: "src/app/(marketing)/pricing/page.tsx",
      },
    ]);
    expect(nested.unsupported).toEqual([]);
  });

  it("rejects root, extension, and route-group collisions into unsupported as ambiguous-route", () => {
    const rootCollision = discoverAppRouterRoutes([
      "src/app/page.tsx",
      "src/app/(marketing)/page.tsx",
      "src/app/about/page.tsx",
    ]);

    expect(rootCollision.routes).toEqual([
      { route: "/about", sourcePath: "src/app/about/page.tsx" },
    ]);
    expect(rootCollision.unsupported).toEqual<UnsupportedRoute[]>([
      {
        route: "/",
        sourcePath: "src/app/(marketing)/page.tsx",
        reason: "ambiguous-route",
        message: expect.stringContaining("/"),
      },
      {
        route: "/",
        sourcePath: "src/app/page.tsx",
        reason: "ambiguous-route",
        message: expect.stringContaining("/"),
      },
    ]);

    const extensionCollision = discoverAppRouterRoutes([
      "src/app/page.tsx",
      "src/app/about/page.tsx",
      "src/app/about/page.jsx",
    ]);

    expect(extensionCollision.routes).toEqual([
      { route: "/", sourcePath: "src/app/page.tsx" },
    ]);
    expect(extensionCollision.unsupported).toEqual<UnsupportedRoute[]>([
      {
        route: "/about",
        sourcePath: "src/app/about/page.jsx",
        reason: "ambiguous-route",
        message: expect.stringContaining("/about"),
      },
      {
        route: "/about",
        sourcePath: "src/app/about/page.tsx",
        reason: "ambiguous-route",
        message: expect.stringContaining("/about"),
      },
    ]);

    const groupCollision = discoverAppRouterRoutes([
      "src/app/(marketing)/pricing/page.tsx",
      "src/app/(shop)/pricing/page.tsx",
    ]);

    expect(groupCollision.routes).toEqual([]);
    expect(groupCollision.unsupported).toEqual<UnsupportedRoute[]>([
      {
        route: "/pricing",
        sourcePath: "src/app/(marketing)/pricing/page.tsx",
        reason: "ambiguous-route",
        message: expect.stringContaining("/pricing"),
      },
      {
        route: "/pricing",
        sourcePath: "src/app/(shop)/pricing/page.tsx",
        reason: "ambiguous-route",
        message: expect.stringContaining("/pricing"),
      },
    ]);
  });

  it("reports dynamic, catch-all, parallel, intercepting, private, and invalid-segment routes in unsupported", () => {
    const snapshot = discoverAppRouterRoutes([
      "src/app/journal/[slug]/page.tsx",
      "src/app/docs/[...slug]/page.tsx",
      "src/app/shop/[[...slug]]/page.tsx",
      "src/app/@modal/login/page.tsx",
      "src/app/feed/(..)photo/[id]/page.tsx",
      "src/app/(.)login/page.tsx",
      "src/app/_internal/page.tsx",
      "src/app/bad segment/page.tsx",
    ]);

    expect(snapshot.routes).toEqual([]);
    expect(snapshot.unsupported).toEqual<UnsupportedRoute[]>([
      {
        route: "/(.)login",
        sourcePath: "src/app/(.)login/page.tsx",
        reason: "intercepting-route",
        message: expect.any(String),
      },
      {
        route: "/@modal/login",
        sourcePath: "src/app/@modal/login/page.tsx",
        reason: "parallel-route",
        message: expect.any(String),
      },
      {
        route: "/_internal",
        sourcePath: "src/app/_internal/page.tsx",
        reason: "private-route",
        message: expect.any(String),
      },
      {
        route: "/bad segment",
        sourcePath: "src/app/bad segment/page.tsx",
        reason: "invalid-segment",
        message: expect.any(String),
      },
      {
        route: "/docs/[...slug]",
        sourcePath: "src/app/docs/[...slug]/page.tsx",
        reason: "catch-all-route",
        message: expect.any(String),
      },
      {
        route: "/feed/(..)photo/[id]",
        sourcePath: "src/app/feed/(..)photo/[id]/page.tsx",
        reason: "intercepting-route",
        message: expect.any(String),
      },
      {
        route: "/journal/[slug]",
        sourcePath: "src/app/journal/[slug]/page.tsx",
        reason: "dynamic-route",
        message: expect.any(String),
      },
      {
        route: "/shop/[[...slug]]",
        sourcePath: "src/app/shop/[[...slug]]/page.tsx",
        reason: "catch-all-route",
        message: expect.any(String),
      },
    ]);
    for (const entry of snapshot.unsupported) {
      expect(entry.message.length).toBeGreaterThan(10);
    }
  });

  it("sorts routes with '/' first then lexicographically, and unsupported by sourcePath", () => {
    const snapshot = discoverAppRouterRoutes([
      "src/app/zeta/page.tsx",
      "src/app/alpha/page.tsx",
      "src/app/page.tsx",
      "src/app/alpha/nested/page.tsx",
      "src/app/journal/[slug]/page.tsx",
      "src/app/_private/page.tsx",
    ]);

    expect(snapshot.routes.map((entry) => entry.route)).toEqual([
      "/",
      "/alpha",
      "/alpha/nested",
      "/zeta",
    ]);
    expect(snapshot.unsupported.map((entry) => entry.sourcePath)).toEqual([
      "src/app/_private/page.tsx",
      "src/app/journal/[slug]/page.tsx",
    ]);
  });
});

describe("validateRoutePath", () => {
  it.each([
    "/",
    "/about",
    "/company/team",
    "/v1.2/release_notes-1",
  ])("accepts valid static route path %s", (route) => {
    expect(validateRoutePath(route)).toEqual({ ok: true, route });
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["number", 42],
    ["object", { route: "/about" }],
    ["empty string", ""],
    ["oversized string", `/${"a".repeat(256)}`],
    ["leading whitespace", " /about"],
    ["trailing whitespace", "/about "],
    ["internal whitespace", "/about us"],
    ["missing leading slash", "about"],
    ["trailing slash", "/about/"],
    ["root double slash", "//evil"],
    ["leading double slash", "//about"],
    ["nested double slash", "/about//team"],
    ["http URL", "http://127.0.0.1"],
    ["javascript scheme", "javascript:alert(1)"],
    ["backslash", "/about\\team"],
    ["query string", "/about?x=1"],
    ["hash fragment", "/about#top"],
    ["percent encoding", "/%2e%2e"],
    ["single dot segment", "/."],
    ["double dot segment", "/.."],
    ["nested dot traversal", "/about/../secret"],
    ["NUL control char", "/about\u0000"],
    ["newline control char", "/about\n"],
    ["DEL control char", "/about\u007f"],
    ["dynamic brackets", "/journal/[slug]"],
  ])("rejects %s", (_label, input) => {
    expect(validateRoutePath(input)).toEqual({
      ok: false,
      reason: "invalid-request",
      message: expect.any(String),
    });
  });
});

describe("resolvePreviewRouteUrl", () => {
  const snapshot: ProjectRoutesSnapshot = discoverAppRouterRoutes([
    "src/app/page.tsx",
    "src/app/about/page.tsx",
    "src/app/company/team/page.jsx",
    "src/app/journal/[slug]/page.tsx",
    "src/app/_internal/page.tsx",
    "src/app/(marketing)/pricing/page.tsx",
    "src/app/(shop)/pricing/page.tsx",
  ]);

  it("resolves valid discovered static routes against basePreviewUrl preserving exact loopback origin", () => {
    expect(
      resolvePreviewRouteUrl("http://127.0.0.1:4321/", "/", snapshot),
    ).toEqual({
      ok: true,
      route: "/",
      sourcePath: "src/app/page.tsx",
      previewUrl: "http://127.0.0.1:4321/",
    });

    expect(
      resolvePreviewRouteUrl("http://127.0.0.1:4321/", "/about", snapshot),
    ).toEqual({
      ok: true,
      route: "/about",
      sourcePath: "src/app/about/page.tsx",
      previewUrl: "http://127.0.0.1:4321/about",
    });

    expect(
      resolvePreviewRouteUrl(
        "http://127.0.0.1:4321/about",
        "/company/team",
        snapshot,
      ),
    ).toEqual({
      ok: true,
      route: "/company/team",
      sourcePath: "src/app/company/team/page.jsx",
      previewUrl: "http://127.0.0.1:4321/company/team",
    });
  });

  it("rejects unsupported dynamic, private, and ambiguous routes with route-unsupported", () => {
    expect(
      resolvePreviewRouteUrl(
        "http://127.0.0.1:4321/",
        "/journal/[slug]",
        snapshot,
      ),
    ).toEqual({
      ok: false,
      reason: "route-unsupported",
      message: expect.stringContaining("/journal/[slug]"),
    });

    expect(
      resolvePreviewRouteUrl("http://127.0.0.1:4321/", "/pricing", snapshot),
    ).toEqual({
      ok: false,
      reason: "route-unsupported",
      message: expect.stringContaining("/pricing"),
    });

    expect(
      resolvePreviewRouteUrl("http://127.0.0.1:4321/", "/_internal", snapshot),
    ).toEqual({
      ok: false,
      reason: "route-unsupported",
      message: expect.stringContaining("/_internal"),
    });
  });

  it.each([
    "http://evil.com",
    "//evil.com",
    "/../secret",
    "/about?x=1",
    "/about#hash",
    "/%2e%2e",
    "/about\\team",
    null,
    123,
  ])("rejects hostile route input %j with invalid-request", (hostile) => {
    expect(
      resolvePreviewRouteUrl("http://127.0.0.1:4321/", hostile, snapshot),
    ).toEqual({
      ok: false,
      reason: "invalid-request",
      message: expect.any(String),
    });
  });

  it("rejects unknown valid-format routes with route-not-found", () => {
    expect(
      resolvePreviewRouteUrl("http://127.0.0.1:4321/", "/missing", snapshot),
    ).toEqual({
      ok: false,
      reason: "route-not-found",
      message: expect.any(String),
    });
  });

  it("rejects non-loopback or malformed basePreviewUrl", () => {
    expect(
      resolvePreviewRouteUrl("https://evil.example.com/", "/about", snapshot),
    ).toEqual({
      ok: false,
      reason: "invalid-request",
      message: expect.any(String),
    });
    expect(resolvePreviewRouteUrl("not-a-url", "/about", snapshot)).toEqual({
      ok: false,
      reason: "invalid-request",
      message: expect.any(String),
    });
  });
});

describe("parseSelectRouteBody and re-exports", () => {
  it("accepts exact { route } body with a non-empty bounded string", () => {
    expect(parseSelectRouteBody({ route: "/about" })).toEqual({
      route: "/about",
    });
    expect(parseSelectRouteBody({ route: "/" })).toEqual({ route: "/" });
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["string", "not-an-object"],
    ["array", []],
    ["empty object", {}],
    ["empty route", { route: "" }],
    ["oversized route", { route: `/${"a".repeat(256)}` }],
    ["numeric route", { route: 123 }],
    ["unexpected extra key", { route: "/about", extra: true }],
  ])("rejects malformed select-route request body (%s)", (_label, body) => {
    expect(parseSelectRouteBody(body)).toBeNull();
  });

  it("exposes route failure reasons and re-exports from shell entry", () => {
    expect(sourceEditFailure("route-not-found")).toEqual({
      ok: false,
      reason: "route-not-found",
      message: expect.any(String),
    });
    expect(sourceEditFailure("route-unsupported")).toEqual({
      ok: false,
      reason: "route-unsupported",
      message: expect.any(String),
    });
    expect(shellDiscoverAppRouterRoutes).toBe(discoverAppRouterRoutes);
    expect(shellValidateRoutePath).toBe(validateRoutePath);
    expect(shellResolvePreviewRouteUrl).toBe(resolvePreviewRouteUrl);
    expect(shellParseSelectRouteBody).toBe(parseSelectRouteBody);
  });
});
