import * as pulumi from "@pulumi/pulumi";
import * as hcloud from "@pulumi/hcloud";

// Configuration
const config = new pulumi.Config();
const sshKeyName = config.get("sshKeyName") || "default";
const serverType = config.get("serverType") || "cpx21";
const location = config.get("location") || "hil";
const ghOrg = config.require("githubOrg");
const ghRepo = config.require("githubRepo");
const domain = config.get("domain") || "vibesdiy.net";
const cloudflareApiToken = config.requireSecret("cloudflareApiToken");
const clusterName = config.get("clusterName") || "tempo";

// Network configuration
const network = new hcloud.Network("k3s-network", {
    ipRange: "10.0.0.0/16",
});

const subnet = new hcloud.NetworkSubnet("k3s-subnet", {
    networkId: network.id.apply(id => parseInt(id)),
    type: "cloud",
    networkZone: "us-west",
    ipRange: "10.0.1.0/24",
});

// Firewall rules
const firewall = new hcloud.Firewall("k3s-firewall", {
    rules: [
        {
            direction: "in",
            protocol: "tcp",
            port: "22",
            sourceIps: ["0.0.0.0/0", "::/0"],
        },
        {
            direction: "in",
            protocol: "tcp",
            port: "6443",
            sourceIps: ["0.0.0.0/0", "::/0"],
        },
        {
            direction: "in",
            protocol: "tcp",
            port: "80",
            sourceIps: ["0.0.0.0/0", "::/0"],
        },
        {
            direction: "in",
            protocol: "tcp",
            port: "443",
            sourceIps: ["0.0.0.0/0", "::/0"],
        },
    ],
});

// Complete K3s installation script with all add-ons
const k3sInstallScript = pulumi.interpolate`#!/bin/bash
set -e

# Install K3s with OIDC configuration
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="server \
  --write-kubeconfig-mode=644 \
  --kube-apiserver-arg=oidc-issuer-url=https://token.actions.githubusercontent.com \
  --kube-apiserver-arg=oidc-client-id=https://kubernetes.default.svc.cluster.local \
  --kube-apiserver-arg=oidc-username-claim=sub \
  --kube-apiserver-arg=oidc-username-prefix=github: \
  --kube-apiserver-arg=oidc-groups-claim=repository" sh -

# Setup KUBECONFIG for root user
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
mkdir -p /root/.kube
cp /etc/rancher/k3s/k3s.yaml /root/.kube/config
echo 'export KUBECONFIG=/etc/rancher/k3s/k3s.yaml' >> /root/.bashrc

# Wait for K3s to be ready
until kubectl get nodes; do
  echo "Waiting for K3s..."
  sleep 5
done

# Wait for Traefik to be ready
until kubectl get deployment traefik -n kube-system; do
  echo "Waiting for Traefik..."
  sleep 5
done

# Create namespaces
kubectl create namespace apps || true
kubectl create namespace cert-manager || true

# Create RBAC for GitHub Actions
cat <<YAML | kubectl apply -f -
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: github-actions-deployer
rules:
  - apiGroups: ["", "apps", "networking.k8s.io", "traefik.io"]
    resources: ["deployments", "services", "configmaps", "secrets", "ingresses", "ingressroutes", "middlewares", "pods", "replicationcontrollers", "replicasets", "daemonsets", "statefulsets"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: ["autoscaling"]
    resources: ["horizontalpodautoscalers"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: ["batch"]
    resources: ["cronjobs", "jobs"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: [""]
    resources: ["namespaces"]
    verbs: ["get", "list", "create", "update", "patch"]
  - apiGroups: [""]
    resources: ["nodes"]
    verbs: ["get", "list"]
  - apiGroups: ["apps"]
    resources: ["deployments/status"]
    verbs: ["get", "watch"]
  - apiGroups: ["cert-manager.io"]
    resources: ["certificates", "certificaterequests", "issuers", "clusterissuers"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: github-actions-deployer
subjects:
  - kind: User
    name: "github:repo:${ghOrg}/${ghRepo}:ref:refs/heads/main"
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: github-actions-deployer
  apiGroup: rbac.authorization.k8s.io
YAML

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Add Helm repos
helm repo add jetstack https://charts.jetstack.io
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Create Cloudflare API token secrets
kubectl create secret generic cloudflare-api-token-secret \
  --from-literal=api-token="${cloudflareApiToken}" \
  --namespace cert-manager

kubectl create secret generic cloudflare-api-token-secret \
  --from-literal=api-token="${cloudflareApiToken}" \
  --namespace default

# Install cert-manager
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --set crds.enabled=true \
  --set crds.keep=true \
  --wait \
  --timeout=10m

# Wait for cert-manager to be ready
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-webhook -n cert-manager
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-cainjector -n cert-manager

# Create ClusterIssuer for Let's Encrypt
cat <<YAML | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: meno+${clusterName}@abels.name
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - dns01:
        cloudflare:
          apiTokenSecretRef:
            name: cloudflare-api-token-secret
            key: api-token
YAML

# Install external-dns using registry.k8s.io image (matching mam-hh-dns1)
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
  - apiGroups: ["", "apps", "networking.k8s.io", "traefik.io"]
    resources: ["deployments", "services", "configmaps", "secrets", "ingresses", "ingressroutes", "middlewares", "pods", "replicationcontrollers", "replicasets", "daemonsets", "statefulsets"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: ["autoscaling"]
    resources: ["horizontalpodautoscalers"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: ["batch"]
    resources: ["cronjobs", "jobs"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: [""]
    resources: ["namespaces"]
    verbs: ["get", "list", "create", "update", "patch"]
  - apiGroups: [""]
    resources: ["nodes"]
    verbs: ["get", "list"]
  - apiGroups: ["apps"]
    resources: ["deployments/status"]
    verbs: ["get", "watch"]
  - apiGroups: ["cert-manager.io"]
    resources: ["certificates", "certificaterequests", "issuers", "clusterissuers"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
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
        - --domain-filter=${domain}
        - --provider=cloudflare
        - --policy=upsert-only
        - --registry=txt
        - --txt-owner-id=${clusterName}
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

echo "===================================="
echo "✅ K3s cluster setup complete!"
echo "===================================="
echo "Installed:"
echo "  - K3s with OIDC authentication"
echo "  - Traefik ingress controller"
echo "  - cert-manager with Let's Encrypt"
echo "  - external-dns with Cloudflare"
echo ""
echo "Domain: ${domain}"
echo "Cluster: ${clusterName}"
`;

// K3s server
const server = new hcloud.Server("k3s-server", {
    serverType: serverType,
    image: "ubuntu-22.04",
    location: location,
    sshKeys: [sshKeyName],
    networks: [{
        networkId: network.id.apply(id => parseInt(id)),
    }],
    firewallIds: [firewall.id.apply(id => parseInt(id))],
    userData: k3sInstallScript,
    publicNets: [{
        ipv4Enabled: true,
        ipv6Enabled: true,
    }],
}, { dependsOn: [subnet] });

// Exports
export const serverIp = server.ipv4Address;
export const serverIpv6 = server.ipv6Address;
export const apiServer = pulumi.interpolate`https://${server.ipv4Address}:6443`;
export const domainName = domain;
export const clusterNameOutput = clusterName;
export const setupInstructions = pulumi.interpolate`
Cluster is being set up automatically via cloud-init.

Wait ~5 minutes for complete installation, then:

ssh root@${server.ipv4Address}

Check status:
  kubectl get nodes
  kubectl get pods -A
  kubectl get clusterissuer
`;
