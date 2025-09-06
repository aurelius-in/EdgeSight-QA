$ErrorActionPreference = 'Stop'

if (-Not (Test-Path ".env")) { Copy-Item ".env.example" ".env" -ErrorAction SilentlyContinue }

$env:CAMERA_URL = $env:CAMERA_URL -as [string] -ne $null ? $env:CAMERA_URL : 'synthetic'
$env:CONF_THRESHOLD = $env:CONF_THRESHOLD -as [string] -ne $null ? $env:CONF_THRESHOLD : '0.5'

docker compose -f deploy/compose/docker-compose.yml up --build -d
Start-Sleep -Seconds 3
Invoke-WebRequest -UseBasicParsing -Method Post http://localhost:9001/start | Out-Null
Write-Host "UI: http://localhost:5173"


