# Storage activation plan

## Goal

Re-enable the Fireproof `_files` API on the vibes.diy server so Firefly supports the full set of Fireproof features — large blob attachments living next to documents, served back through the same fetch path. The server has the storage peers in place but the path was disabled while the streaming write path was unreliable. This plan finishes that.

## What's done

[VibesDIY/vibes.diy#1537](https://github.com/VibesDIY/vibes.diy/pull/1537) lands the storage layer end-to-end:

- **R2 keying redesign** — `s3://r2/<cid>` finals, `s3://r2/temp/<id>.tmp` in-flights. R2 lifecycle rules can sweep orphans on `temp/` without a janitor.
- **`R2ToS3Api` unified buffer + multipart `put`** — small assets (≤5 MiB) take a single PUT; larger assets transparently switch to multipart. Memory bound is one part (~5 MiB) regardless of total asset size. Lazy promotion: small path never starts multipart.
- **Non-blocking writes** — `WritableStream.write/close` return immediately so cement's per-op `peerTimeout` can't fire on R2 round-trips. Real R2 work runs in the background; `awaitPut` (called from `rename`, outside the cement window) is where callers wait for completion.
- **Streaming multipart `rename`** — Range-get + `uploadPart` per chunk, no whole-object buffering. Same memory profile as `put`. TODO points at S3-compatible CopyObject for an eventual O(1) version.
- **Cement teeWriter patch** — `peerTimeout` (mirrors closed mabels/cement#654) plus per-peer error detail so collapsed `"all peers failed"` strings now carry the real cause. Lives at [patches/@adviser__cement.patch](../patches/@adviser__cement.patch), derived from two clean upstream-PRable branches on `jchris/cement`.
- **Idle timeout in `VibesDiyApi.request`** — `cfg.timeoutMs` is now an idle window (resets on any incoming message) instead of an absolute wall-clock cap. The plumbing for progress-based keepalive is already wired on the client.
- **Validation tooling** — [vibes.diy/api/svc/usage-report/r2-validate.sh](../vibes.diy/api/svc/usage-report/r2-validate.sh) honors `VIBES_API_URL`, exercises both small and multipart paths, cross-checks routing against the Apps + Assets tables.

End-to-end verified on PR preview at 6 KB (small path) and 8 MiB (multipart put + multipart streaming rename).

## What's left

We're laying groundwork — the storage path needs to be solid in prod before any client feature depends on it. Order matters:

1. **Storage progress events** — design at [notes/storage-progress.md](storage-progress.md). Per-call `onProgress` on `storage.ensure`, emitted per `uploadPart` from `R2ToS3Api`, push handler routes via `wrapMsgBase + conn.send`. This is the immediate next commit.
2. **Drop the CLI idle bump from 30s back to 10s** — once progress events flow during multipart, the bump is no longer needed.
3. **Cli soak** — tag a fresh `vibes-diy@c<version>` from the merged branch, watch `wrangler tail` for any R2-side errors, run `r2-validate.sh` against `cli-v2.vibesdiy.net` periodically.
4. **R2 `temp/` lifecycle rule** — once cli has been writing for a while and we see real `temp/` activity, add a 24h-TTL delete rule via the Cloudflare dashboard. Sweeps orphans from any failed in-flight upload.
5. **Prod tag** — only after cli soak is clean. Per saved policy: never push `vibes-diy@p*` without explicit confirmation. Storage activation lives in prod, exercised by the existing chat/push flows, before any client starts depending on it for `_files`.
6. **Re-enable `_files` on the Fireproof client side** — once the server-side soak is clean in prod, the client config can stop carving `_files` out of the doc payload and start letting it ride through `storage.ensure`. That's where Firefly gets full Fireproof feature parity. By this point the storage path has already been hot in prod for days, so client uptake is low-risk.

## Why progress events, not bigger timeouts

A fixed timeout is a guess about the slowest reasonable operation. For pushes we can already break it:

- A 5 MiB push fits in 10s on a fast link, breaks at 10s on a slow link.
- Bumping to 30s buys ~50 MB; bumping to 60s buys ~100 MB; never finishes.
- Multi-GB files (video, datasets — exactly what `_files` enables) defeat any fixed window.

Worse, a fixed timeout is bad telemetry: you can't tell "it was working, just slow" from "the worker wedged 25 seconds ago and we're about to find out." The client has no signal between "request sent" and "timeout."

Real progress events flip this:

- An actively-progressing upload emits messages naturally (per `uploadPart`, per asset commit) — the idle window resets on real signal.
- A wedged worker stops emitting, and a tight idle window (10s — back to the api-impl default) detects it fast.
- The same payload (`stage`, `bytes`, `partNumber`) is the foundation for actual UX progress bars later. Same wire, same envelope, no second protocol.

This is also how the chat/LLM streaming path already works — `appendBlockEvent` emits `SectionEvent`s during long completions, and that's been stable. Storage progress is the same idea applied to writes. See [notes/storage-progress.md](storage-progress.md) for the full design.

## Links

- Design doc: [notes/storage-progress.md](storage-progress.md)
- Activation plan (full 13-phase plan with safety blocks): `~/.claude/plans/yes-not-a-runbook-smooth-blanket.md`
- Streaming investigation findings: `~/.claude/plans/we-are-all-set-snappy-rain.md`
- Pull request: [VibesDIY/vibes.diy#1537](https://github.com/VibesDIY/vibes.diy/pull/1537)
