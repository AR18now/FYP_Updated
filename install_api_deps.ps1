# Install API dependencies using the interpreter bundled with this repo's venv.
# Use this if `pip install` fails with "Fatal error in launcher" (venv was moved/copied).
# Run from repo root:  powershell -ExecutionPolicy Bypass -File .\install_api_deps.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$venvPy = Join-Path $root ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPy)) {
    Write-Host "No .venv found. Create one with:  py -3 -m venv .venv" -ForegroundColor Yellow
    exit 1
}

Write-Host "Using: $venvPy"
& $venvPy -m pip install -U pip
& $venvPy -m pip install -r (Join-Path $root "requirements_api.txt")
Write-Host "Done. Restart api_server.py after this." -ForegroundColor Green
