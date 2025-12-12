#!/usr/bin/env python3
"""
Test script to check Hugging Face model availability and find working models.
"""

import os
import requests
import sys
from typing import List, Tuple

def check_model(model_name: str, token: str) -> Tuple[bool, str]:
    """Check if a model exists and is accessible."""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        
        # Check if model exists
        model_url = f"https://huggingface.co/api/models/{model_name}"
        response = requests.get(model_url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            # Try to check inference API
            inference_url = f"https://api-inference.huggingface.co/models/{model_name}"
            inf_response = requests.get(inference_url, headers=headers, timeout=10)
            
            if inf_response.status_code in [200, 503]:  # 503 means model is loading
                return True, "✓ Model exists and Inference API is available"
            else:
                return True, f"⚠ Model exists but Inference API may not be enabled (status: {inf_response.status_code})"
        elif response.status_code == 404:
            return False, "✗ Model not found"
        elif response.status_code == 401:
            return False, "✗ Authentication failed - check your token"
        else:
            return False, f"✗ Unexpected status: {response.status_code}"
    except Exception as e:
        return False, f"✗ Error: {e}"

def test_inference(model_name: str, token: str) -> Tuple[bool, str]:
    """Test if we can actually call the inference API."""
    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "inputs": "Test prompt",
            "parameters": {
                "max_new_tokens": 10,
                "return_full_text": False,
            },
            "options": {
                "wait_for_model": True,
            }
        }
        
        # Try router endpoint first (newer)
        url = f"https://router.huggingface.co/models/{model_name}"
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            return True, "✓ Inference API works!"
        elif response.status_code == 503:
            return True, "⚠ Model is loading (this is normal for first request)"
        elif response.status_code == 404:
            return False, "✗ Model not found on Inference API"
        elif response.status_code == 401:
            return False, "✗ Authentication failed"
        else:
            return False, f"✗ Status {response.status_code}: {response.text[:200]}"
    except Exception as e:
        return False, f"✗ Error: {e}"

def main():
    token = os.getenv("HF_API_TOKEN", "")
    if not token:
        print("ERROR: HF_API_TOKEN environment variable not set!")
        print("Set it with: $env:HF_API_TOKEN='your_token_here' (PowerShell)")
        sys.exit(1)
    
    print("=" * 70)
    print("Hugging Face Model Tester")
    print("=" * 70)
    print(f"Token: {token[:7]}...{token[-4:]}\n")
    
    # Test the current model
    current_model = os.getenv("HF_MODEL_NAME", "arar123/qwen2b-srs-finetuned")
    print(f"Testing current model: {current_model}")
    print("-" * 70)
    exists, msg = check_model(current_model, token)
    print(f"Existence check: {msg}")
    
    if exists:
        works, inf_msg = test_inference(current_model, token)
        print(f"Inference test: {inf_msg}")
    else:
        print("\n⚠ Model doesn't exist. Trying alternative models...\n")
    
    # Test alternative models
    alternative_models = [
        "Qwen/Qwen2.5-0.5B-Instruct",
        "Qwen/Qwen2.5-1.5B-Instruct", 
        "Qwen/Qwen2.5-3B-Instruct",
        "mistralai/Mistral-7B-Instruct-v0.2",
        "google/flan-t5-base",
        "microsoft/DialoGPT-medium",
    ]
    
    print("\n" + "=" * 70)
    print("Testing Alternative Models")
    print("=" * 70)
    
    working_models = []
    for model in alternative_models:
        print(f"\nTesting: {model}")
        exists, msg = check_model(model, token)
        print(f"  {msg}")
        
        if exists:
            works, inf_msg = test_inference(model, token)
            print(f"  Inference: {inf_msg}")
            if "✓" in inf_msg or "⚠" in inf_msg:
                working_models.append(model)
    
    print("\n" + "=" * 70)
    print("Summary")
    print("=" * 70)
    
    if working_models:
        print("\n✓ Working models found:")
        for model in working_models:
            print(f"  - {model}")
        print(f"\nTo use one of these, set:")
        print(f"  $env:HF_MODEL_NAME='{working_models[0]}'")
    else:
        print("\n✗ No working models found. Please check:")
        print("  1. Your token is valid")
        print("  2. Your token has 'Read' permissions")
        print("  3. You have internet connection")
        print("  4. Try a different model name")

if __name__ == "__main__":
    main()

