import type { Database, DocWithId } from "@vibes.diy/vibe-runtime";

export interface PromptEntry {
  readonly text: string;
  readonly created: number;
}

// Per-version file metadata on `_files.<versionId>`. Mirrors the runtime shape
// in `@vibes.diy/vibe-types`; the platform mints `url` on read. The Firefly
// `DocWithId` only adds `_id`, so (unlike Fireproof's `DocBase`) it does not
// carry `_files` — declare it on the doc itself to keep it on the public type.
export interface FileMeta {
  readonly uploadId: string;
  readonly type: string;
  readonly size: number;
  readonly lastModified?: number;
  readonly url?: string;
}

export interface ImageDocumentPlain {
  readonly type: "image";
  readonly created: number;
  readonly currentVersion: number; // 0-based index into versions[]
  readonly versions: VersionInfo[];
  readonly currentPromptKey: string;
  readonly prompts?: Record<string, PromptEntry>;
  readonly prompt?: string; // Legacy field, superseded by prompts/currentPromptKey
  readonly _files?: Record<string, FileMeta>;
}

export type ImageDocument = DocWithId<ImageDocumentPlain>;

export type PartialImageDocument = DocWithId<Partial<ImageDocumentPlain>>;

export interface VersionInfo {
  readonly id: string; // e.g. "v1", "v2"
  readonly created: number;
  readonly promptKey?: string; // e.g. "p1"
  readonly assetUrl: string; // "/assets/cid?url=...&mime=image/png"
  readonly model?: string; // model used to generate this version
}

export type GenerationPhase = "idle" | "generating" | "complete" | "error";

export interface UseImgVibesOptions {
  readonly prompt: string;
  readonly _id: string;
  readonly database: string | Database;
  readonly generationId: string;
  readonly skip: boolean;
  readonly inputImage?: File;
  readonly model?: string;
}

export interface UseImgVibesResult {
  readonly assetUrl?: string | null;
  readonly loading: boolean;
  readonly progress: number;
  readonly error?: Error | null;
  readonly document?: PartialImageDocument | null;
}
