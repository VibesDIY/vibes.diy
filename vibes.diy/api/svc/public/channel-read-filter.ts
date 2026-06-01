interface OutputRow {
  docId: string;
  output: string;
}

type Doc = { _id: string } & Record<string, unknown>;

export function filterDocsByChannel(
  docs: Doc[],
  outputRows: OutputRow[],
  userHandle: string | null,
  effectiveChannels: Set<string>,
  publicChannels: Set<string>
): Doc[] {
  if (outputRows.length === 0) return docs;

  const docChannels = new Map<string, string[]>();
  for (const row of outputRows) {
    const parsed = JSON.parse(row.output) as { channels?: string[] };
    if (parsed.channels !== undefined && Array.isArray(parsed.channels)) {
      docChannels.set(row.docId, parsed.channels);
    }
  }

  return docs.filter((doc) => {
    const channels = docChannels.get(doc._id);
    if (channels === undefined) return false;
    for (const ch of channels) {
      if (effectiveChannels.has(ch) || publicChannels.has(ch)) return true;
    }
    return false;
  });
}
