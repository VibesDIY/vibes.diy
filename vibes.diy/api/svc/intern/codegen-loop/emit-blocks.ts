import type { BlockBeginMsg, CodeBeginMsg, CodeLineMsg, CodeEndMsg, BlockEndMsg, BlockUsage } from "@vibes.diy/call-ai-v2";

export type BlockEvent = BlockBeginMsg | CodeBeginMsg | CodeLineMsg | CodeEndMsg | BlockEndMsg;

export interface BlockIds {
  blockId: string;
  streamId: string;
  sectionIdFor: (filename: string) => string;
  nextSeq: () => number;
  blockNr: number;
  usage: BlockUsage;
  reveal?: "typewriter";
  /** UTF-8 byte length of a string (wired from `sthis.txt.encode` — no `new TextEncoder`). */
  byteLength: (s: string) => number;
}

export function buildBlockEvents(files: { filename: string; lang: string; content: string }[], ids: BlockIds): BlockEvent[] {
  const now = new Date();
  const base = {
    blockId: ids.blockId,
    streamId: ids.streamId,
    blockNr: ids.blockNr,
    timestamp: now,
  } as const;

  const events: BlockEvent[] = [
    {
      type: "block.begin",
      seq: ids.nextSeq(),
      ...base,
    } satisfies BlockBeginMsg,
  ];

  let totalCodeLines = 0;
  let totalCodeBytes = 0;

  for (const file of files) {
    const sectionId = ids.sectionIdFor(file.filename);

    events.push({
      type: "block.code.begin",
      sectionId,
      lang: file.lang,
      path: file.filename,
      reveal: ids.reveal,
      seq: ids.nextSeq(),
      ...base,
    } satisfies CodeBeginMsg);

    const lines = file.content.split("\n");
    for (let lineNr = 0; lineNr < lines.length; lineNr++) {
      events.push({
        type: "block.code.line",
        sectionId,
        lang: file.lang,
        path: file.filename,
        line: lines[lineNr],
        lineNr,
        seq: ids.nextSeq(),
        ...base,
      } satisfies CodeLineMsg);
    }

    const fileBytes = ids.byteLength(file.content);
    totalCodeLines += lines.length;
    totalCodeBytes += fileBytes;

    events.push({
      type: "block.code.end",
      sectionId,
      lang: file.lang,
      path: file.filename,
      stats: { lines: lines.length, bytes: fileBytes },
      seq: ids.nextSeq(),
      ...base,
    } satisfies CodeEndMsg);
  }

  events.push({
    type: "block.end",
    stats: {
      toplevel: { lines: 0, bytes: 0 },
      code: { lines: totalCodeLines, bytes: totalCodeBytes },
      image: { lines: 0, bytes: 0 },
      total: { lines: totalCodeLines, bytes: totalCodeBytes },
    },
    usage: ids.usage,
    seq: ids.nextSeq(),
    ...base,
  } satisfies BlockEndMsg);

  return events;
}
