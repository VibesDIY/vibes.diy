import * as fs from "node:fs/promises";
import * as path from "node:path";
import { exception2Result } from "@adviser/cement";
import { type } from "arktype";

export interface DiskFile {
  readonly type: "code-block";
  readonly filename: string;
  readonly lang: string;
  readonly content: string;
}

export interface DiskDraft {
  readonly files: readonly DiskFile[];
}

const SOURCE_EXT = new Set([".jsx", ".tsx", ".js", ".ts", ".css", ".html", ".md"]);

function langOf(name: string): string {
  const ext = path.extname(name).slice(1).toLowerCase();
  return ext === "js" || ext === "jsx" ? "jsx" : ext;
}

async function readDiskSourceFiles(dir: string): Promise<DiskFile[]> {
  const entriesResult = await exception2Result(() => fs.readdir(dir, { withFileTypes: true }));
  if (entriesResult.isErr()) return [];
  const entries = entriesResult.Ok();
  const out: DiskFile[] = [];
  for (const e of entries) {
    if (e.isFile() === false) continue;
    if (e.name.startsWith(".")) continue;
    const ext = path.extname(e.name).toLowerCase();
    if (SOURCE_EXT.has(ext) === false) continue;
    const content = await fs.readFile(path.join(dir, e.name), "utf8");
    out.push({ type: "code-block", filename: e.name, lang: langOf(e.name), content });
  }
  return out;
}

const UndoEntry = type({
  filename: "string",
  content: "string",
});

const UndoFileArray = UndoEntry.array();

export async function collectDiskDraft(dir: string): Promise<DiskDraft | undefined> {
  const sourceFiles = await readDiskSourceFiles(dir);
  if (sourceFiles.length === 0) return undefined;

  const undoPath = path.join(dir, ".undo");
  const undoTextResult = await exception2Result(() => fs.readFile(undoPath, "utf8"));
  if (undoTextResult.isErr()) {
    return { files: sourceFiles };
  }

  const parsedResult = exception2Result(() => JSON.parse(undoTextResult.Ok()));
  if (parsedResult.isErr()) {
    return { files: sourceFiles };
  }

  const validated = UndoFileArray(parsedResult.Ok());
  if (validated instanceof type.errors) {
    return { files: sourceFiles };
  }

  const sameContent =
    validated.length === sourceFiles.length &&
    sourceFiles.every((s) => validated.find((u) => u.filename === s.filename)?.content === s.content);
  if (sameContent) return undefined;
  return { files: sourceFiles };
}
