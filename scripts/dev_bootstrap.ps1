$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$venvPath = Join-Path $repoRoot '.venv'

if (!(Test-Path $venvPath)) {
  $python = if (Get-Command py -ErrorAction SilentlyContinue) { 'py -3' } elseif (Get-Command python -ErrorAction SilentlyContinue) { 'python' } else { $null }
  if (-not $python) { throw 'Python not found. Install Python 3.x and re-run.' }
  iex "$python -m venv `"$venvPath`""
}

$venvPython = Join-Path $venvPath 'Scripts/python.exe'
& $venvPython -m pip install --upgrade pip | Out-Null
Write-Host "Virtual environment ready at $venvPath"
Write-Host "To activate: `"$venvPath\Scripts\Activate.ps1`""


