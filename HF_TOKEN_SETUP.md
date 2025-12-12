# Hugging Face API Token Setup Guide

This guide explains how to set up your Hugging Face API token for the SRS Model Generator.

## Quick Setup

### Option 1: Environment Variable (Recommended)

**Windows (PowerShell):**
```powershell
$env:HF_API_TOKEN="your_token_here"
```

**Windows (Command Prompt):**
```cmd
set HF_API_TOKEN=your_token_here
```

**Linux/Mac:**
```bash
export HF_API_TOKEN="your_token_here"
```

### Option 2: .env File (Requires python-dotenv)

1. Install python-dotenv:
   ```bash
   pip install python-dotenv
   ```

2. Create a `.env` file in the project root:
   ```
   HF_API_TOKEN=your_token_here
   HF_MODEL_NAME=arar123/qwen2b-srs-finetuned
   ```

3. The code will automatically load it when you run the script.

## Getting Your Token

1. Go to [Hugging Face Settings → Tokens](https://huggingface.co/settings/tokens)
2. Click **"New token"**
3. Give it a name (e.g., "SRS Generator")
4. Select **"Read"** permissions (this is sufficient for inference)
5. Click **"Generate token"**
6. **Copy the token immediately** (you won't be able to see it again)
7. Paste it in your environment variable or .env file

## Token Format

Your token should start with `hf_` followed by a long string of characters (do not share the full token publicly).

## Verification

To verify your token is working, you can test it:

```python
from srs_model_generator import SRSModelGenerator

generator = SRSModelGenerator()
if generator.validate_token():
    print("Token is valid!")
else:
    print("Token validation failed. Please check your token.")
```

## Troubleshooting

### Error: "HF_API_TOKEN environment variable is required"
- Make sure you've set the environment variable before running the script
- On Windows, set it in the same terminal session where you run the script
- For permanent setup, add it to your system environment variables

### Error: "Authentication failed (401)"
- Your token may be invalid or expired
- Generate a new token from Hugging Face settings
- Make sure you copied the entire token (it's very long)

### Error: "Access forbidden (403)"
- Your token doesn't have access to the model
- Make sure the model is public or you've been granted access
- Verify your token has "Read" permissions

### Error: "Model not found (404)"
- Check that the model name is correct: `arar123/qwen2b-srs-finetuned`
- Verify the model exists at: https://huggingface.co/arar123/qwen2b-srs-finetuned
- Make sure the model has Inference API enabled in its settings

## Security Notes

⚠️ **IMPORTANT:**
- Never commit your actual token to version control
- Never share your token publicly
- If your token is exposed, revoke it immediately and create a new one
- Use environment variables or .env files (and add .env to .gitignore)

## Additional Configuration

You can also set these optional environment variables:

- `HF_MODEL_NAME`: Override the default model (default: `arar123/qwen2b-srs-finetuned`)
- `HF_VALIDATE_TOKEN`: Set to `true` to validate token on initialization (default: `false`)

Example:
```bash
export HF_MODEL_NAME="your-model-name"
export HF_VALIDATE_TOKEN="true"
```

