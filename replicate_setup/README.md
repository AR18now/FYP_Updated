# Replicate Setup Guide

This directory contains files needed to push your model to Replicate.com

## Files:
- `cog.yaml` - Configuration file for Replicate
- `predict.py` - Model prediction code
- `push_to_replicate.ps1` - PowerShell script to push the model

## Quick Start:

### 1. Install Cog

**Option A: Using WSL (Recommended for Windows)**
```bash
# In WSL/Ubuntu terminal:
curl -o /usr/local/bin/cog -L https://github.com/replicate/cog/releases/latest/download/cog_linux_x86_64
sudo chmod +x /usr/local/bin/cog
```

**Option B: Download Windows Binary**
1. Go to: https://github.com/replicate/cog/releases
2. Download `cog_windows_x86_64.exe`
3. Rename to `cog.exe`
4. Add to your PATH or place in this directory

### 2. Login to Replicate

```bash
cog login
# Enter your Replicate API token from: https://replicate.com/account/api-tokens
```

### 3. Set Environment Variables (if needed)

If your model requires a Hugging Face token:
- Go to your Replicate model settings
- Add environment variable: `HF_API_TOKEN` with your token value

### 4. Push the Model

```bash
# Navigate to this directory
cd replicate_setup

# Push to Replicate
cog push r8.im/ar18now/qwen
```

This will:
1. Build your model container
2. Upload it to Replicate
3. Make it available at: https://replicate.com/ar18now/qwen

## After Pushing:

1. Test in Playground: https://replicate.com/ar18now/qwen
2. Get your API token: https://replicate.com/account/api-tokens
3. Update `srs_model_generator.py` to use Replicate API

## Troubleshooting:

- **Cog not found**: Make sure cog is in your PATH or use full path
- **Build fails**: Check that all dependencies are in `cog.yaml`
- **Model not loading**: Verify HF_API_TOKEN is set in Replicate settings
- **Permission errors**: Make sure you're logged in with `cog login`

