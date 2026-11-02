import { expect, it } from "vitest";
import {
  describeImageSource,
  editElementImageSource,
} from "../src/source-mapper/image.ts";

const page = (element: string) =>
  `export default function Page(){return <main>${element}</main>;}`;
it("splices only the quoted src while preserving alt, quote, keys and unrelated code", () => {
  const before = page(
    "<img data-oid='image' key='hero' src = '/old.svg' alt='Example' className='rounded' />",
  );
  expect(describeImageSource(before, "image")).toMatchObject({
    ok: true,
    kind: "img",
    src: "/old.svg",
    alt: "Example",
  });
  const result = editElementImageSource(
    before,
    "image",
    "/images/new%20asset.svg",
  );
  expect(result.ok && result.generated).toBe(
    before.replace("'/old.svg'", "'/images/new%20asset.svg'"),
  );
  expect(
    describeImageSource(
      page('<img data-oid="image" src="/old.svg" alt=""/>'),
      "image",
    ),
  ).toMatchObject({ ok: true, alt: "" });
});
it("verifies a lexical default next/image import including aliases", () => {
  const before =
    'import Picture from "next/image";' +
    page(
      '<Picture data-oid="image" src="/old.png" alt="Example" width={64} height={64}/>',
    );
  expect(describeImageSource(before, "image")).toMatchObject({
    ok: true,
    kind: "next-image",
  });
  expect(editElementImageSource(before, "image", "/new.png").ok).toBe(true);
  expect(
    describeImageSource(
      'import Picture from "next/image";' +
        page(
          '<Picture data-oid="image" SRC="/old.png" ALT="A" width={64} height={64}/>',
        ),
      "image",
    ).ok,
  ).toBe(false);
  for (const source of [
    before.replace('"next/image"', '"other-image"'),
    before.replace("return <main>", "const Picture=()=>null;return <main>"),
    page(
      '<Picture data-oid="image" src="/old.png" alt="Example" width={64} height={64}/>',
    ),
  ])
    expect(describeImageSource(source, "image").ok).toBe(false);
});
it.each([
  '<img data-oid="image" src={value} alt="A"/>',
  '<img data-oid="image" src="/old.svg"/>',
  '<img data-oid="image" src="/old.svg" alt={label}/>',
  '<img data-oid="image" src="/old.svg" alt="A" srcSet="/other.svg 2x"/>',
  '<img data-oid="image" {...props} src="/old.svg" alt="A"/>',
  '<img data-oid="image" src="/old.svg" alt="A" {...props}/>',
  '<img data-oid="image" src="/a.svg" src="/b.svg" alt="A"/>',
  '<img data-oid="image" SRC="/a.svg" ALT="A"/>',
  '<img data-oid="image" src="/a.svg" SRC="/b.svg" alt="A"/>',
  '<div data-oid="image" src="/old.svg" alt="A"/>',
])("refuses unsupported or ambiguous image source %s", (element) =>
  expect(
    editElementImageSource(page(element), "image", "/new.svg"),
  ).toMatchObject({ ok: false, reason: "unsupported-image-source" }));
it("refuses custom Next image overrides/loader and unproven dimensions", () => {
  for (const props of [
    "loader={custom} width={64} height={64}",
    'overrideSrc="/other.svg" width={64} height={64}',
    "width={size} height={64}",
    "",
    'SRC="/old.png" ALT="A" width={64} height={64}',
  ]) {
    const source =
      'import Image from "next/image";' +
      page(`<Image data-oid="image" src="/old.png" alt="A" ${props}/>`);
    expect(describeImageSource(source, "image").ok).toBe(false);
  }
  expect(
    describeImageSource(
      'import Image from "next/image";' +
        page('<Image data-oid="image" src="/old.png" alt="A" fill/>'),
      "image",
    ).ok,
  ).toBe(true);
});
it("allows repairing an old literal external src but never chooses a new external/traversal asset", () => {
  const before = page(
    '<img data-oid="image" src="https://example.invalid/old.svg" alt="A"/>',
  );
  expect(editElementImageSource(before, "image", "/new.svg").ok).toBe(true);
  for (const value of [
    "https://evil.test/new.svg",
    "//evil.test/a.svg",
    "/../secret.svg",
    "/a.svg?x=1",
  ])
    expect(editElementImageSource(before, "image", value).ok).toBe(false);
  expect(
    editElementImageSource(
      page(
        '<img data-oid="image" src="/old.svg" alt="A"/><img data-oid="image" src="/old.svg" alt="A"/>',
      ),
      "image",
      "/new.svg",
    ),
  ).toMatchObject({ ok: false, reason: "oid-ambiguous" });
});
