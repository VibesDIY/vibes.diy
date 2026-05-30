# Wrangler Tail Runbook

## Worker names by environment

| Env  | Worker name        | wrangler.toml location        |
| ---- | ------------------ | ----------------------------- |
| cli  | `vibes-diy-v2-cli` | `vibes.diy/pkg/wrangler.toml` |
| prod | `vibes-diy-v2`     | `vibes.diy/pkg/wrangler.toml` |

## How to tail

Always run from `vibes.diy/pkg/` (where wrangler.toml lives):

```sh
# Tail cli, log to file so output survives DO upgrades:
cd vibes.diy/pkg
npx wrangler tail vibes-diy-v2-cli --format pretty > /tmp/wrangler-tail.log 2>&1 &
tail -f /tmp/wrangler-tail.log

# Tail prod:
npx wrangler tail vibes-diy-v2 --format pretty > /tmp/wrangler-tail-prod.log 2>&1 &
tail -f /tmp/wrangler-tail-prod.log
```

## Reliability notes

- Named DOs emit "This script has been upgraded. Please send a new request" on deploy — wrangler reconnects automatically.
- Old log lines (pre-deploy) flush after reconnect — timestamps confirm which version emitted them.
- Tail a file rather than piping through grep so you don't lose context on reconnects.
- To filter after the fact: `grep "campaign-health\|report-cache\|fetch-campaign" /tmp/wrangler-tail.log`
