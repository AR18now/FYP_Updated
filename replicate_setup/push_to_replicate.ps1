# PowerShell script to push model to Replicate
# Run this script from PowerShell: .\push_to_replicate.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Replicate Model Push Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if cog is installed
Write-Host "Checking for Cog..." -ForegroundColor Yellow
$cogPath = Get-Command cog -ErrorAction SilentlyContinue

if (-not $cogPath) {
    Write-Host "ERROR: Cog is not installed or not in PATH!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Cog first:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://github.com/replicate/cog/releases" -ForegroundColor White
    Write-Host "2. Or use WSL and run: curl -o /usr/local/bin/cog -L https://github.com/replicate/cog/releases/latest/download/cog_linux_x86_64" -ForegroundColor White
    Write-Host "3. Add cog to your PATH" -ForegroundColor White
    exit 1
}

Write-Host "✓ Cog found at: $($cogPath.Source)" -ForegroundColor Green
Write-Host ""

# Check if logged in
Write-Host "Checking Replicate login status..." -ForegroundColor Yellow
$loginCheck = cog whoami 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in. Please login first:" -ForegroundColor Yellow
    Write-Host "  cog login" -ForegroundColor White
    Write-Host ""
    Write-Host "You can get your API token from: https://replicate.com/account/api-tokens" -ForegroundColor White
    exit 1
}

Write-Host "✓ Logged in as: $loginCheck" -ForegroundColor Green
Write-Host ""

# Confirm push
Write-Host "Ready to push model to: r8.im/ar18now/qwen" -ForegroundColor Cyan
$confirm = Read-Host "Continue? (y/n)"

if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Pushing model to Replicate..." -ForegroundColor Yellow
Write-Host "This may take several minutes..." -ForegroundColor Yellow
Write-Host ""

# Push the model
cog push r8.im/ar18now/qwen

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✓ Model pushed successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your model is now available at:" -ForegroundColor Cyan
    Write-Host "  https://replicate.com/ar18now/qwen" -ForegroundColor White
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Test it in the Playground" -ForegroundColor White
    Write-Host "2. Get your API token: https://replicate.com/account/api-tokens" -ForegroundColor White
    Write-Host "3. Update srs_model_generator.py to use Replicate API" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "✗ Push failed!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Check the error messages above for details." -ForegroundColor Yellow
    exit 1
}

