# The last 1% of removing a dependency is the deploy script you forgot about

Source: `claude/design-spec-2905-au2501` (#2905)

We in-sourced `@fireproof/core-cli` into the monorepo command by command — the
`tsc`/`build` slice became `@vibes.diy/build-cli`, the cmd-ts progress primitives
became `@vibes.diy/cmd-tools`, the device-id symbols moved to
`@vibes.diy/identity`. Every _source import_ was gone. But the runtime
`dependency` couldn't be dropped, because four CI/deploy steps still shelled out
to `node vibes-diy/node_modules/@fireproof/core-cli/run.js writeEnv` by path to
turn `--fromEnv KEY` flags into a JSON blob for `wrangler secret bulk`.

The angle: how a dependency hides in your _deploy YAML_ long after it's gone from
your TypeScript — and why the last command (`writeEnv`) is the riskiest to lift
even though it's the smallest, because PR CI never runs the deploy path, so a
subtly-wrong secrets writer fails silent until prod. The trade-off worth
expanding: a dedicated `@vibes.diy/deploy-cli` (keeps build-cli's zero-`core-*`
hard gate clean) vs. a 20-line standalone script (smallest surface, least
faithful to the "mechanical lift" north star).
