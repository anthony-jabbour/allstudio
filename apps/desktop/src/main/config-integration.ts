import { textOf } from "./local-workspace.ts";
import { FileFailure, type NativeFiles } from "./native-files.ts";

const CONFIGS = ["next.config.ts", "next.config.mjs", "next.config.js"];

export interface IntegrationPlan {
  path: string;
  backup: string | null;
  original: Buffer | null;
  content: Buffer;
  installed: boolean;
}

export async function planIntegration(
  files: NativeFiles,
): Promise<IntegrationPlan> {
  const found: Array<{ path: string; content: Buffer }> = [];
  for (const path of CONFIGS) {
    try {
      found.push({ path, content: (await files.read(path)).bytes });
    } catch (error) {
      if (!(error instanceof FileFailure) || error.reason !== "file-not-found")
        throw error;
    }
  }
  if (found.length > 1)
    throw new Error(
      "Multiple Next.js config files found. Keep one supported config before opening this project.",
    );
  const path = found[0]?.path ?? "next.config.mjs";
  const original = found[0]?.content ?? null;
  const extension = path.slice(path.lastIndexOf("."));
  const backup = original ? `next.config.allstudio-original${extension}` : null;
  let commonJs = false;
  if (extension === ".js") {
    const pkg = JSON.parse(
      textOf((await files.read("package.json")).bytes).replace(/^\uFEFF/, ""),
    ) as { type?: string };
    commonJs = pkg.type !== "module";
  }
  const typescript = extension === ".ts";
  const content = Buffer.from(wrapper(backup, commonJs, typescript));
  if (original?.equals(Buffer.from(wrapper(null, commonJs, typescript))))
    return { path, backup: null, original, content: original, installed: true };
  const installed = original?.equals(content) ?? false;
  if (
    original &&
    textOf(original).startsWith("// allstudio preview integration v1") &&
    !installed
  )
    throw new Error(
      "The editor config wrapper was changed. Review it before reintegrating; nothing was overwritten.",
    );
  if (installed && backup) {
    // The wrapper must never recursively import another generated wrapper.
    const saved = textOf((await files.read(backup)).bytes);
    if (saved.startsWith("// allstudio preview integration v1"))
      throw new Error("Original config backup is invalid.");
  }
  return { path, backup, original, content, installed };
}

export async function applyIntegration(
  files: NativeFiles,
  plan: IntegrationPlan,
) {
  if (plan.installed) return;
  if (plan.original && plan.backup) {
    try {
      const existing = (await files.read(plan.backup)).bytes;
      if (!existing.equals(plan.original))
        throw new Error(
          "A different config backup already exists. Nothing was overwritten.",
        );
    } catch (error) {
      if (!(error instanceof FileFailure) || error.reason !== "file-not-found")
        throw error;
      await files.backupConfig(plan.path, plan.original);
    }
    await files.write(plan.path, plan.original, plan.content);
  } else await files.createConfig(plan.path, plan.content);
}

function wrapper(
  backup: string | null,
  commonJs: boolean,
  typescript: boolean,
): string {
  const imported = typescript && backup ? backup.slice(0, -3) : backup;
  const load = commonJs
    ? ""
    : backup
      ? `import original from "./${imported}";`
      : "const original = {};";
  const exported = commonJs ? "module.exports =" : "export default";
  const types = typescript
    ? 'type ConfigInput = import("next").NextConfig | ((phase: string, context: { defaultConfig: import("next").NextConfig }) => import("next").NextConfig | Promise<import("next").NextConfig>);\nconst input = original as ConfigInput;'
    : commonJs
      ? ""
      : "const input = original;";
  const parameters = typescript
    ? 'phase: string, context: { defaultConfig: import("next").NextConfig }'
    : "phase, context";
  return `// allstudio preview integration v1 — original config remains in the adjacent backup.
${load}
${types}
${exported} async function allstudioConfig(${parameters}) {
  ${commonJs ? `const input = (await import("./${imported}")).default;` : ""}
  const config = (typeof input === "function" ? await input(phase, context) : await input) ?? {};
  const loader = process.env.ALLSTUDIO_PREVIEW_LOADER;
  if (!loader) return config;
  const rules = config.turbopack?.rules ?? {};
  for (const pattern of ["*.tsx", "*.jsx"]) {
    if (rules[pattern]) throw new Error("allstudio cannot replace an existing JSX/TSX loader rule.");
  }
  return { ...config, turbopack: { ...config.turbopack, rules: { ...rules,
    "*.tsx": { loaders: [loader], as: "*.tsx" },
    "*.jsx": { loaders: [loader], as: "*.jsx" }
  } } };
}
`;
}
