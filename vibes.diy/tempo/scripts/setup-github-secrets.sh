#!/bin/bash
set -e

cd "$(dirname "$0")/.."

# Get outputs from Pulumi
SERVER_IP=$(pulumi stack output serverIp)
API_SERVER=$(pulumi stack output apiServer)

echo "Fetching CA certificate from server..."
CA_CERT=$(ssh -o StrictHostKeyChecking=no root@$SERVER_IP "cat /var/lib/rancher/k3s/server/tls/server-ca.crt" | base64 | tr -d '\n')

echo ""
echo "Add these secrets to your GitHub repository:"
echo "Settings → Secrets and variables → Actions → New repository secret"
echo ""
echo "Name: K8S_API_SERVER"
echo "Value: $API_SERVER"
echo ""
echo "Name: K8S_CA_CERT"
echo "Value:"
echo "$CA_CERT"
echo ""

# Optionally fetch kubeconfig
echo "Fetching kubeconfig..."
ssh -o StrictHostKeyChecking=no root@$SERVER_IP "cat /etc/rancher/k3s/k3s.yaml" > kubeconfig.yaml
sed -i.bak "s/127.0.0.1/$SERVER_IP/g" kubeconfig.yaml
rm kubeconfig.yaml.bak 2>/dev/null || true
echo "Kubeconfig saved to kubeconfig.yaml"
echo ""
echo "Test with: export KUBECONFIG=./kubeconfig.yaml && kubectl get nodes"
