import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createLineDiff,
  describeElement,
  formatLineDiff,
  instrumentSource,
  listOids,
  locateSource,
  previewPatch,
} from "../src/index.ts";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../examples/nextjs-site-fixture/src/app/page.tsx",
);
const fixture = readFileSync(fixturePath, "utf8");

function oidNear(content: string, marker: string): string {
  const index = content.indexOf(marker);
  expect(index).toBeGreaterThan(-1);
  const window = content.slice(index, index + 400);
  const match = window.match(/data-oid="([^"]+)"/);
  expect(match?.[1]).toBeTruthy();
  return match?.[1] ?? "";
}

describe("source mapper", () => {
  it("injects data-oid attributes into the Next.js fixture", () => {
    const result = instrumentSource(fixture);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.content).toContain('data-oid="');
    expect(result.locations.length).toBeGreaterThanOrEqual(5);
    const heading = result.locations.find(
      (location) => location.start.line === 7,
    );
    expect(heading?.component).toBe("Home");
  });

  it("resolves the hero heading oid to its source location", () => {
    const instrumented = instrumentSource(fixture);
    expect(instrumented.ok).toBe(true);
    if (!instrumented.ok) {
      return;
    }
    const oid = oidNear(instrumented.content, 'id="hero-heading"');
    const located = locateSource(instrumented.content, oid, {
      filename: "src/app/page.tsx",
    });
    expect(located).not.toBeNull();
    expect(located?.oid).toBe(oid);
    expect(located?.component).toBe("Home");
    expect(located?.path).toBe("src/app/page.tsx");
    expect(located?.start.line).toBe(7);
  });

  it("previews a heading text and className patch as a JSX diff", () => {
    const instrumented = instrumentSource(fixture);
    expect(instrumented.ok).toBe(true);
    if (!instrumented.ok) {
      return;
    }
    const oid = oidNear(instrumented.content, 'id="hero-heading"');
    const patched = previewPatch(instrumented.content, {
      oid,
      textContent: "Aurora Atelier — edited",
      className: "text-emerald-700",
    });
    expect(patched.ok).toBe(true);
    if (!patched.ok) {
      return;
    }
    expect(patched.original).toContain("Aurora Atelier");
    expect(patched.generated).toContain("Aurora Atelier — edited");
    expect(patched.generated).toContain("text-emerald-700");
    expect(patched.generated).not.toContain("text-zinc-950");
    expect(patched.generated).toContain('id="hero-heading"');
  });

  it("refuses className edits on expression attributes without rewriting", () => {
    const source = `export function Button() {
  return <button className={clsx("px-3")} type="button">Go</button>;
}
`;
    const instrumented = instrumentSource(source);
    expect(instrumented.ok).toBe(true);
    if (!instrumented.ok) {
      return;
    }
    const oid = instrumented.locations[0]?.oid;
    expect(oid).toBeTruthy();
    const patched = previewPatch(instrumented.content, {
      oid: oid ?? "",
      className: "px-4",
    });
    expect(patched.ok).toBe(false);
    if (patched.ok) {
      return;
    }
    expect(patched.reason).toBe("unsupported-className-expression");
    expect(instrumented.content).toContain('className={clsx("px-3")}');
  });

  it("returns parse-failed for invalid source", () => {
    const result = instrumentSource("export default function ( {");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe("parse-failed");
  });

  it("returns oid-not-found when the element is missing", () => {
    const instrumented = instrumentSource(fixture);
    expect(instrumented.ok).toBe(true);
    if (!instrumented.ok) {
      return;
    }
    const patched = previewPatch(instrumented.content, {
      oid: "missing-oid",
      textContent: "nope",
    });
    expect(patched.ok).toBe(false);
    if (patched.ok) {
      return;
    }
    expect(patched.reason).toBe("oid-not-found");
  });

  it("writes special text as a string expression that round-trips", () => {
    const source = `export function Price() {
  return <p>old</p>;
}
`;
    const instrumented = instrumentSource(source);
    expect(instrumented.ok).toBe(true);
    if (!instrumented.ok) {
      return;
    }
    const oid = instrumented.locations[0]?.oid;
    expect(oid).toBeTruthy();
    const patched = previewPatch(instrumented.content, {
      oid: oid ?? "",
      textContent: "Price < {name}",
    });
    expect(patched.ok).toBe(true);
    if (!patched.ok) {
      return;
    }
    const reparsed = instrumentSource(patched.generated);
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) {
      return;
    }
    expect(patched.generated).toContain('"Price < {name}"');
    expect(patched.generated).not.toContain(">Price < {name}<");
    const located = locateSource(patched.generated, oid ?? "");
    expect(located).not.toBeNull();
  });

  it("opens a self-closing element before inserting text", () => {
    const source = `export function Box() {
  return <div />;
}
`;
    const instrumented = instrumentSource(source);
    expect(instrumented.ok).toBe(true);
    if (!instrumented.ok) {
      return;
    }
    const oid = instrumented.locations[0]?.oid;
    expect(oid).toBeTruthy();
    const patched = previewPatch(instrumented.content, {
      oid: oid ?? "",
      textContent: "hello",
    });
    expect(patched.ok).toBe(true);
    if (!patched.ok) {
      return;
    }
    expect(patched.generated).toContain("hello");
    expect(patched.generated).toContain("</div>");
    expect(patched.generated).not.toMatch(/<div[^>]*\/>/);
  });

  it("refuses className edits when a later spread can override them", () => {
    const source = `export function Card() {
  return <div className="px-2" {...{ className: "px-8" }} />;
}
`;
    const instrumented = instrumentSource(source);
    expect(instrumented.ok).toBe(true);
    if (!instrumented.ok) {
      return;
    }
    const oid = instrumented.locations[0]?.oid;
    expect(oid).toBeTruthy();
    const patched = previewPatch(instrumented.content, {
      oid: oid ?? "",
      className: "px-4",
    });
    expect(patched.ok).toBe(false);
    if (patched.ok) {
      return;
    }
    expect(patched.reason).toBe("unsupported-className-expression");
    expect(instrumented.content).toContain('className="px-2"');
  });

  it("refuses text edits on native HTML void elements", () => {
    const source = `export function Field() {
  return <input type="text" />;
}
`;
    const instrumented = instrumentSource(source);
    expect(instrumented.ok).toBe(true);
    if (!instrumented.ok) {
      return;
    }
    const oid = instrumented.locations[0]?.oid;
    expect(oid).toBeTruthy();
    const patched = previewPatch(instrumented.content, {
      oid: oid ?? "",
      textContent: "hello",
    });
    expect(patched.ok).toBe(false);
    if (patched.ok) {
      return;
    }
    expect(patched.reason).toBe("unsupported-void-element");
    expect(instrumented.content).toMatch(/<input[^>]*\/>/);
    expect(instrumented.content).not.toContain("</input>");
  });

  it("keeps the enclosing component name across array and object destructuring", () => {
    const source = `function Home() {
  const [value] = useState("");
  return <div />;
}

function Card() {
  const { title } = props;
  return <span />;
}
`;
    const instrumented = instrumentSource(source);
    expect(instrumented.ok).toBe(true);
    if (!instrumented.ok) {
      return;
    }
    expect(instrumented.locations[0]?.component).toBe("Home");
    expect(instrumented.locations[1]?.component).toBe("Card");
    const homeOid = instrumented.locations[0]?.oid ?? "";
    const located = locateSource(instrumented.content, homeOid);
    expect(located?.component).toBe("Home");
  });

  it.each([
    ["mixed text and expression", "<p>Hello {name}!</p>"],
    ["expression-only text", "<p>{name}</p>"],
    [
      "nested element children",
      '<a href="/">\n      <span>Icon</span>\n      Label\n    </a>',
    ],
  ])("refuses text edits on %s without rewriting", (_label, markup) => {
    const source = `export function G({ name }: { name: string }) {
  return ${markup};
}
`;
    const instrumented = instrumentSource(source);
    expect(instrumented.ok).toBe(true);
    if (!instrumented.ok) {
      return;
    }
    const oid = instrumented.locations[0]?.oid ?? "";
    const patched = previewPatch(instrumented.content, {
      oid,
      textContent: "Bye",
    });
    expect(patched.ok).toBe(false);
    if (patched.ok) {
      return;
    }
    expect(patched.reason).toBe("unsupported-dynamic-children");
  });

  it("collapses static text children and keeps JSX comments", () => {
    const source = `export function P() {
  return <p>{/* note */}Price {"<"} 5</p>;
}
`;
    const instrumented = instrumentSource(source);
    expect(instrumented.ok).toBe(true);
    if (!instrumented.ok) {
      return;
    }
    const oid = instrumented.locations[0]?.oid ?? "";
    const patched = previewPatch(instrumented.content, {
      oid,
      textContent: "Free",
    });
    expect(patched.ok).toBe(true);
    if (!patched.ok) {
      return;
    }
    expect(patched.generated).toMatch(/>\{\/\* note \*\/\}Free<\/p>/);
  });

  it("refuses multiline text edits", () => {
    const instrumented = instrumentSource(fixture);
    expect(instrumented.ok).toBe(true);
    if (!instrumented.ok) {
      return;
    }
    const oid = oidNear(instrumented.content, 'id="hero-heading"');
    const patched = previewPatch(instrumented.content, {
      oid,
      textContent: "Line 1\nLine 2",
    });
    expect(patched.ok).toBe(false);
    if (patched.ok) {
      return;
    }
    expect(patched.reason).toBe("unsupported-multiline-text");
  });

  it("refuses edits when the oid matches more than one element", () => {
    const source = `export function D() {
  return <div><p data-oid="dup">a</p><p data-oid="dup">b</p></div>;
}
`;
    const patched = previewPatch(source, { oid: "dup", textContent: "Z" });
    expect(patched.ok).toBe(false);
    if (patched.ok) {
      return;
    }
    expect(patched.reason).toBe("oid-ambiguous");
  });
});

describe("describeElement", () => {
  it("resolves the fixture heading location and rendered static text", () => {
    const instrumented = instrumentSource(fixture);
    expect(instrumented.ok).toBe(true);
    if (!instrumented.ok) {
      return;
    }
    const oid = oidNear(instrumented.content, 'id="hero-heading"');
    const described = describeElement(instrumented.content, oid, {
      filename: "src/app/page.tsx",
    });
    expect(described).toMatchObject({
      ok: true,
      location: { oid, path: "src/app/page.tsx", component: "Home" },
      text: { ok: true, text: "Aurora Atelier" },
    });
  });

  it("applies JSX whitespace rules to multi-line static text", () => {
    const source = `export function P() {
  return (
    <p data-oid="p1">
      A supported   site
      used to validate {"<"} editing.
    </p>
  );
}
`;
    const described = describeElement(source, "p1");
    expect(described.ok && described.text).toEqual({
      ok: true,
      text: "A supported   site used to validate < editing.",
    });
  });

  it("reports dynamic children as not editable", () => {
    const source = `export function L({ children }) {
  return <body data-oid="b1">{children}</body>;
}
`;
    const described = describeElement(source, "b1");
    expect(described.ok && described.text).toEqual({
      ok: false,
      reason: "unsupported-dynamic-children",
    });
  });

  it("refuses missing and duplicated oids", () => {
    const source = `export function D() {
  return <div><p data-oid="dup">a</p><p data-oid="dup">b</p></div>;
}
`;
    expect(describeElement(source, "dup")).toEqual({
      ok: false,
      reason: "oid-ambiguous",
    });
    expect(describeElement(source, "nope")).toEqual({
      ok: false,
      reason: "oid-not-found",
    });
    expect(describeElement("export default (", "dup")).toEqual({
      ok: false,
      reason: "parse-failed",
    });
  });
});

describe("line diff", () => {
  it("reports one hunk with context around a changed line", () => {
    const original = "a\nb\nc\nd\ne\nf";
    const generated = "a\nb\nc\nD\ne\nf";
    const diff = createLineDiff(original, generated, 1);
    expect(diff.changed).toBe(true);
    expect(formatLineDiff(diff, "src/x.tsx")).toBe(
      [
        "--- a/src/x.tsx",
        "+++ b/src/x.tsx",
        "@@ -3,3 +3,3 @@",
        " c",
        "-d",
        "+D",
        " e",
      ].join("\n"),
    );
  });

  it("is empty for identical content", () => {
    const diff = createLineDiff("same\n", "same\n");
    expect(diff).toEqual({ changed: false, hunks: [] });
    expect(formatLineDiff(diff, "a.tsx")).toBe("");
  });
});

describe("listOids", () => {
  it("lists JSX data-oid attributes and ignores look-alike text", () => {
    const source = `export function P() {
  return <div data-oid="a1"><p data-oid="b2">data-oid="fake"</p>{"data-oid=\\"x\\""}</div>;
}
`;
    expect(listOids(source)).toEqual(["a1", "b2"]);
    expect(listOids("export default (")).toBeNull();
  });
});
