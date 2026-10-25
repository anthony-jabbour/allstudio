/**
 * OID generator for in-source data-oid attributes.
 * Character set matches Onlook createOid (Apache-2.0, packages/utility/src/id.ts
 * at 423e2e924366419e418ee049093872d535eea41a) without taking a nanoid dependency.
 */
const OID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789-._:";

export function createOid(): string {
  const bytes = new Uint8Array(7);
  crypto.getRandomValues(bytes);
  let oid = "";
  for (const byte of bytes) {
    oid += OID_CHARS[byte % OID_CHARS.length];
  }
  return oid;
}

export function createUniqueOid(...existing: Set<string>[]): string {
  let oid = createOid();
  while (existing.some((set) => set.has(oid))) {
    oid = createOid();
  }
  return oid;
}
