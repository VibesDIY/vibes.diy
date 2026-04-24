import type { Database, DocWithId } from "@fireproof/use-fireproof";

export interface PromptEntry {
  readonly text: string;
  readonly created: number;
}

export interface ImageDocumentPlain {
  readonly type: "image";
  readonly created: number;
  readonly currentVersion: number; // 0-based index into versions[]
  readonly versions: VersionInfo[];
  readonly currentPromptKey: string;
  readonly prompts?: Record<string, PromptEntry>;
  readonly prompt?: string; // Legacy field, superseded by prompts/currentPromptKey
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
