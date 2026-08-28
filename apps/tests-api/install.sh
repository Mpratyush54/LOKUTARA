#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PROM_DIR="$ROOT/prometheus"
GRAF_DIR="$ROOT/grafana"
PROM_VERSION="2.44.0"
GRAF_VERSION="10.2.3"

echo "Root: $ROOT"
mkdir -p "$PROM_DIR" "$GRAF_DIR"

# ---------- Download Prometheus (linux/macos) ----------
echo "Downloading Prometheus $PROM_VERSION..."
ARCH="$(uname -m)"
if [[ "$ARCH" == "x86_64" ]]; then
  PROM_ARCH="linux-amd64"
else
  PROM_ARCH="linux-amd64"
fi

PROM_TAR="prometheus-${PROM_VERSION}.${PROM_ARCH}.tar.gz"
PROM_URL="https://github.com/prometheus/prometheus/releases/download/v${PROM_VERSION}/${PROM_TAR}"

cd "$PROM_DIR"
if [ ! -f "$PROM_TAR" ]; then
  curl -L -o "$PROM_TAR" "$PROM_URL"
fi
tar -xzf "$PROM_TAR" --strip-components=1
chmod +x prometheus promtool || true
echo "Prometheus installed to $PROM_DIR"

# ---------- Download Grafana (linux/macos) ----------
echo "Downloading Grafana $GRAF_VERSION..."
GRAF_TGZ="grafana-${GRAF_VERSION}.linux-amd64.tar.gz"
GRAF_URL="https://dl.grafana.com/oss/release/${GRAF_TGZ}"

cd "$GRAF_DIR"
if [ ! -f "$GRAF_TGZ" ]; then
  curl -L -o "$GRAF_TGZ" "$GRAF_URL"
fi
tar -xzf "$GRAF_TGZ" --strip-components=1
chmod +x bin/grafana-server || true
echo "Grafana installed to $GRAF_DIR"

# ---------- Copy prometheus.yml if missing ----------
cd "$ROOT"
if [ ! -f "prometheus.yml" ]; then
  cp -n ./prometheus.yml .
fi

# ---------- Grafana provisioning & dashboard ----------
mkdir -p "$GRAF_DIR"/conf/provisioning/datasources
mkdir -p "$GRAF_DIR"/conf/provisioning/dashboards
mkdir -p "$GRAF_DIR"/dashboards
cp -n ./grafana/provisioning/datasources/datasource.yml "$GRAF_DIR/conf/provisioning/datasources/" || true
cp -n ./grafana/provisioning/dashboards/dashboard.yml "$GRAF_DIR/conf/provisioning/dashboards/" || true
cp -n ./grafana/dashboards/psych-dashboard.json "$GRAF_DIR/dashboards/" || true

echo "Provisioning files copied."

# ---------- Start everything using pm2 (if pm2 installed) ----------
if command -v pm2 >/dev/null 2>&1; then
  echo "PM2 found. Starting services with PM2..."
  pm2 start ecosystem.config.js --env production || true
  pm2 save || true
  echo "Services started via PM2. Use 'pm2 logs' to view logs."
else
  echo "PM2 not found. You can install it with: npm i -g pm2"
  echo "To start services manually:"
  echo "  $PROM_DIR/prometheus --config.file=$ROOT/prometheus.yml &"
  echo "  $GRAF_DIR/bin/grafana-server --homepath $GRAF_DIR &"
fi

echo "Installation complete. Prometheus UI: http://localhost:9090 | Grafana UI: http://localhost:3000 (default admin:admin)"
