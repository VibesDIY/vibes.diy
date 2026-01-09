# GitHub Workflow Created ✅

## Files Created

### Workflow

📄 `.github/workflows/test-hetzner-cluster.yaml`

- Triggers on push to main (when hello-world files change)
- Can be manually triggered
- Uses OIDC authentication (no stored credentials!)
- Deploys hello-world app to K3s cluster

### Hello World Example

📁 `tempo/examples/hello-world/`

- `deployment.yaml` - Complete K8s manifest
- `README.md` - Documentation

### Setup Guide

📄 `GITHUB_ACTIONS_SETUP.md` - Instructions for adding GitHub secrets

## Quick Start

### 1. Add GitHub Secrets

Use the automated script:

```bash
cd /Users/menabe/Software/fproof/vibes.diy/vibes.diy/tempo
bash scripts/setup-github-secrets-auto.sh
```

This will automatically set:

- **K8S_API_SERVER**: Your cluster API URL
- **K8S_CA_CERT**: Base64-encoded CA certificate

### 2. Test the Workflow

**Manual trigger**:

1. Go to: https://github.com/VibesDIY/vibes.diy/actions
2. Select "Deploy Hello World to Hetzner K3s"
3. Click "Run workflow"

**Or push changes**:

```bash
# Make changes to hello-world deployment
# Commit and push to main branch
```

### 3. Verify Deployment

After ~1-2 minutes:

- ✅ Workflow should complete successfully
- ✅ DNS: `dig hello.vibesdiy.net` → your server IP
- ✅ App: https://hello.vibesdiy.net (wait ~2 min for SSL)

## How It Works

```
GitHub Actions (OIDC token)
    ↓
Authenticate to K3s
    ↓
Deploy hello-world (nginx)
    ↓
Ingress created
    ↓
external-dns creates DNS record
    ↓
cert-manager requests SSL certificate
    ↓
Traefik serves with HTTPS
```

**Timeline**:

- Deployment: ~30 seconds
- DNS propagation: ~30 seconds
- SSL certificate: ~1 minute
- **Total**: ~2 minutes from push to live HTTPS site

## What You Get

✅ **Automatic deployments** from GitHub
✅ **OIDC authentication** (no credentials in GitHub)
✅ **Automatic DNS** (external-dns + Cloudflare)
✅ **Automatic SSL** (cert-manager + Let's Encrypt)
✅ **High availability** (2 replicas)
✅ **Health checks** (liveness + readiness probes)

## Workflow Features

- ✅ Uses GitHub OIDC (temporary tokens)
- ✅ Validates connection before deploying
- ✅ Waits for rollout to complete
- ✅ Shows detailed status
- ✅ Can be triggered manually
- ✅ Runs on push to main

## Security

- **No stored credentials** - Uses OIDC tokens
- **Limited permissions** - RBAC restricts to specific resources
- **Branch protected** - Only main branch can deploy
- **Namespace isolated** - Deploys to `apps` namespace

## Next Steps

1. **Add secrets to GitHub** (use automated script)
2. **Test the workflow** manually
3. **Verify deployment** at https://hello.vibesdiy.net
4. **Customize** for your own apps!

## Example: Deploy Your Own App

Just copy the workflow and modify:

```yaml
- name: Deploy Your App
  run: |
    kubectl apply -f k8s/your-app.yaml -n apps
```

That's it! 🚀
