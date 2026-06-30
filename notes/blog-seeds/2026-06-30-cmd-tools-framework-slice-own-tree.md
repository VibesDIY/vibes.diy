# Bringing the generic cmd-ts framework slice into our own tree

Source: `claude/implement-2895-4zvy5d` (VibesDIY/vibes.diy#2895)

`@fireproof/core-cli` was really three packages wearing one barrel: a generic
build toolchain, a generic cmd-ts streaming/evento framework, and some
identity/PKI domain code. None of the first two have fireproof-domain content, so
they had no business living in a fireproof package. This PR takes the
**framework** slice — the progress/streaming primitives our CLI's message
pipeline is built on (`CmdTSMsg`/`isCmdTSMsg`/`WrapCmdTSMsg`/`CmdProgress`/
`isCmdProgress`/`sendProgress`) — and reimplements it natively in a new
`@vibes.diy/cmd-tools` workspace package that depends only on `@adviser/cement` +
`arktype`. No `@fireproof/*`.

The interesting part is how small the actual runtime coupling was once the
`cli-kit.ts` seam (#2470/#2478) had already corralled it: six symbols in one
re-export file. Because the seam was in place, repointing it at our own package
was a one-line backing swap with zero consumer changes — the entire rest of the
CLI imports from `cli-kit.ts`, never the backing. That's the payoff of building
the seam first and swapping internals later: the "extract" turned out to be a
backing change behind a stable boundary, verified by the unchanged CLI test
suite. The trade-off we deliberately did *not* take on: the build-tool half
(`core-cli tsc/build/pack/publish` across ~33 package scripts) stays on core-cli
for now — its source lives upstream and its publish output must be preserved
byte-for-byte, so it's a separate, staged migration. One seam, one slice at a
time.
