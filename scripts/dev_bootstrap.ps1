$ErrorActionPreference = 'Stop'

$venvPath = Join-Path $PSScriptRoot '..' '.venv'
if (!(Test-Path $venvPath)) {
  python -m venv $venvPath
}

& (Join-Path $venvPath 'Scripts' 'Activate.ps1')
python -m pip install --upgrade pip
Write-Host "Virtual environment ready at $venvPath"


