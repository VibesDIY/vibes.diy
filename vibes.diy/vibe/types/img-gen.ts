import React from "react";
import type { Database, DocWithId } from "@vibes.diy/vibe-runtime";

// `_files.<key>` shape on the doc. The platform's URL minter (Stage C)
// adds `url` on read so display is `<img src={meta.url}>` — see
// vibes.diy/api/svc/public/files-url-mint.ts.
export interface FileMeta {
  readonly uploadId: string;
  readonly type: string;
  readonly size: number;
  readonly lastModified?: number;
  readonly url?: string;
}

export interface VersionInfo {
  // Version identifier doubles as the fileKey into _files. e.g. "v1"
  readonly id: string;
  readonly created: number;
  readonly promptKey?: string;
  readonly model?: string;
}

export interface PromptEntry {
  readonly text: string;
  readonly created: number;
}

export interface ImageDocumentPlain {
  readonly _rev?: string;
  readonly type: "image";
  readonly prompt?: string;
  readonly prompts?: Record<string, PromptEntry>;
  readonly created: number;
  readonly currentVersion: number;
  readonly versions: VersionInfo[];
  readonly currentPromptKey: string;
  readonly _files?: Record<string, FileMeta>;
}

export type ImageDocument = ImageDocumentPlain;

export type PartialImageDocument = DocWithId<Partial<ImageDocumentPlain>>;

export interface ImgGenOptions {
  readonly size?: string;
  readonly quality?: string;
  readonly model?: string;
  readonly style?: string;
  readonly debug?: boolean;
}

export interface UseImgGenOptions {
  readonly prompt?: string;
  readonly _id?: string;
  readonly _rev?: string;
  readonly database?: string | Database;
  readonly options?: Partial<ImgGenOptions>;
  readonly generationId?: string;
  readonly skip?: boolean;
  readonly inputImage?: File;
  readonly model?: string;
  readonly editedPrompt?: string;
}

export interface UseImgGenResult {
  readonly loading: boolean;
  readonly progress: number;
  readonly error?: Error | null;
  readonly document?: PartialImageDocument | null;
}

export interface ImgGenClasses {
  readonly root: string;
  readonly container: string;
  readonly image: string;
  readonly placeholder: string;
  readonly error: string;
  readonly controls: string;
  readonly button: string;
  readonly prompt: string;
}

export interface ImgGenProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onError" | "className"> {
  readonly prompt?: string;
  readonly _id?: string;
  readonly className?: string;
  readonly alt?: string;
  readonly images?: File[];
  readonly options?: ImgGenOptions;
  readonly database?: string | Database;
  readonly model?: string;
  readonly showControls?: boolean;
  readonly style?: React.CSSProperties;
  readonly onComplete?: () => void;
  readonly onError?: (error: Error) => void;
  readonly onDelete?: (id: string) => void;
  readonly onPromptEdit?: (id: string, newPrompt: string) => void;
  readonly classes?: Partial<ImgGenClasses>;
  readonly debug?: boolean;
}
