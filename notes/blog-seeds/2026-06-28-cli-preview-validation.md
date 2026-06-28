# Why a PR preview needs a *different* device cert than prod — and how the CLI reaches it

Source: `claude/cli-vibes-preview-env-k260zt`

Pointing the `vibes-diy` CLI at a PR's preview worker (`VIBES_API_URL=https://pr-<N>-vibes-diy-v2.jchris.workers.dev/api`) fails `[authentication_required]` with the normal device cert — because previews share dev's bindings, so their certs are issued by the `DEV` CA, not `vibes.diy`. The fix is a second headless cert, `VIBES_DEVICE_ID_PREVIEW`. The gotcha worth a post: the CLI only seeds its keybag when it's *empty* ("an existing login always wins"), so switching environments mid-session silently keeps the stale cert until you delete `~/.fireproof/keybag/`. A nice concrete lens on the keybag/device-id auth model, the dev/prod/preview CA split, and using the slow `compile_test` window to validate changed features against a real preview instead of just unit tests.
