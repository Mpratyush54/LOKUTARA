param(
  [string]$Root = (Split-Path -Parent $MyInvocation.MyCommand.Definition)
)

$PROM_VERSION = "2.44.0"
$GRAF_VERSION = "10.2.3"

$PROM_DIR = Join-Path $Root "prometheus"
$GRAF_DIR = Join-Path $Root "grafana"

New-Item -ItemType Directory -Force -Path $PROM_DIR, $GRAF_DIR | Out-Null

# ---------- Download Prometheus Windows zip ----------
$promZip = "prometheus-$PROM_VERSION.windows-amd64.zip"
$promUrl = "https://github.com/prometheus/prometheus/releases/download/v$PROM_VERSION/$promZip"
$promZipPath = Join-Path $PROM_DIR $promZip

if (-not (Test-Path $promZipPath)) {
    Write-Host "Downloading Prometheus $PROM_VERSION..."
    Invoke-WebRequest -Uri $promUrl -OutFile $promZipPath
}

Write-Host "Extracting Prometheus..."
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($promZipPath, $PROM_DIR)

# Prometheus zip includes folder, move contents up
$folder = Get-ChildItem $PROM_DIR | Where-Object { $_.PSIsContainer } | Select-Object -First 1
Move-Item -Path (Join-Path $folder.FullName '*') -Destination $PROM_DIR -Force
Remove-Item $folder.FullName -Recurse -Force

# ---------- Download Grafana Windows zip ----------
$grafZip = "grafana-$GRAF_VERSION.windows-amd64.zip"
$grafUrl = "https://dl.grafana.com/oss/release/$grafZip"
$grafZipPath = Join-Path $GRAF_DIR $grafZip

if (-not (Test-Path $grafZipPath)) {
    Write-Host "Downloading Grafana $GRAF_VERSION..."
    Invoke-WebRequest -Uri $grafUrl -OutFile $grafZipPath
}

Write-Host "Extracting Grafana..."
[System.IO.Compression.ZipFile]::ExtractToDirectory($grafZipPath, $GRAF_DIR)

# Move contents up
$folder = Get-ChildItem $GRAF_DIR | Where-Object { $_.PSIsContainer } | Select-Object -First 1
Move-Item -Path (Join-Path $folder.FullName '*') -Destination $GRAF_DIR -Force
Remove-Item $folder.FullName -Recurse -Force

# Copy provisioning files (if provided in repo)
$scriptDir = $Root
if (Test-Path (Join-Path $scriptDir "prometheus.yml")) {
    Copy-Item (Join-Path $scriptDir "prometheus.yml") -Destination $Root -Force
}
if (Test-Path (Join-Path $scriptDir "grafana")) {
    Copy-Item (Join-Path $scriptDir "grafana\provisioning\*") -Destination (Join-Path $GRAF_DIR "conf\provisioning") -Recurse -Force
    Copy-Item (Join-Path $scriptDir "grafana\dashboards\*") -Destination (Join-Path $GRAF_DIR "dashboards") -Recurse -Force
}

Write-Host "Installation finished. To start:"
Write-Host "  Start Prometheus: $PROM_DIR\prometheus.exe --config.file=""$Root\prometheus.yml"""
Write-Host "  Start Grafana: $GRAF_DIR\bin\grafana-server.exe --homepath $GRAF_DIR"
Write-Host "  Or install PM2 (npm i -g pm2) and use ecosystem.config.js to start all services."
