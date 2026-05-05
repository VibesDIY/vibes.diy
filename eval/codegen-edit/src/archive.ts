import { mkdir, writeFile, appendFile } from "node:fs/promises";
import { createWriteStream, type WriteStream } from "node:fs";
import { join } from "node:path";

export interface ArchiveDirs {
  readonly root: string;
  readonly resolvedDir: string;
  readonly sectionsPath: string;
  readonly promptEventsPath: string;
}

export interface RunManifest {
  promptId: string;
  userSlug: string;
  appSlug: string;
  apiUrl: string;
  startedAt: string;
  finishedAt?: string;
  exitState: "ok" | "auth-failure" | "open-chat-failure" | "prompt-failure" | "stream-error" | "in-progress";
  exitDetail?: string;
  turns: TurnSummary[];
}

export interface TurnSummary {
  index: number;
  prompt: string;
  promptId?: string;
  startedAt: string;
  finishedAt?: string;
  upstreamErrorCount: number;
  applyErrorCount: number;
  resolvedFileCount: number;
}

export async function createArchive(rootDir: string, slug: string): Promise<ArchiveDirs> {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join(rootDir, `${ts}_${slug}`);
  const resolvedDir = join(dir, "resolved");
  await mkdir(resolvedDir, { recursive: true });
  return {
    root: dir,
    resolvedDir,
    sectionsPath: join(dir, "sections.jsonl"),
    promptEventsPath: join(dir, "prompt-events.jsonl"),
  };
}

export class JsonlWriter {
  readonly #stream: WriteStream;
  #opened = false;

  constructor(path: string) {
    this.#stream = createWriteStream(path, { flags: "a" });
    this.#opened = true;
  }

  write(obj: unknown): void {
    if (this.#opened === false) return;
    this.#stream.write(JSON.stringify(obj) + "\n");
  }

  close(): Promise<void> {
    if (this.#opened === false) return Promise.resolve();
    this.#opened = false;
    return new Promise<void>((resolve, reject) => {
      this.#stream.end((err: Error | null | undefined) => {
        if (err === null || err === undefined) {
          resolve();
        } else {
          reject(err);
        }
      });
    });
  }
}

export async function writeManifest(dir: ArchiveDirs, manifest: RunManifest): Promise<void> {
  await writeFile(join(dir.root, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf-8");
}

export async function writeErrors(dir: ArchiveDirs, errors: unknown[]): Promise<void> {
  await writeFile(join(dir.root, "errors.json"), JSON.stringify(errors, null, 2) + "\n", "utf-8");
}

export async function writeUpstreamErrors(dir: ArchiveDirs, errors: unknown[]): Promise<void> {
  await writeFile(join(dir.root, "upstream-errors.json"), JSON.stringify(errors, null, 2) + "\n", "utf-8");
}

export async function writeResolvedFiles(dir: ArchiveDirs, files: Readonly<Record<string, string>>): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    const filename = path.startsWith("/") ? path.slice(1) : path;
    const dest = join(dir.resolvedDir, filename);
    const destDir = dest.slice(0, dest.lastIndexOf("/"));
    if (destDir.length > 0) await mkdir(destDir, { recursive: true });
    await writeFile(dest, content, "utf-8");
  }
}

export async function appendIndex(rootDir: string, line: string): Promise<void> {
  await appendFile(join(rootDir, "index.jsonl"), line + "\n", "utf-8");
}
