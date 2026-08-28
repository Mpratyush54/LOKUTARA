#!/bin/bash

# Configuration
SERVER_IP=$1
USERNAME=${2:-root} # Try to connect as root, or change to ubuntu

if [ -z "$SERVER_IP" ]; then
    echo "Usage: ./setup_monitoring.sh <server_ip> [username]"
    exit 1
fi

echo "Connecting to $SERVER_IP as $USERNAME to install Grafana & Monitoring Stack..."

ssh -o StrictHostKeyChecking=accept-new "$USERNAME@$SERVER_IP" << 'EOF'
    echo -e "\n=========================================="
    echo "      STARTING MONITORING SETUP (K8S)     "
    echo "=========================================="
    
    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null && ! command -v k3s &> /dev/null; then
        echo "[-] Kubernetes not detected! Please ensure k3s or kubectl is installed before setting up Grafana."
        exit 1
    fi
    
    export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

    # 1. Install Helm if not installed
    if ! command -v helm &> /dev/null; then
        echo "[+] Installing Helm..."
        curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
        chmod 700 get_helm.sh
        ./get_helm.sh
        rm get_helm.sh
    else
        echo "[+] Helm is already installed."
    fi

    echo "[+] Adding Helm repositories for Prometheus, Grafana, and Loki..."
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update

    echo "[+] Creating monitoring namespace..."
    kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

    echo "[+] Installing Kube-Prometheus-Stack (Grafana + Prometheus)..."
    # This chart installs Prometheus Operator, Prometheus, and Grafana
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --set grafana.adminPassword=admin
        
    echo "[+] Installing Loki Stack (for Log Aggregation)..."
    # Promtail will ship pod logs to Loki, which Grafana can view
    helm upgrade --install loki grafana/loki-stack \
        --namespace monitoring \
        --set grafana.enabled=false \
        --set promtail.enabled=true

    echo -e "\n=========================================="
    echo "      MONITORING STACK DEPLOYED!          "
    echo "=========================================="
    echo "Here is how to access your Grafana dashboard:"
    echo "1. On your LOCAL machine, forward the port by running:"
    echo "   ssh -L 3000:localhost:3000 $USERNAME@$SERVER_IP"
    echo "   (And inside the server run: kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80)"
    echo "2. Open your browser to: http://localhost:3000"
    echo "3. Login Username: admin"
    echo "4. Login Password: admin"
    echo "=========================================="
    
    # List the status of the monitoring pods
    kubectl get pods -n monitoring
EOF
