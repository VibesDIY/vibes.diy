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
  publicChannels: Set<string>,
  adminOverride = false,
  // Fail closed: when true, a doc with no access-fn output (e.g. a DM message
  // written before #2290, which has no AccessFnOutputs row) is dropped rather
  // than returned. Without this, a db whose docs all predate channelization
  // would have its rows returned to everyone (outputRows.length === 0 → return
  // all). DM dbs pass this so legacy, output-less threads stay private even
  // though we deliberately don't migrate them (Codex review).
  requireOutput = false
): Doc[] {
  if (adminOverride && !requireOutput) return docs;
  if (outputRows.length === 0) return requireOutput ? [] : docs;

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
