import { VibesDiyEnv } from "../config/env.js";
import { ejectTemplateWithPlaceholders } from "./eject-template.js";
import {
  normalizeComponentExports,
  transformImports,
} from "@vibes.diy/prompts";

export function generateStandaloneHtml(params: { code: string }): string {
  const normalized = normalizeComponentExports(params.code);
  const transformed = transformImports(normalized);

  return ejectTemplateWithPlaceholders
    .replaceAll("{{API_KEY}}", "sk-vibes-proxy-managed")
    .replaceAll("{{CALLAI_ENDPOINT}}", VibesDiyEnv.CALLAI_ENDPOINT())
    .replace("{{APP_CODE}}", transformed);
}

export function downloadTextFile(
  filename: string,
  contents: string,
  type = "text/html",
): void {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
