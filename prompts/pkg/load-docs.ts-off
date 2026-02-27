import { CoerceURI, Result } from "@adviser/cement";
import { joinUrlParts } from "call-ai";

export async function loadDocs(localPath: string, baseUrl: CoerceURI): Promise<Result<string>> {
  const url = joinUrlParts(baseUrl?.toString() || "", localPath);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return Result.Err(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    return Result.Ok(text);
  } catch (error) {
    return Result.Err(`Error fetching ${url}: ${error}`);
  }
}
