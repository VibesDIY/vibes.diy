#!/bin/bash
set -e

cd "$(dirname "$0")/.."

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI (gh) is not installed"
    echo "Install it with: brew install gh"
    echo "Or visit: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "Error: Not authenticated with GitHub CLI"
    echo "Run: gh auth login"
    exit 1
fi

echo "===================================="
echo "Setting GitHub Secrets Automatically"
echo "===================================="
echo ""

# Get server IP from Pulumi
echo "Getting server IP from Pulumi..."
SERVER_IP=$(pulumi stack output serverIp)
API_SERVER="https://$SERVER_IP:6443"

echo "API Server: $API_SERVER"

# Get CA cert from server
echo "Fetching CA certificate from server..."
CA_CERT=$(ssh -o StrictHostKeyChecking=no root@$SERVER_IP "cat /var/lib/rancher/k3s/server/tls/server-ca.crt" | base64 | tr -d '\n')

if [ -z "$CA_CERT" ]; then
    echo "Error: Failed to fetch CA certificate"
    exit 1
fi

echo "CA certificate fetched successfully"
echo ""

# Set secrets using gh CLI
echo "Setting K8S_API_SERVER secret..."
echo "$API_SERVER" | gh secret set K8S_API_SERVER

echo "Setting K8S_CA_CERT secret..."
echo "$CA_CERT" | gh secret set K8S_CA_CERT

echo ""
echo "===================================="
echo "✅ Secrets set successfully!"
echo "===================================="
echo ""
echo "Secrets added to GitHub repository:"
echo "  ✓ K8S_API_SERVER = $API_SERVER"
echo "  ✓ K8S_CA_CERT = <base64 encoded certificate>"
echo ""
echo "You can now trigger the workflow:"
echo "  gh workflow run test-hetzner-cluster.yaml"
echo ""
echo "Or push changes to trigger automatically."
