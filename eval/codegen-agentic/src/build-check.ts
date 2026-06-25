import { transform } from "esbuild";

/**
 * Structural compile gate: transform each source file as JSX/ESM with all bare
 * imports (react, use-fireproof, use-vibes, call-ai, …) treated as external —
 * we check the code PARSES and references resolve structurally, we do not run
 * it. Catches the syntax/parse-fail class. Plus an App.jsx default-export check
 * (the runtime loads the default export). NOT the real vibes lint.
 */
export async function buildCheck(files: Record<string, string>): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  const app = files["App.jsx"] ?? files["/App.jsx"];
  if (!app) return { ok: false, errors: ["App.jsx is missing"] };
  if (!/export\s+default\s+/.test(app)) errors.push("App.jsx has no default export");

  for (const [name, code] of Object.entries(files)) {
    if (!/\.(jsx?|tsx?)$/.test(name)) continue;
    try {
      await transform(code, { loader: name.endsWith("x") ? "jsx" : "js", format: "esm", jsx: "automatic" });
    } catch (e) {
      const msg = (e as { errors?: { text: string; location?: { line: number } }[] }).errors
        ?.map((er) => `${name}:${er.location?.line ?? "?"} ${er.text}`)
        .join("; ") ?? `${name}: ${(e as Error).message}`;
      errors.push(msg);
    }
  }
  return { ok: errors.length === 0, errors };
}
