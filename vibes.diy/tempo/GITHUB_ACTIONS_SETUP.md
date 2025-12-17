# GitHub Actions Setup

To use the GitHub Actions workflow to deploy to your Hetzner K3s cluster, you need to add two secrets to your repository.

## Required Secrets

Go to: **https://github.com/VibesDIY/vibes.diy/settings/secrets/actions**

Or: `Settings → Secrets and variables → Actions → New repository secret`

## Automated Setup (Recommended)

Use the automated script that fetches values from Pulumi:

```bash
cd /Users/menabe/Software/fproof/vibes.diy/vibes.diy/tempo
bash scripts/setup-github-secrets-auto.sh
```

This will automatically:

- Get server IP from Pulumi
- Fetch CA cert from the server
- Set both secrets using `gh` CLI

## Manual Setup

If you prefer to set secrets manually:

### 1. K8S_API_SERVER

Get the Kubernetes API server URL:

```bash
cd /Users/menabe/Software/fproof/vibes.diy/vibes.diy/tempo
pulumi stack output apiServer
```

### 2. K8S_CA_CERT

Get the base64-encoded CA certificate:

```bash
SERVER_IP=$(pulumi stack output serverIp)
ssh root@$SERVER_IP "cat /var/lib/rancher/k3s/server/tls/server-ca.crt" | base64 | tr -d '\n'
```

Copy the output and paste it as the secret value.

## Test the Workflow

Once secrets are added:

1. **Manual trigger**: Go to Actions → "Deploy Hello World to Hetzner K3s" → Run workflow

2. **Automatic trigger**: Push changes to:
   - `vibes.diy/tempo/examples/hello-world/deployment.yaml`
   - `.github/workflows/test-hetzner-cluster.yaml`

## Verify Deployment

After the workflow runs successfully:

1. **Check GitHub Actions**: You should see a green checkmark
2. **Check DNS**: `dig hello.vibesdiy.net` should return your server IP
3. **Access app**: https://hello.vibesdiy.net (wait ~2 minutes for SSL)

## Troubleshooting

### OIDC Token Issues

If you get authentication errors:

- Check that the workflow has `permissions: id-token: write`
- Verify the cluster is configured for OIDC (already done)
- Check that the RBAC binding exists: `kubectl get clusterrolebinding github-actions-deployer`

### Connection Issues

If kubectl can't connect:

- Verify secrets are set correctly in GitHub
- Verify `K8S_CA_CERT` is base64-encoded (no newlines)
- Check cluster is accessible: `curl -k $(pulumi stack output apiServer)/version`

### Deployment Issues

Check logs on the server:

```bash
SERVER_IP=$(pulumi stack output serverIp)
ssh root@$SERVER_IP

# Check deployment
kubectl get all -n apps -l app=hello-world

# Check events
kubectl get events -n apps --sort-by=.lastTimestamp

# Check external-dns
kubectl logs -l app=external-dns

# Check cert-manager
kubectl logs -n cert-manager -l app=cert-manager
```

## What the Workflow Does

1. ✅ Checks out code
2. ✅ Gets OIDC token from GitHub
3. ✅ Configures kubectl with cluster credentials
4. ✅ Tests connection to cluster
5. ✅ Creates apps namespace (if needed)
6. ✅ Deploys hello-world application
7. ✅ Waits for deployment to be ready
8. ✅ Shows deployment status

The whole process takes ~30-60 seconds!

## Security Notes

- **OIDC tokens** are temporary and scoped to this workflow run
- **No long-lived credentials** are stored in GitHub
- **RBAC** limits permissions to specific resources
- **Branch restriction**: Only `main` branch can deploy (configured in RBAC)

## Next Steps

Once the hello-world example works, you can:

1. Copy the workflow for your own apps
2. Modify the deployment manifests
3. Add more environments (staging, production)
4. Set up branch-specific deployments
