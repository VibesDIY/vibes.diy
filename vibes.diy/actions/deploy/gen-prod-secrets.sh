#!/bin/bash
set -e

# Generate fresh prod secrets and write them directly to .prod.vars and GH environments.
# Run from repo root or any directory.
# Requires: core-cli (from ~/code/fp/fireproof), gh cli

FIREPROOF_DIR="$HOME/code/fp/fireproof"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PROD_VARS="$REPO_DIR/vibes.diy/pkg/.prod.vars"

echo "=== Generating session token keypair ==="
KEYPAIR=$(cd "$FIREPROOF_DIR" && pnpm exec core-cli key --generatePair 2>/dev/null)
CST_PUBLIC=$(echo "$KEYPAIR" | grep CLOUD_SESSION_TOKEN_PUBLIC | cut -d= -f2)
CST_SECRET=$(echo "$KEYPAIR" | grep CLOUD_SESSION_TOKEN_SECRET | cut -d= -f2)

echo "=== Generating device ID CA cert ==="
CA_OUTPUT=$(cd "$FIREPROOF_DIR" && pnpm exec core-cli deviceId ca-cert --envVars \
  --common-name "vibes.diy" -o "Vibes DIY" -l "Portland" -s "Oregon" -c "US" 2>/dev/null)
CA_PRIV_KEY=$(echo "$CA_OUTPUT" | grep DEVICE_ID_CA_PRIV_KEY | cut -d= -f2)
CA_CERT=$(echo "$CA_OUTPUT" | grep DEVICE_ID_CA_CERT | cut -d= -f2)

echo "=== Updating .prod.vars ==="
if [[ "$(uname)" == "Darwin" ]]; then
  SED_I="sed -i ''"
else
  SED_I="sed -i"
fi

# Use perl for reliable in-place replacement (handles long values better than sed)
perl -i -pe "s|^CLOUD_SESSION_TOKEN_PUBLIC=.*|CLOUD_SESSION_TOKEN_PUBLIC=$CST_PUBLIC|" "$PROD_VARS"
perl -i -pe "s|^CLOUD_SESSION_TOKEN_SECRET=.*|CLOUD_SESSION_TOKEN_SECRET=$CST_SECRET|" "$PROD_VARS"
perl -i -pe "s|^DEVICE_ID_CA_PRIV_KEY=.*|DEVICE_ID_CA_PRIV_KEY=$CA_PRIV_KEY|" "$PROD_VARS"
perl -i -pe "s|^DEVICE_ID_CA_CERT=.*|DEVICE_ID_CA_CERT=$CA_CERT|" "$PROD_VARS"

echo "=== Setting GH environment variables and secrets ==="
cd "$REPO_DIR"

for ENV in prodv2 cli; do
  echo "  Setting $ENV..."
  gh variable set CLOUD_SESSION_TOKEN_PUBLIC --env "$ENV" --body "$CST_PUBLIC"
  gh secret set CLOUD_SESSION_TOKEN_SECRET --env "$ENV" --body "$CST_SECRET"
  gh secret set DEVICE_ID_CA_PRIV_KEY --env "$ENV" --body "$CA_PRIV_KEY"
  gh variable set DEVICE_ID_CA_CERT --env "$ENV" --body "$CA_CERT"
done

echo ""
echo "=== Done ==="
echo "Session token and CA cert regenerated for prodv2 + cli."
echo "Remaining manual secrets in .prod.vars (paste values yourself):"
grep '<from' "$PROD_VARS" | sed 's/=.*//'
