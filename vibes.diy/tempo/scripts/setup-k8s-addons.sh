#!/bin/bash
set -e

cd "$(dirname "$0")/.."

# Get server IP from Pulumi
SERVER_IP=$(pulumi stack output serverIp)
DOMAIN=$(pulumi config get domain || echo "vibesdiy.net")
CF_TOKEN=$(pulumi config get cloudflareApiToken)
CLUSTER_NAME=$(pulumi config get clusterName || echo "tempo")

echo "===================================="
echo "Setting up K8s add-ons on $SERVER_IP"
echo "Domain: $DOMAIN"
echo "Cluster: $CLUSTER_NAME"
echo "===================================="

# Create the setup script
cat > /tmp/k8s-setup.sh << 'INNEREOF'
#!/bin/bash
set -e

# Install Helm
if ! command -v helm &> /dev/null; then
    echo "Installing Helm..."
    curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
fi

# Setup KUBECONFIG
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
mkdir -p /root/.kube
cp /etc/rancher/k3s/k3s.yaml /root/.kube/config
echo 'export KUBECONFIG=/etc/rancher/k3s/k3s.yaml' >> /root/.bashrc

# Wait for K3s
echo "Waiting for K3s to be ready..."
until kubectl get nodes &> /dev/null; do 
    sleep 5
done
echo "K3s is ready!"

# Add Helm repos
echo "Adding Helm repositories..."
helm repo add jetstack https://charts.jetstack.io
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Create namespaces
kubectl create namespace cert-manager --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace apps --dry-run=client -o yaml | kubectl apply -f -

# Create Cloudflare API token secret
echo "Creating Cloudflare API token secret..."
kubectl create secret generic cloudflare-api-token-secret \
  --from-literal=api-token="CLOUDFLARE_TOKEN_PLACEHOLDER" \
  --namespace cert-manager --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic cloudflare-api-token-secret \
  --from-literal=api-token="CLOUDFLARE_TOKEN_PLACEHOLDER" \
  --namespace default --dry-run=client -o yaml | kubectl apply -f -

# Install cert-manager
echo "Installing cert-manager..."
helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --set crds.enabled=true \
  --set crds.keep=true \
  --wait \
  --timeout=10m

# Wait for cert-manager to be ready
echo "Waiting for cert-manager to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-webhook -n cert-manager
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-cainjector -n cert-manager

# Create ClusterIssuer for Let's Encrypt with Cloudflare DNS
echo "Creating Let's Encrypt ClusterIssuer..."
cat <<YAML | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: meno+CLUSTER_NAME_PLACEHOLDER@abels.name
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - dns01:
        cloudflare:
          apiTokenSecretRef:
            name: cloudflare-api-token-secret
            key: api-token
YAML

# Install external-dns using registry.k8s.io image
echo "Installing external-dns..."
cat <<YAML | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: external-dns
  namespace: default
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: external-dns
rules:
- apiGroups: [""]
  resources: ["services","endpoints","pods"]
  verbs: ["get","watch","list"]
- apiGroups: ["extensions","networking.k8s.io"]
  resources: ["ingresses"]
  verbs: ["get","watch","list"]
- apiGroups: [""]
  resources: ["nodes"]
  verbs: ["list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: external-dns-viewer
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: external-dns
subjects:
- kind: ServiceAccount
  name: external-dns
  namespace: default
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: external-dns
  namespace: default
spec:
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: external-dns
  template:
    metadata:
      labels:
        app: external-dns
    spec:
      serviceAccountName: external-dns
      containers:
      - name: external-dns
        image: registry.k8s.io/external-dns/external-dns:v0.18.0
        args:
        - --source=service
        - --source=ingress
        - --domain-filter=DOMAIN_PLACEHOLDER
        - --provider=cloudflare
        - --policy=upsert-only
        - --registry=txt
        - --txt-owner-id=CLUSTER_NAME_PLACEHOLDER
        - --txt-prefix=_
        - --interval=1m
        - --log-level=info
        env:
        - name: CF_API_TOKEN
          valueFrom:
            secretKeyRef:
              name: cloudflare-api-token-secret
              key: api-token
YAML

echo ""
echo "===================================="
echo "✅ Add-ons installation complete!"
echo "===================================="
echo ""
echo "Installed components:"
echo "  - Traefik (K3s default ingress)"
echo "  - cert-manager with Let's Encrypt"
echo "  - external-dns with Cloudflare"
echo ""
echo "ClusterIssuer: letsencrypt-prod"
echo "Domain: DOMAIN_PLACEHOLDER"
echo "TXT Owner ID: CLUSTER_NAME_PLACEHOLDER"
echo ""
echo "Test with:"
echo "  kubectl get clusterissuer"
echo "  kubectl get pods -n cert-manager"
echo "  kubectl get pods -n default -l app=external-dns"
echo ""
INNEREOF

# Replace placeholders
sed -i.bak "s/CLOUDFLARE_TOKEN_PLACEHOLDER/$CF_TOKEN/g" /tmp/k8s-setup.sh
sed -i.bak "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /tmp/k8s-setup.sh
sed -i.bak "s/CLUSTER_NAME_PLACEHOLDER/$CLUSTER_NAME/g" /tmp/k8s-setup.sh
rm /tmp/k8s-setup.sh.bak 2>/dev/null || true

# Copy script to server and execute
echo "Copying setup script to server..."
scp -o StrictHostKeyChecking=no /tmp/k8s-setup.sh root@$SERVER_IP:/tmp/k8s-setup.sh

echo "Executing setup script..."
ssh -o StrictHostKeyChecking=no root@$SERVER_IP "bash /tmp/k8s-setup.sh"

echo ""
echo "✅ Setup complete!"
