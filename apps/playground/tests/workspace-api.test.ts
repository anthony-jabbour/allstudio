import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DevWorkspace } from "../dev/dev-workspace.ts";
import { prepareWorkspace } from "../dev/prepare-workspace.ts";
import {
  createWorkspaceApiMiddleware,
  parseTextEditBody,
  SESSION_HEADER,
} from "../dev/workspace-api.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const EDITOR_ORIGIN = "http://localhost:5173";
const TOKEN = "t".repeat(64);

let tmp: string;
let server: Server;
let base: string;

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "allstudio-api-"));
  const workspaceDir = join(tmp, "workspace");
  await prepareWorkspace({
    fixtureDir: join(repoRoot, "examples/nextjs-site-fixture"),
    workspaceDir,
    bridgeSourceFile: join(
      repoRoot,
      "packages/editor/src/preview-bridge/client.ts",
    ),
    editorOrigin: EDITOR_ORIGIN,
  });
  const middleware = createWorkspaceApiMiddleware({
    workspace: await DevWorkspace.open(workspaceDir),
    editorOrigin: EDITOR_ORIGIN,
    sessionToken: TOKEN,
  });
  server = createServer((req, res) => {
    void middleware(req, res, () => {
      res.statusCode = 404;
      res.end("next");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(tmp, { recursive: true, force: true });
});

const goodHeaders = {
  origin: EDITOR_ORIGIN,
  "content-type": "application/json",
  "sec-fetch-site": "same-origin",
  [SESSION_HEADER]: TOKEN,
};

async function post(
  action: string,
  body: unknown,
  headers: Record<string, string> = goodHeaders,
) {
  const res = await fetch(`${base}/__allstudio/workspace/${action}`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

describe("workspace API guard", () => {
  it("serves locate for an authorized editor request", async () => {
    const result = await post("locate", { oid: "zzzzzzz" });
    expect(result).toMatchObject({
      status: 404,
      body: { ok: false, reason: "oid-not-found" },
    });
  });

  it.each([
    ["missing token", { ...goodHeaders, [SESSION_HEADER]: "" }],
    ["wrong token", { ...goodHeaders, [SESSION_HEADER]: "x".repeat(64) }],
    ["preview origin", { ...goodHeaders, origin: "http://localhost:3101" }],
    [
      "missing origin",
      { "content-type": "application/json", [SESSION_HEADER]: TOKEN },
    ],
    ["cross-site fetch", { ...goodHeaders, "sec-fetch-site": "cross-site" }],
    ["same-site fetch", { ...goodHeaders, "sec-fetch-site": "same-site" }],
    ["form content type", { ...goodHeaders, "content-type": "text/plain" }],
  ])("rejects %s", async (_label, headers) => {
    const result = await post(
      "locate",
      { oid: "zzzzzzz" },
      headers as Record<string, string>,
    );
    expect(result).toMatchObject({
      status: 403,
      body: { ok: false, reason: "unauthorized" },
    });
  });

  it("rejects GET requests", async () => {
    const res = await fetch(`${base}/__allstudio/workspace/locate`, {
      headers: goodHeaders,
    });
    expect(res.status).toBe(403);
  });

  it("passes unrelated URLs to the next middleware", async () => {
    const res = await fetch(`${base}/src/main.tsx`);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("next");
  });

  it.each([
    [
      "extra keys",
      {
        path: "src/app/page.tsx",
        oid: "abcdefg",
        expectedSha256: "0".repeat(64),
        text: "x",
        write: "/etc",
      },
    ],
    ["missing hash", { path: "src/app/page.tsx", oid: "abcdefg", text: "x" }],
    [
      "bad hash",
      {
        path: "src/app/page.tsx",
        oid: "abcdefg",
        expectedSha256: "nothex",
        text: "x",
      },
    ],
    [
      "bad oid",
      {
        path: "src/app/page.tsx",
        oid: "../../x",
        expectedSha256: "0".repeat(64),
        text: "x",
      },
    ],
    [
      "long text",
      {
        path: "src/app/page.tsx",
        oid: "abcdefg",
        expectedSha256: "0".repeat(64),
        text: "x".repeat(501),
      },
    ],
    ["invalid json", "{"],
  ])("rejects invalid edit bodies: %s", async (_label, body) => {
    const result = await post("apply-text", body);
    expect(result).toMatchObject({
      status: 400,
      body: { ok: false, reason: "invalid-request" },
    });
  });

  it("rejects paths outside the workspace", async () => {
    const result = await post("apply-text", {
      path: "src/../../../../etc/passwd",
      oid: "abcdefg",
      expectedSha256: "0".repeat(64),
      text: "x",
    });
    expect(result).toMatchObject({
      status: 403,
      body: { ok: false, reason: "path-rejected" },
    });
  });

  it("rejects oversized bodies", async () => {
    const result = await post(
      "locate",
      JSON.stringify({ oid: "a".repeat(20_000) }),
    );
    expect(result).toMatchObject({
      status: 400,
      body: { reason: "invalid-request" },
    });
  });

  it("parses a valid edit body", () => {
    const body = {
      path: "src/app/page.tsx",
      oid: "abc.d-:",
      expectedSha256: "a".repeat(64),
      text: "",
    };
    expect(parseTextEditBody(body)).toEqual(body);
  });
});
