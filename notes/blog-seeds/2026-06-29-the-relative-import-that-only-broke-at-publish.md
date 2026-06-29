# The relative import that compiled everywhere except the one build that ships

Source: `claude/fix-2855-api-svc-publish-ssr-seam` (#2855, fallout from SSR slice 4 / #2802)

The SSR slice-4 code in `@vibes.diy/api-svc` reached its executor modules with a relative path:
`import { selectExecutor } from "../../../vibe/runtime/vibe-executor.js"` — three levels up and over
into a *different workspace package's source*. The file's own header comment blessed it: "the api
worker is bundled from monorepo source, so these are reached relatively, not via the package root."
That's true — for the esbuild worker bundle, which resolves against the whole monorepo tree. It was
also the entire bug. `@vibes.diy/api-svc` has a *second* consumer: it's published to npm, and the
publish build (`core-cli build`) copies **only this package's** sources into `dist/npm/` and runs a
standalone `tsc` with `include: ["**/*"]`. From there, `../../../vibe/runtime/*` points outside the
copied tree at nothing, and `tsc` raised `TS2307`. Every `pkg@p` ship went red on that package and
left `api-svc` + `use-vibes` a patch behind on npm — silently, because CI's `compile_test` builds the
*worker* (esbuild, resolves fine), never the package publish tsc.

The trap inside the trap: the "obvious" fix — exclude the worker-only SSR files from the publish
`tsconfig` — doesn't work. A publish build with `include: ["**/*"]` makes every file a compile root
and then *follows imports*, so `render-vibe.ts` (reachable from the published `cf-serve` surface)
drags `vibe-ssr-attempt.ts` back into the program no matter what `exclude` says. `exclude` only drops
root files; it can't sever a transitive edge. The only real fix is to make the cross-package reach a
**package edge**: declare `@vibes.diy/vibe-runtime` as a dependency and import `@vibes.diy/vibe-runtime/
vibe-executor.js` (a subpath, so `react-dom/server` still stays off the client entry and the
browser-iframe guard holds). Now it resolves the same way in both builds, because it resolves the way
npm actually resolves.

Two lessons worth a post. First: a relative import that climbs out of its own package is a latent
publish bug even when every local build is green — the package boundary is real precisely at the
moment you `npm publish`, and nowhere earlier. Second, the meta-failure: the only thing that exercises
the publish build is `publish` itself, so the break surfaces as a red *release*, not a red *PR*. The
durable fix isn't this one import — it's a CI guard that runs `core-cli build` for every published
package on PRs, so "compiles in the bundle" can never again masquerade as "ships to npm." (Filed as the
follow-up on #2855.)
