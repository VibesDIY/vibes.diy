# The worked example is the leak: 3D skill docs teach React patterns that bleed GPU

Source: `claude/fix-2639-deab20` (fixes #2639) — edits the SkyGlider and
HalftoneArtStudio examples in `prompts/pkg/llms/three-js.md` and two snippets in
`prompts/pkg/llms/webxr.md`. No runtime code changed; the diff is entirely
inside fenced code blocks that the codegen model copies wholesale.

The trade-off that makes these examples dangerous: they're *complete, runnable
apps*, which is exactly why a model reproduces their shape verbatim — including
the missing `cancelAnimationFrame`, the absent `renderer.dispose()`, and the
`[parameters]`-keyed effect that spins up a fresh, uncancelled rAF loop on every
slider drag. A leak written once in a teaching example becomes a leak in every
generated 3D app. The examples *looked* correct because they render fine on
first mount; the cost only shows up on unmount/remount, which an eyeball review
of a screenshot never exercises.

The non-obvious bit was disposal coverage. `renderer.dispose()` alone is the
trap — it frees the context but not the geometries, materials, `CanvasTexture`s,
`OrbitControls`, or `EffectComposer` passes still holding GPU memory. The
durable pattern is `scene.traverse(...)` disposing each `geometry`/`material`
(and `material.map` for canvas/HDR textures), plus explicit `controls.dispose()`
and `composer.passes.forEach(p => p.dispose?.())` before the renderer goes. That
`?.()` matters: `RenderPass` has no `dispose`, `HalftonePass` does.

Angles worth a full post:

1. **Example corpus as an attack surface on output quality.** The clean-code
   review that found this (#2631, #2639) treated shipped skill docs the way you'd
   treat a dependency: every pattern in them is transitively in production. Worth
   a post on auditing *teaching* code with the same rigor as runtime code,
   because its blast radius is larger.

2. **Leaks that only a lifecycle test catches.** First-render-looks-fine is the
   whole problem. The verification these examples actually need is mount → unmount
   → remount with a WebGL-context counter — which is also the thing nobody runs on
   a Markdown file. How do you gate doc changes on a behavior you can only see at
   runtime?

3. **"Soften the prose or wire the feature."** The webxr AR example *claimed*
   anchoring it never implemented (hit-test + `position.clone()`, no
   `WebXRAnchorSystem`). Picking "make the words true" over "make the code do the
   words" when you can't runtime-verify AR is a recurring honest-docs call worth
   naming.
