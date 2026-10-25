export interface DiffLine {
  kind: "context" | "removed" | "added";
  text: string;
}

export interface DiffHunk {
  /** 1-based first line of the hunk in the original content. */
  originalStart: number;
  /** 1-based first line of the hunk in the generated content. */
  generatedStart: number;
  lines: DiffLine[];
}

export interface LineDiff {
  changed: boolean;
  hunks: DiffHunk[];
}

/**
 * Single-hunk line diff: trims the common prefix and suffix and reports the
 * changed middle with `context` surrounding lines. Source-mapper patches touch
 * one element, so one hunk is enough to review them; it is not a general
 * diff algorithm.
 */
export function createLineDiff(
  original: string,
  generated: string,
  context = 2,
): LineDiff {
  if (original === generated) {
    return { changed: false, hunks: [] };
  }
  const before = original.split("\n");
  const after = generated.split("\n");

  let prefix = 0;
  while (
    prefix < before.length &&
    prefix < after.length &&
    before[prefix] === after[prefix]
  ) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const start = Math.max(0, prefix - context);
  const lines: DiffLine[] = [];
  for (let i = start; i < prefix; i += 1) {
    lines.push({ kind: "context", text: before[i] ?? "" });
  }
  for (let i = prefix; i < before.length - suffix; i += 1) {
    lines.push({ kind: "removed", text: before[i] ?? "" });
  }
  for (let i = prefix; i < after.length - suffix; i += 1) {
    lines.push({ kind: "added", text: after[i] ?? "" });
  }
  const tailEnd = Math.min(before.length, before.length - suffix + context);
  for (let i = before.length - suffix; i < tailEnd; i += 1) {
    lines.push({ kind: "context", text: before[i] ?? "" });
  }

  return {
    changed: true,
    hunks: [{ originalStart: start + 1, generatedStart: start + 1, lines }],
  };
}

const DIFF_MARKERS: Record<DiffLine["kind"], string> = {
  context: " ",
  removed: "-",
  added: "+",
};

export function formatLineDiff(diff: LineDiff, path: string): string {
  if (!diff.changed) {
    return "";
  }
  const out = [`--- a/${path}`, `+++ b/${path}`];
  for (const hunk of diff.hunks) {
    const originalCount = hunk.lines.filter((l) => l.kind !== "added").length;
    const generatedCount = hunk.lines.filter(
      (l) => l.kind !== "removed",
    ).length;
    out.push(
      `@@ -${hunk.originalStart},${originalCount} +${hunk.generatedStart},${generatedCount} @@`,
    );
    for (const line of hunk.lines) {
      out.push(`${DIFF_MARKERS[line.kind]}${line.text}`);
    }
  }
  return out.join("\n");
}
