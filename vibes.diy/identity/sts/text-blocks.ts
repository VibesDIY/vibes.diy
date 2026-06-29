// Lifted verbatim from @fireproof/core-runtime@0.24.19 `utils.js` (upstream tag
// fireproof-storage/fireproof@v0.24.19), adjusting only imports/types. The
// PEM/MIME block parser + `Result.filterOk` helper that the sts JWK coercion
// (`env2jwk` / `verifyToken`) depends on. Behavior kept byte-identical — this
// path parses the deployed `CLOUD_SESSION_TOKEN_*` env material.
import type { Result } from "@adviser/cement";

export interface MimeBlock {
  readonly preBegin: string | undefined;
  readonly begin: string | undefined;
  readonly content: string;
  readonly end: string | undefined;
  readonly postEnd: string | undefined;
}

export function mimeBlockParser(mime: string): MimeBlock[] {
  const blocks: MimeBlock[] = [];
  const lines = mime.split("\n");
  let i = 0;
  let lastProcessedIndex = -1;
  while (i < lines.length) {
    const line = lines[i];
    const beginMatch = line.match(/^(-{3,})\s*(BEGIN)\s+(.+?)\s*(-{3,})$/i);
    if (beginMatch) {
      const leadingDashes = beginMatch[1].length;
      const trailingDashes = beginMatch[4].length;
      const blockType = beginMatch[3];
      const escapedBlockType = blockType.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const endPattern = new RegExp(`^-{${leadingDashes}}\\s*(END)\\s+${escapedBlockType}\\s*-{${trailingDashes}}$`, "i");
      const preBegin = [];
      for (let j = lastProcessedIndex + 1; j < i; j++) {
        preBegin.push(lines[j]);
      }
      i++;
      const contentLines = [];
      let foundEnd = false;
      let endLine = "";
      while (i < lines.length) {
        if (endPattern.test(lines[i])) {
          foundEnd = true;
          endLine = lines[i];
          break;
        }
        contentLines.push(lines[i]);
        i++;
      }
      if (foundEnd) {
        i++;
        const postEnd = [];
        while (i < lines.length && !lines[i].match(/^-{3,}\s*BEGIN\s+.+-{3,}$/i)) {
          postEnd.push(lines[i]);
          i++;
        }
        blocks.push({
          preBegin: preBegin.length > 0 ? preBegin.join("\n") : undefined,
          begin: line,
          content: contentLines.join("\n"),
          end: endLine,
          postEnd: postEnd.length > 0 ? postEnd.join("\n") : undefined,
        });
        lastProcessedIndex = i - 1;
      } else {
        const allContent = [...preBegin, line, ...contentLines];
        blocks.push({
          begin: undefined,
          end: undefined,
          content: allContent.join("\n"),
          preBegin: undefined,
          postEnd: undefined,
        });
        lastProcessedIndex = i - 1;
      }
    } else {
      i++;
    }
  }
  if (lastProcessedIndex < lines.length - 1) {
    const remainingLines = [];
    for (let j = lastProcessedIndex + 1; j < lines.length; j++) {
      remainingLines.push(lines[j]);
    }
    if (remainingLines.length > 0) {
      blocks.push({
        begin: undefined,
        end: undefined,
        content: remainingLines.join("\n"),
        preBegin: undefined,
        postEnd: undefined,
      });
    }
  }
  return blocks;
}

export function filterOk<T>(results: Result<T>[]): T[] {
  const okValues: T[] = [];
  for (const res of results) {
    if (res.isOk()) {
      okValues.push(res.Ok());
    }
  }
  return okValues;
}
