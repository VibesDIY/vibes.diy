# Hetzner K3s Cluster with GitHub Actions OIDC

Pulumi project that deploys a K3s cluster on Hetzner Cloud with:
- **Traefik** as ingress controller (K3s default)
- **cert-manager** for automatic SSL certificates via Let's Encrypt
- **external-dns** for automatic DNS management via Cloudflare
- **OIDC authentication** for GitHub Actions deployments

## Prerequisites

1. Hetzner Cloud account and API token
2. Cloudflare account with API token
3. SSH key uploaded to Hetzner Cloud
4. Pulumi CLI installed

## Setup

### 1. Configure Hetzner Cloud

```bash
# Set your Hetzner API token
export HCLOUD_TOKEN="your-hetzner-api-token"

# Or use Pulumi config (encrypted)
pulumi config set hcloud:token --secret YOUR_TOKEN
```

### 2. Configure Cloudflare

```bash
# Set Cloudflare API token (encrypted)
pulumi config set cloudflareApiToken --secret YOUR_CLOUDFLARE_API_TOKEN

# These are already set in the config, but you can change them
pulumi config set domain "vibesdiy.net"
pulumi config set cloudflareZoneId "your-zone-id"
pulumi config set cloudflareAccountId "your-account-id"
```

### 3. Configure SSH Key

First, check your available SSH keys in Hetzner:
```bash
curl -H "Authorization: Bearer $HCLOUD_TOKEN" \
  https://api.hetzner.cloud/v1/ssh_keys
```

Then set the key name:
```bash
pulumi config set sshKeyName "your-key-name"
```

### 4. Configure GitHub Integration

```bash
pulumi config set githubOrg "your-github-org"
pulumi config set githubRepo "your-repo-name"
```

### 5. Optional: Customize

```bash
# Change server type (default: cx21 ~€5/month)
pulumi config set serverType "cx21"

# Change location (default: nbg1 - Nuremberg)
# Options: nbg1 (Nuremberg), fsn1 (Falkenstein), hel1 (Helsinki)
pulumi config set location "nbg1"

# Change cluster name (used for external-dns txt-owner-id)
pulumi config set clusterName "tempo"
```

## Deploy

```bash
# Deploy the infrastructure
pulumi up

# Wait for the server to be ready (~2 minutes)
# Then install the K8s add-ons
./scripts/setup-k8s-addons.sh
```

## Get Kubeconfig

After deployment, fetch the kubeconfig:

```bash
# Run the setup script
./scripts/setup-github-secrets.sh
```

This will:
- Fetch the kubeconfig and save it locally
- Get the CA certificate for GitHub Actions
- Show you the secrets to add to GitHub

## Verify Installation

```bash
export KUBECONFIG=./kubeconfig.yaml

# Check nodes
kubectl get nodes

# Check Traefik
kubectl get pods -n kube-system -l app.kubernetes.io/name=traefik

# Check cert-manager
kubectl get pods -n cert-manager
kubectl get clusterissuer

# Check external-dns
kubectl get pods -l app.kubernetes.io/name=external-dns

# Check GitHub Actions RBAC
kubectl get clusterrolebinding github-actions-deployer
```

## GitHub Actions Setup

### 1. Add Secrets to GitHub Repository

Go to: `Settings → Secrets and variables → Actions`

Add these secrets (provided by setup-github-secrets.sh):
- `K8S_API_SERVER`: The API server URL
- `K8S_CA_CERT`: Base64 encoded CA certificate

### 2. Example Workflow

Create `.github/workflows/deploy.yaml`:

```yaml
name: Deploy to K3s
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
        run: |
          kubectl apply -f k8s/ -n apps
          kubectl rollout status deployment/myapp -n apps
```

## Example Deployment with Traefik

Create `k8s/deployment.yaml`:

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
    targetPort: 80
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

## How It Works

1. **Traefik**: K3s includes Traefik by default as the ingress controller
2. **external-dns**: Watches Ingress resources and creates DNS records in Cloudflare
3. **cert-manager**: Watches Ingress TLS annotations and requests Let's Encrypt certificates
4. **Let's Encrypt**: Uses Cloudflare DNS-01 challenge for certificate validation

When you create an Ingress:
1. external-dns creates the DNS A record pointing to your server
2. cert-manager requests a certificate from Let's Encrypt
3. Let's Encrypt validates via Cloudflare DNS-01 challenge
4. Traefik serves your app with the certificate

## Cost

- **Server**: ~€5-6/month (cx21)
- **Traffic**: 20TB included
- **Total**: ~€5-6/month

## Troubleshooting

### SSH into the server
```bash
ssh root@$(pulumi stack output serverIp)
```

### Check K3s status
```bash
ssh root@$(pulumi stack output serverIp) "systemctl status k3s"
```

### View logs
```bash
# K3s logs
ssh root@$(pulumi stack output serverIp) "journalctl -u k3s -f"

# Traefik logs
kubectl logs -n kube-system -l app.kubernetes.io/name=traefik

# cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager

# external-dns logs
kubectl logs -l app.kubernetes.io/name=external-dns
```

### Test certificate issuance
```bash
# Check ClusterIssuer
kubectl get clusterissuer letsencrypt-prod

# Check certificates
kubectl get certificates -A

# Check certificate requests
kubectl get certificaterequests -A

# Describe certificate for details
kubectl describe certificate myapp-tls -n apps
```

### Test DNS updates
```bash
# Check external-dns logs
kubectl logs -l app.kubernetes.io/name=external-dns --tail=50

# Verify DNS record
dig myapp.vibesdiy.net
```

## Cleanup

```bash
pulumi destroy
```

This will delete:
- The Hetzner server
- The network and firewall
- All DNS records created by external-dns (with txt-owner-id matching cluster name)

## Security Notes

1. The K3s API is exposed to the internet (port 6443)
2. OIDC authentication ensures only authorized GitHub Actions can deploy
3. Cloudflare API token has DNS edit permissions
4. Consider IP restrictions for production use
5. The RBAC binding only allows deployments from the `main` branch
