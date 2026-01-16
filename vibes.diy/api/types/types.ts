import { type } from "arktype";

export const fileSystemItem = type({
  fileName: "string",
  mimeType: "string",
  assetId: "string",
  assetURI: "string", // sql://Assets.assetId, s3://bucket/key, r2://bucket/key
  "transform?": type({
    type: "'jsx-to-js'",
    transformedAssetId: "string", // assetId of the transformed result
  })
    .or({
      type: "'imports'",
      importMapAssetId: "string", // assetId of the transformed result
    })
    .or({
      type: "'import-map'",
      fromAssetIds: "string[]", // assetIds used to generate the import map
    })
    .or({
      type: "'transformed'",
      action: "'jsx-to-js'",
      transformedAssetId: "string",
    }),

  "entryPoint?": "boolean",
  size: "number",
});

export type FileSystemItem = typeof fileSystemItem.infer;

export interface ResponseType {
  type: "Response";
  payload: {
    status: number;
    headers: HeadersInit;
    body: BodyInit;
  };
}

export function isResponseType(obj: unknown): obj is ResponseType {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  return (obj as ResponseType).type === "Response";
}
