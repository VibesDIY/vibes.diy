#!/bin/bash
set -e

cd "$(dirname "$0")/.."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "=================================="
echo "Tempo K3s Cluster Status Check"
echo "=================================="
echo ""

# Check if kubeconfig exists
if [ ! -f "./kubeconfig.yaml" ]; then
    echo -e "${RED}✗${NC} kubeconfig.yaml not found"
    echo "  Run: ./scripts/setup-github-secrets.sh"
    exit 1
fi

export KUBECONFIG=./kubeconfig.yaml

# Check cluster connectivity
echo "🔍 Checking cluster connectivity..."
if kubectl get nodes &> /dev/null; then
    echo -e "${GREEN}✓${NC} Cluster is reachable"
    kubectl get nodes
else
    echo -e "${RED}✗${NC} Cannot connect to cluster"
    exit 1
fi
echo ""

# Check Traefik
echo "🔍 Checking Traefik..."
if kubectl get deployment traefik -n kube-system &> /dev/null; then
    TRAEFIK_READY=$(kubectl get deployment traefik -n kube-system -o jsonpath='{.status.readyReplicas}')
    TRAEFIK_DESIRED=$(kubectl get deployment traefik -n kube-system -o jsonpath='{.spec.replicas}')
    if [ "$TRAEFIK_READY" = "$TRAEFIK_DESIRED" ]; then
        echo -e "${GREEN}✓${NC} Traefik is running ($TRAEFIK_READY/$TRAEFIK_DESIRED pods ready)"
    else
        echo -e "${YELLOW}⚠${NC} Traefik pods not ready ($TRAEFIK_READY/$TRAEFIK_DESIRED)"
    fi
else
    echo -e "${RED}✗${NC} Traefik not found"
fi
echo ""

# Check cert-manager
echo "🔍 Checking cert-manager..."
if kubectl get namespace cert-manager &> /dev/null; then
    CM_READY=$(kubectl get deployment -n cert-manager --no-headers 2>/dev/null | wc -l)
    if [ $CM_READY -ge 3 ]; then
        echo -e "${GREEN}✓${NC} cert-manager is installed"
        kubectl get pods -n cert-manager
        
        echo ""
        echo "ClusterIssuers:"
        kubectl get clusterissuer
    else
        echo -e "${YELLOW}⚠${NC} cert-manager namespace exists but deployments not found"
        echo "  Run: ./scripts/setup-k8s-addons.sh"
    fi
else
    echo -e "${RED}✗${NC} cert-manager not installed"
    echo "  Run: ./scripts/setup-k8s-addons.sh"
fi
echo ""

# Check external-dns
echo "🔍 Checking external-dns..."
if kubectl get deployment external-dns &> /dev/null; then
    EDNS_READY=$(kubectl get deployment external-dns -o jsonpath='{.status.readyReplicas}')
    EDNS_DESIRED=$(kubectl get deployment external-dns -o jsonpath='{.spec.replicas}')
    if [ "$EDNS_READY" = "$EDNS_DESIRED" ]; then
        echo -e "${GREEN}✓${NC} external-dns is running ($EDNS_READY/$EDNS_DESIRED pods ready)"
        echo ""
        echo "Recent external-dns logs:"
        kubectl logs -l app.kubernetes.io/name=external-dns --tail=5
    else
        echo -e "${YELLOW}⚠${NC} external-dns pods not ready ($EDNS_READY/$EDNS_DESIRED)"
    fi
else
    echo -e "${RED}✗${NC} external-dns not installed"
    echo "  Run: ./scripts/setup-k8s-addons.sh"
fi
echo ""

# Check for deployments in apps namespace
echo "🔍 Checking apps namespace..."
if kubectl get namespace apps &> /dev/null; then
    APPS=$(kubectl get deployments -n apps --no-headers 2>/dev/null | wc -l)
    if [ $APPS -gt 0 ]; then
        echo -e "${GREEN}✓${NC} Found $APPS deployment(s) in apps namespace"
        kubectl get all -n apps
        
        echo ""
        echo "Ingresses:"
        kubectl get ingress -n apps
        
        echo ""
        echo "Certificates:"
        kubectl get certificate -n apps
    else
        echo -e "${YELLOW}⚠${NC} No deployments in apps namespace yet"
    fi
else
    echo -e "${YELLOW}⚠${NC} apps namespace not found"
fi
echo ""

# Summary
echo "=================================="
echo "Summary"
echo "=================================="
echo ""

SERVER_IP=$(pulumi stack output serverIp 2>/dev/null || echo "N/A")
DOMAIN=$(pulumi config get domain 2>/dev/null || echo "N/A")

echo "Cluster IP: $SERVER_IP"
echo "Domain: $DOMAIN"
echo ""

# Check if all critical components are ready
CRITICAL_OK=true

if ! kubectl get deployment traefik -n kube-system &> /dev/null; then
    CRITICAL_OK=false
fi

if ! kubectl get clusterissuer letsencrypt-prod &> /dev/null; then
    CRITICAL_OK=false
fi

if ! kubectl get deployment external-dns &> /dev/null; then
    CRITICAL_OK=false
fi

if [ "$CRITICAL_OK" = true ]; then
    echo -e "${GREEN}✓${NC} All critical components are running"
    echo ""
    echo "Your cluster is ready to use!"
    echo ""
    echo "To deploy an app, create a deployment with an Ingress:"
    echo "  1. Set host: myapp.$DOMAIN"
    echo "  2. Add annotation: cert-manager.io/cluster-issuer=letsencrypt-prod"
    echo "  3. Set ingressClassName: traefik"
    echo ""
    echo "external-dns will create the DNS record automatically."
    echo "cert-manager will request a Let's Encrypt certificate automatically."
else
    echo -e "${YELLOW}⚠${NC} Some components are not ready"
    echo ""
    echo "Run: ./scripts/setup-k8s-addons.sh"
fi
