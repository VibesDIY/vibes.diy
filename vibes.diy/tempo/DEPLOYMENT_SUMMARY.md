# Deployment Summary - Tempo K3s Cluster

## ✅ Deployed Successfully

**Date**: December 15, 2025
**Location**: US West (Hillsboro, Oregon)
**Provider**: Hetzner Cloud

## Cluster Details

Get current cluster details:

```bash
cd /Users/menabe/Software/fproof/vibes.diy/vibes.diy/tempo
pulumi stack output serverIp
pulumi stack output apiServer
```

- **Server Type**: cpx21 (~$7/month)
- **Domain**: vibesdiy.net
- **Cluster Name**: tempo

## Installed Components

✅ **K3s** - Lightweight Kubernetes
✅ **Traefik** - Ingress controller (K3s default)
✅ **cert-manager** - Automatic SSL certificates from Let's Encrypt
✅ **external-dns** - Automatic Cloudflare DNS management (using registry.k8s.io/external-dns/external-dns:v0.18.0)
✅ **OIDC Authentication** - GitHub Actions integration

## Key Improvements Made

1. **Single-Step Setup**: Everything installs via cloud-init (no manual steps needed)
2. **Kubeconfig Access**: Copied to `/root/.kube/config` for easier SSH access
3. **Correct Image**: Using `registry.k8s.io/external-dns/external-dns:v0.18.0`
4. **Manual Deployment**: Direct YAML deployment for external-dns

## Quick Access

```bash
# Get server IP
SERVER_IP=$(pulumi stack output serverIp)

# SSH to the server
ssh root@$SERVER_IP

# Check cluster status
kubectl get nodes
kubectl get pods -A

# Check components
kubectl get clusterissuer                    # cert-manager
kubectl get pods -l app=external-dns         # external-dns
kubectl get pods -n kube-system -l app.kubernetes.io/name=traefik  # traefik
```

## GitHub Actions Setup

Add these secrets to your GitHub repository:
`VibesDIY/vibes.diy` → Settings → Secrets and variables → Actions

Use the automated script:

```bash
cd /Users/menabe/Software/fproof/vibes.diy/vibes.diy/tempo
bash scripts/setup-github-secrets-auto.sh
```

This will automatically set:

- `K8S_API_SERVER`
- `K8S_CA_CERT`

## Example Deployment

Create a file `k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  namespace: apps
spec:
  replicas: 2
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp
          image: nginx:alpine
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: myapp
  namespace: apps
spec:
  selector:
    app: myapp
  ports:
    - port: 80
---
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

When you deploy this:

1. **external-dns** creates `myapp.vibesdiy.net` DNS record → your server IP
2. **cert-manager** requests SSL certificate from Let's Encrypt
3. **Traefik** serves your app with HTTPS

## Cost

- **Hetzner cpx21**: $7.10/month
- **Traffic**: 20TB included
- **Cloudflare**: Free
- **Let's Encrypt**: Free
- **Total**: ~$7/month

## Configuration

All configuration is in Pulumi:

```bash
cd /Users/menabe/Software/fproof/vibes.diy/vibes.diy/tempo
pulumi config
```

## Next Deployment

For future deployments, just run:

```bash
pulumi up
```

Everything installs automatically via cloud-init in ~5 minutes.
