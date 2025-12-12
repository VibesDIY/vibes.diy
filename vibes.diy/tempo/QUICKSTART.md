# Quick Start Guide - Updated

## One-Step Deployment! 🚀

Everything now installs automatically via cloud-init. No manual steps needed!

## 1. Configure Pulumi

```bash
cd /Users/menabe/Software/fproof/vibes.diy/vibes.diy/tempo

# Already configured:
# - hcloud:token (Hetzner API)
# - cloudflareApiToken
# - githubOrg: VibesDIY
# - githubRepo: vibes.diy
# - sshKeyName: meno
# - location: hil (US West)
# - domain: vibesdiy.net

# Optional: Change cluster name
pulumi config set clusterName "my-cluster"
```

## 2. Deploy

```bash
pulumi up
```

Wait ~5 minutes for complete installation.

## 3. Verify

```bash
# SSH to the server
ssh root@$(pulumi stack output serverIp)

# Everything should be ready!
kubectl get nodes
kubectl get pods -A
kubectl get clusterissuer
```

## 4. Set up GitHub Actions

```bash
# Get secrets for GitHub
./scripts/setup-github-secrets.sh
```

Add the two secrets to your GitHub repository:
`VibesDIY/vibes.diy` → Settings → Secrets and variables → Actions

## 5. Deploy Your App

Create `.github/workflows/deploy.yaml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Get OIDC Token
        id: oidc
        run: |
          OIDC_TOKEN=$(curl -sS -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
            "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=https://kubernetes.default.svc.cluster.local" \
            | jq -r '.value')
          echo "::add-mask::$OIDC_TOKEN"
          echo "token=$OIDC_TOKEN" >> $GITHUB_OUTPUT
      
      - name: Configure kubectl
        run: |
          mkdir -p ~/.kube
          cat > ~/.kube/config <<EOF
          apiVersion: v1
          kind: Config
          clusters:
          - cluster:
              server: ${{ secrets.K8S_API_SERVER }}
              certificate-authority-data: ${{ secrets.K8S_CA_CERT }}
            name: k3s
          contexts:
          - context:
              cluster: k3s
              user: github-actions
              namespace: apps
            name: k3s
          current-context: k3s
          users:
          - name: github-actions
            user:
              token: ${{ steps.oidc.outputs.token }}
          EOF
      
      - name: Deploy
        run: kubectl apply -f k8s/ -n apps
```

Create `k8s/deployment.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp
  namespace: apps
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
spec:
  ingressClassName: traefik
  rules:
  - host: myapp.vibesdiy.net
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: myapp
            port:
              number: 80
  tls:
  - hosts:
    - myapp.vibesdiy.net
    secretName: myapp-tls
```

Push to GitHub → Automatic deployment! 🎉

## What Happens Automatically?

When you deploy an Ingress:

1. **external-dns** creates DNS record in Cloudflare
2. **cert-manager** requests SSL certificate from Let's Encrypt
3. **Traefik** serves your app with HTTPS

All within ~2 minutes!

## Key Improvements

✅ **Single cloud-init step** - No manual add-on installation
✅ **Kubeconfig in /root/.kube/config** - Works immediately when you SSH
✅ **Correct external-dns image** - registry.k8s.io (same as mam-hh-dns1)
✅ **Ready in 5 minutes** - From `pulumi up` to fully working cluster

## Cost

~$7/month for cpx21 in US West (Hillsboro, Oregon)

## Troubleshooting

```bash
# Check external-dns logs
kubectl logs -l app=external-dns

# Check cert-manager
kubectl get clusterissuer
kubectl get certificate -A

# Check Traefik
kubectl get pods -n kube-system -l app.kubernetes.io/name=traefik
```

## Cleanup

```bash
pulumi destroy
```

That's it! Simple, automated, production-ready K3s cluster on Hetzner Cloud.
