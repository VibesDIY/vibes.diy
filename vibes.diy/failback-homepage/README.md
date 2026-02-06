# Failback Homepage

This directory previously contained a standalone copy of the vibes.diy app, deployed as the Cloudflare Worker `vibes-diy-serve`. It served as the current target of the `stable-entry` worker's `BACKEND` environment variable.

## Production Architecture

```
User request
    |
    v
stable-entry  (reverse proxy, BACKEND=https://vibes.diy)
    |
    v
vibes.diy     (DNS -> vibes-diy-v2-prod worker)
    |
    +-- App UI, chat, auth (Durable Objects, D1)
    |
    +-- Published apps served by vibes-hosting-v2
        on *.vibesdiy.net, *.vibecode.garden, etc.
```

The `stable-entry` worker is a simple reverse proxy deployed to Cloudflare. It forwards all incoming requests (path, query, method, headers, body) to whatever URL is set in its `BACKEND` env var. This gives an indirection layer: the public-facing domain points at `stable-entry`, while the actual backend can be swapped by changing `BACKEND` without touching DNS.

The main application is now served entirely from `vibes.diy/pkg/` (the `vibes-diy-v2` worker). This directory's code has been removed since it was a stale copy.

# TODO -- deploy a simpler HTML-only failback homepage
