import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  describeElement,
  editElementClassName,
  editElementText,
  instrumentSource,
  listOids,
} from "../src/index.ts";

const examplesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../examples",
);

function jsxFiles(dir: string, prefix = ""): string[] {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap(
    (entry) => {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        return jsxFiles(dir, relative);
      }
      return /\.(tsx|jsx)$/.test(entry.name) ? [relative] : [];
    },
  );
}

const fixtureFiles = [
  "nextjs-site-fixture",
  "nested-components-fixture",
  "tailwind-variants-fixture",
].flatMap((fixture) =>
  jsxFiles(join(examplesDir, fixture, "src")).map((file) => ({
    name: `${fixture}/src/${file}`,
    content: readFileSync(join(examplesDir, fixture, "src", file), "utf8"),
  })),
);

const OID_INSERT = / data-oid="[^"]+"/g;

/** Oid of the element whose opening tag contains `marker`. */
function oidAfter(content: string, marker: string): string {
  const index = content.indexOf(marker);
  expect(index).toBeGreaterThan(-1);
  const oid = content.slice(index).match(/data-oid="([^"]+)"/)?.[1];
  expect(oid).toBeTruthy();
  return oid ?? "";
}

function instrument(content: string): string {
  const result = instrumentSource(content, { preserveFormatting: true });
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return result.content;
}

describe("format-preserving instrumentation", () => {
  it.each(fixtureFiles)("only inserts data-oid attributes in $name", ({
    content,
  }) => {
    const instrumented = instrument(content);
    expect(instrumented.replace(OID_INSERT, "")).toBe(content);
    const oids = listOids(instrumented) ?? [];
    expect(new Set(oids).size).toBe(oids.length);
    expect(instrumented).toBe(instrument(instrumented));
  });

  it("falls back to repairing duplicate oids", () => {
    const source = `export function D() {
  return <div><p data-oid="dup">a</p><p data-oid="dup">b</p></div>;
}
`;
    const oids = listOids(instrument(source)) ?? [];
    expect(oids).toHaveLength(3);
    expect(new Set(oids).size).toBe(3);
  });
});

describe("editElementText", () => {
  const page = fixtureFiles.find(
    (file) => file.name === "nextjs-site-fixture/src/app/page.tsx",
  );
  const instrumented = instrument(page?.content ?? "");

  it("keeps indentation of a multi-line text child", () => {
    const oid = oidAfter(instrumented, 'id="hero-heading"');
    const result = editElementText(
      instrumented,
      oid,
      "Aurora Atelier — edited",
    );
    expect(result).toMatchObject({ ok: true, strategy: "splice" });
    expect(result.ok && result.generated).toBe(
      instrumented.replace(
        "\n        Aurora Atelier\n",
        "\n        Aurora Atelier — edited\n",
      ),
    );
  });

  it.each([
    ["inline text", "<p>old</p>", "new", "<p>new</p>"],
    ["empty element", "<p></p>", "new", "<p>new</p>"],
    [
      "self-closing element",
      '<p data-oid="p1" />',
      "new",
      '<p data-oid="p1">new</p>',
    ],
    ["string literal child", '<p>{"old"}</p>', "new", '<p>{"new"}</p>'],
    [
      "JSX-significant characters",
      "<p>old</p>",
      "a < b & {c}",
      '<p>{"a < b & {c}"}</p>',
    ],
    ["leading space", "<p>old</p>", " padded", '<p>{" padded"}</p>'],
  ])("splices %s", (_label, markup, text, expected) => {
    const withOid = (jsx: string) =>
      jsx.includes("data-oid") ? jsx : jsx.replace(">", ' data-oid="p1">');
    const source = `export function P() {\n  return ${withOid(markup)};\n}\n`;
    const result = editElementText(source, "p1", text);
    expect(result).toMatchObject({ ok: true, strategy: "splice" });
    expect(result.ok && result.generated).toBe(
      `export function P() {\n  return ${withOid(expected)};\n}\n`,
    );
    const described = result.ok
      ? describeElement(result.generated, "p1")
      : null;
    expect(described?.ok && described.text).toEqual({ ok: true, text });
  });

  it("edits one ternary branch and keeps the condition and the other branch", () => {
    const source = `export function S({ on }: { on: boolean }) {
  return on ? (
    <span data-oid="on1">Synced</span>
  ) : (
    <span data-oid="off1">Offline</span>
  );
}
`;
    const result = editElementText(source, "on1", "Up to date");
    expect(result.ok && result.generated).toBe(
      source.replace(">Synced<", ">Up to date<"),
    );
  });

  it("edits text inside a && conditional without touching the condition", () => {
    const source = `export function B({ visible }: { visible: boolean }) {
  return <footer data-oid="f1">{visible && <p data-oid="b1">Backed up.</p>}</footer>;
}
`;
    const result = editElementText(source, "b1", "Saved locally.");
    expect(result.ok && result.generated).toBe(
      source.replace("Backed up.", "Saved locally."),
    );
  });

  it.each([
    ["expression text", "<p>{count} notes</p>"],
    ["only an expression", "<p>{children}</p>"],
    ["nested element", "<p>Hi <b>there</b></p>"],
    ["conditional child", "<p>{ok && 'Yes'}</p>"],
  ])("refuses %s with nothing generated", (_label, markup) => {
    const source = `export function P({ count, children, ok }: any) {\n  return ${markup.replace(">", ' data-oid="p1">')};\n}\n`;
    expect(editElementText(source, "p1", "x")).toEqual({
      ok: false,
      reason: "unsupported-dynamic-children",
    });
  });

  it("refuses multi-line text, missing and duplicated oids", () => {
    const source = `export function D() {
  return <div><p data-oid="dup">a</p><p data-oid="dup">b</p></div>;
}
`;
    expect(editElementText(source, "dup", "x")).toEqual({
      ok: false,
      reason: "oid-ambiguous",
    });
    expect(editElementText(source, "nope", "x")).toEqual({
      ok: false,
      reason: "oid-not-found",
    });
    expect(
      editElementText(
        instrumented,
        oidAfter(instrumented, 'id="hero-heading"'),
        "a\nb",
      ),
    ).toEqual({
      ok: false,
      reason: "unsupported-multiline-text",
    });
  });

  it("refuses a regenerated patch that would reformat other code", () => {
    // Comments plus text are not spliceable; Babel regeneration would also
    // reformat `const   spaced   =   1;`, so the edit must be refused.
    const source = `export function P() {
  const   spaced   =   1;
  return <div data-oid="d1">{spaced}<p data-oid="p1">{/* note */}Price {"<"} 5</p></div>;
}
`;
    expect(editElementText(source, "p1", "Free")).toEqual({
      ok: false,
      reason: "unconfined-patch",
    });
  });
});

describe("editElementClassName", () => {
  it("allows Tailwind arbitrary variants with & and >", () => {
    const source = `export const X = () => <ul data-oid="u1" className="grid">x</ul>;\n`;
    const result = editElementClassName(source, "u1", "grid [&>*]:p-2");
    expect(result.ok && result.generated).toContain(
      'className="grid [&>*]:p-2"',
    );
  });

  it("refuses duplicate className attributes", () => {
    const source = `export const X = () => <p data-oid="p1" className="a" className="b">x</p>;\n`;
    expect(editElementClassName(source, "p1", "c")).toEqual({
      ok: false,
      reason: "unsupported-className-expression",
    });
    const described = describeElement(source, "p1");
    expect(described.ok && described.className).toEqual({
      ok: false,
      reason: "unsupported-className-expression",
    });
  });

  const source = `export function C({ rest, on }: any) {
  return (
    <section data-oid="s1" className="grid gap-4 md:grid-cols-2">
      <a data-oid="a1" className='px-2 hover:bg-sky-500'>Go</a>
      <p data-oid="p1">Plain</p>
      <b data-oid="b1" className={\`px-2 \${on ? "x" : "y"}\`}>B</b>
      <i data-oid="i1" className="px-2" {...rest}>I</i>
      <u data-oid="u1" {...rest}>U</u>
    </section>
  );
}
`;

  it("replaces only the class string and keeps everything else", () => {
    const result = editElementClassName(
      source,
      "s1",
      "grid gap-6 md:grid-cols-3",
    );
    expect(result).toMatchObject({ ok: true, strategy: "splice" });
    expect(result.ok && result.generated).toBe(
      source.replace(
        '"grid gap-4 md:grid-cols-2"',
        '"grid gap-6 md:grid-cols-3"',
      ),
    );
  });

  it("keeps the original quote style", () => {
    const result = editElementClassName(source, "a1", "px-4 hover:bg-sky-600");
    expect(result.ok && result.generated).toContain(
      "className='px-4 hover:bg-sky-600'",
    );
  });

  it("adds a missing className after the tag name and removes an empty one", () => {
    const added = editElementClassName(source, "p1", "text-sm");
    expect(added.ok && added.generated).toContain(
      '<p className="text-sm" data-oid="p1">Plain</p>',
    );
    const removed = editElementClassName(source, "s1", "");
    expect(removed.ok && removed.generated).toContain(
      '<section data-oid="s1">',
    );
  });

  it.each([
    ["template literal", "b1", "unsupported-className-expression"],
    ["later spread", "i1", "unsupported-className-expression"],
    ["spread without className", "u1", "unsupported-className-expression"],
  ])("refuses %s", (_label, oid, reason) => {
    expect(editElementClassName(source, oid, "px-4")).toEqual({
      ok: false,
      reason,
    });
  });

  it.each([
    'px-4" onClick="x',
    "px-4 {x}",
    "a\nb",
    "a\\b",
    "a<b",
    "a&amp;b",
  ])("refuses unsafe class value %j", (value) => {
    expect(editElementClassName(source, "s1", value)).toEqual({
      ok: false,
      reason: "unsupported-className-value",
    });
  });

  it("describes className values and refusals", () => {
    const read = (oid: string) => {
      const described = describeElement(source, oid);
      return described.ok ? described.className : null;
    };
    expect(read("s1")).toEqual({
      ok: true,
      value: "grid gap-4 md:grid-cols-2",
    });
    expect(read("p1")).toEqual({ ok: true, value: null });
    expect(read("b1")).toEqual({
      ok: false,
      reason: "unsupported-className-expression",
    });
    expect(read("u1")).toEqual({
      ok: false,
      reason: "unsupported-className-expression",
    });
  });
});
