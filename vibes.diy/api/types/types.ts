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

export const MetaScreenShotRef = type({
  type: "'screen-shot-ref'",
  assetId: "string",
});

export type MetaScreenShot = typeof MetaScreenShotRef.infer;

export function isMetaScreenShot(obj: unknown): obj is MetaScreenShot {
  return !(MetaScreenShotRef(obj) instanceof type.errors);
}

export const MetaTitle = type({
  type: "'title'",
  title: "string",
});

export type MetaTitle = typeof MetaTitle.infer;

export function isMetaTitle(obj: unknown): obj is MetaTitle {
  return !(MetaTitle(obj) instanceof type.errors);
}

export const MetaItem = MetaScreenShotRef.or(MetaTitle);

export type MetaItem = typeof MetaItem.infer;

export function isMetaItem(obj: unknown): obj is MetaItem {
  return !(MetaItem(obj) instanceof type.errors);
}

// export interface ResponseType {
//   type: "Response";
//   payload: {
//     status: number;
//     headers: HeadersInit;
//     body: BodyInit;
//   };
// }

export const HttpResponseMeta = type({
  "status?": "number",
  "headers?": "Record<string, string>",
});

export const HttpResponseJsonType = type({
  type: "'http.Response.JSON'",
  json: "unknown",
}).and(HttpResponseMeta);

export type HttpResponseJsonType = typeof HttpResponseJsonType.infer;

export function isHttpResponseJsonType(obj: unknown): obj is HttpResponseJsonType {
  return !(HttpResponseJsonType(obj) instanceof type.errors);
}

export const HttpResponseBodyType = type({
  type: "'http.Response.Body'",
  body: "unknown",
}).and(HttpResponseMeta);

export type HttpResponseBodyType = typeof HttpResponseBodyType.infer;

export function isHttpResponseBodyType(obj: unknown): obj is HttpResponseBodyType {
  return !(HttpResponseBodyType(obj) instanceof type.errors);
}

// export interface RespondSendProvider<I, Q, S> extends EventoSendProvider<I, Q, S> {
//   respond(): Promise<Response>;
// }

// export function isResponseType(obj: unknown): obj is ResponseType {
//   if (typeof obj !== "object" || obj === null) {
//     return false;
//   }
//   return (obj as ResponseType).type === "Response";
// }
