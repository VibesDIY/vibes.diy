import type { VibeFile } from "@vibes.diy/api-types";

export interface LintResult {
  errors: string[];
  warnings: string[];
}

const APP_FILE_RE = /^\/?App\.(jsx|tsx|js|ts)$/;
const DEFAULT_EXPORT_RE = /export\s+default\s+/;

export function lintVibeFiles(files: VibeFile[]): LintResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const codeFiles = files.filter((f) => f.type === "code-block");
  const appFile = codeFiles.find((f) => APP_FILE_RE.test(f.filename));

  if (!appFile) {
    errors.push("Missing App.jsx (or App.tsx) — the runtime expects an App entry file.");
    return { errors, warnings };
  }

  if (!DEFAULT_EXPORT_RE.test(appFile.content)) {
    errors.push(
      `${appFile.filename} has no \`export default\` — the runtime imports the default export and will fail with "does not provide an export named 'default'".`
    );
  }

  return { errors, warnings };
}
