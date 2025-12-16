# Hello World Example

A simple hello world application deployed to the Hetzner K3s cluster.

## What it does

- Deploys nginx with a custom HTML page
- Configures Traefik ingress at `hello.vibesdiy.net`
- Requests SSL certificate from Let's Encrypt via cert-manager
- Creates DNS record via external-dns

## Files

- `deployment.yaml` - Complete Kubernetes manifest (ConfigMap, Deployment, Service, Ingress)

## Deploy

### Via GitHub Actions

The workflow `.github/workflows/test-hetzner-cluster.yaml` automatically deploys this when:

- You push changes to `vibes.diy/tempo/examples/hello-world/**`
- You push changes to the workflow file itself
- You manually trigger it via GitHub Actions UI

### Manually via kubectl

```bash
# Get server IP
cd /Users/menabe/Software/fproof/vibes.diy/vibes.diy/tempo
SERVER_IP=$(pulumi stack output serverIp)

# SSH to the server
ssh root@$SERVER_IP

# Deploy
kubectl apply -f /path/to/deployment.yaml -n apps

# Check status
kubectl get all -n apps -l app=hello-world
kubectl get ingress hello-world -n apps
kubectl get certificate hello-world-tls -n apps
```

## Access

After deployment (wait ~2 minutes for DNS and SSL):

🌐 **https://hello.vibesdiy.net**

## What happens automatically?

1. **Deployment**: 2 replicas of nginx with custom HTML
2. **Service**: ClusterIP service exposing port 80
3. **Ingress**: Traefik routes traffic to the service
4. **external-dns**: Creates DNS A record `hello.vibesdiy.net` → your server IP
5. **cert-manager**: Requests SSL certificate via Let's Encrypt DNS-01 challenge
6. **Traefik**: Serves the app with HTTPS

## Resources

- **Memory**: 32Mi request, 64Mi limit per pod
- **CPU**: 50m request, 100m limit per pod
- **Replicas**: 2 (for high availability)

## Verify

```bash
# Check DNS
dig hello.vibesdiy.net

# Check certificate
kubectl describe certificate hello-world-tls -n apps

# Check external-dns logs
kubectl logs -l app=external-dns --tail=50 | grep hello

# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager --tail=50
```

## Cleanup

```bash
kubectl delete -f deployment.yaml -n apps
```

External-dns will automatically remove the DNS record.
