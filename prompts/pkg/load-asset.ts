import { exception2Result, pathOps, Result } from "@adviser/cement";

export async function loadAsset(
  localPath: string,
  fallBack: URL,
): Promise<Result<string>> {
  let url = { url: fallBack, fallBack: true };
  if (import.meta.url) {
    url = { url: new URL(import.meta.url), fallBack: false };
    if (url.url.protocol.startsWith("file")) {
      url = { url: fallBack, fallBack: true };
    }
  }
  if (url.fallBack) {
    const p = pathOps.basename(localPath);
    url.url.pathname = pathOps.join(url.url.pathname, p);
  } else {
    url.url.pathname = pathOps.join(url.url.pathname, localPath);
  }
  const rRes = await exception2Result(() => fetch(url.url));
  if (rRes.isErr()) {
    return Result.Err(rRes);
  }
  return Result.Ok(await rRes.Ok().text());
}
