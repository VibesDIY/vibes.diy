import { computeStructure } from "@vibes.diy/eval-codegen-matrix/scoring";

/**
 * Turn the build result + structural signals into the agentic loop's feedback.
 * `clean` means: build passes AND (if the prompt needs permissions) a separate
 * access.js exists. The message is what the model sees as the write_file tool's
 * return value, so it must be specific and actionable.
 */
export function evaluateProgress(
  files: Record<string, string>,
  buildResult: { ok: boolean; errors: string[] },
  needsAccess: boolean
): { clean: boolean; message: string } {
  const problems: string[] = [];
  if (!buildResult.ok) problems.push(`Build failed: ${buildResult.errors.join("; ")}`);
  const s = computeStructure(files);
  if (needsAccess && !s.hasAccessJs) {
    problems.push("This app needs per-document permissions but no separate access.js was written. Add an access.js that exports the access function.");
  }
  if (needsAccess && s.accessInAppJsx) {
    problems.push("Access-control logic is in App.jsx; move it into access.js.");
  }
  if (problems.length === 0) return { clean: true, message: "Build and structural checks pass. The app is complete." };
  return { clean: false, message: problems.join("\n") };
}
