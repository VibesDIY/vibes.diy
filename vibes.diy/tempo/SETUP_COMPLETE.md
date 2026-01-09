# Setup Complete

Your Tempo K3s cluster infrastructure is ready to deploy!

## What's Configured

### Infrastructure (Hetzner Cloud)

- **Location**: US West (Hillsboro - hil)
- **Server**: cpx21 (~$7/month)
- **Domain**: vibesdiy.net
- **Firewall**: SSH (22), K8s API (6443), HTTP (80), HTTPS (443)

### Kubernetes Components

- **K3s**: Lightweight Kubernetes with OIDC support
- **Traefik**: Default ingress controller (K3s built-in)
- **cert-manager**: Automatic SSL certificates from Let's Encrypt
- **external-dns**: Automatic Cloudflare DNS management

### Cloudflare Integration

- **Domain**: vibesdiy.net
- **DNS Challenge**: DNS-01 for wildcard support
- **API Token**: Configured via Pulumi secrets

### GitHub Actions OIDC

- **Issuer**: https://token.actions.githubusercontent.com
- **Audience**: https://kubernetes.default.svc.cluster.local
- **RBAC**: ClusterRole with deployment permissions
- **Binding**: Restricted to main branch of specified repo

## Configuration Files

```
tempo/
├── index.ts                    # Main Pulumi infrastructure
├── types.ts                    # TypeScript type definitions
├── Pulumi.dev.yaml            # Configuration values
├── README.md                  # Full documentation
├── QUICKSTART.md              # Quick setup guide
├── examples/
│   ├── deploy-workflow.yaml   # GitHub Actions workflow
│   └── hello-world/           # Sample K8s deployment
└── scripts/
    ├── setup-k8s-addons.sh    # Install cert-manager & external-dns
    └── setup-github-secrets.sh # Get kubeconfig & GitHub secrets
```

## Current Configuration

```yaml
Domain: vibesdiy.net
Cluster Name: tempo
Server Type: cpx21
Location: hil (US West)
GitHub Org: VibesDIY
GitHub Repo: vibes.diy
```

## Next Steps

### 1. Verify Configuration

```bash
cd /Users/menabe/Software/fproof/vibes.diy/vibes.diy/tempo
pulumi config
```

### 2. Deploy Infrastructure

```bash
pulumi up
```

### 3. Install Add-ons (if needed)

The cloud-init script should install everything automatically.
If you need to run manually:

```bash
./scripts/setup-k8s-addons.sh
```

### 4. Set up GitHub Actions

```bash
./scripts/setup-github-secrets-auto.sh
```

## How Deployments Work

When you push to GitHub:

1. **GitHub Actions** gets OIDC token from GitHub
2. **Authenticates** to K8s using OIDC token
3. **Deploys** your application using kubectl
4. **external-dns** sees the Ingress and creates DNS record
5. **cert-manager** sees TLS annotation and requests certificate
6. **Let's Encrypt** validates via Cloudflare DNS-01
7. **Traefik** serves your app with HTTPS

## Example Deployment

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

This will automatically:

- Create DNS record: myapp.vibesdiy.net → server IP
- Request SSL certificate from Let's Encrypt
- Configure Traefik to serve with HTTPS

## Verification Commands

```bash
# After deployment
SERVER_IP=$(pulumi stack output serverIp)
ssh root@$SERVER_IP

# Check cluster
kubectl get nodes

# Check Traefik
kubectl get pods -n kube-system -l app.kubernetes.io/name=traefik

# Check cert-manager
kubectl get pods -n cert-manager
kubectl get clusterissuer

# Check external-dns
kubectl get pods -l app=external-dns

# Check your deployment
kubectl get all -n apps
kubectl get ingress -n apps
kubectl get certificate -n apps
```

## Cost Breakdown

- **Hetzner cpx21**: $7.10/month
- **Traffic**: 20TB included (more than enough)
- **Cloudflare**: Free (DNS + CDN)
- **Let's Encrypt**: Free
- **Total**: ~$7/month

## Support

Check the following if you encounter issues:

1. **README.md** - Comprehensive documentation
2. **QUICKSTART.md** - Step-by-step guide
3. **Logs**: `kubectl logs -n <namespace> <pod-name>`
4. **Events**: `kubectl get events -n <namespace>`
5. **Describe**: `kubectl describe <resource> -n <namespace>`

## Cleanup

To destroy everything:

```bash
pulumi destroy
```

This will:

- Delete the Hetzner server
- Remove DNS records (with txt-owner-id=tempo)
- Clean up the network and firewall

Note: Cloudflare DNS records created by external-dns are marked with TXT records
for ownership tracking, so only records managed by this cluster will be deleted.

## References

- [K3s Documentation](https://docs.k3s.io/)
- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [cert-manager Documentation](https://cert-manager.io/docs/)
- [external-dns Documentation](https://github.com/kubernetes-sigs/external-dns)
- [Pulumi Hetzner Provider](https://www.pulumi.com/registry/packages/hcloud/)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
