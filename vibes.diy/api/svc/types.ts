import { type } from "arktype";

export const fileSystemItem = type({
  fileName: "string",
  mimeType: "string",
  assetURI: "string", // sql://Assets.assetId, s3://bucket/key, r2://bucket/key
  "transform?": "'jsx-to-js'",
  "entryPoint?": "boolean",
  size: "number",
});

export type FileSystemItem = typeof fileSystemItem.infer;

