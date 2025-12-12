"""
Replicate Predictor for Qwen SRS Model
This file defines how your model runs on Replicate
"""

from cog import BasePredictor, Input
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
import torch
import os

class Predictor(BasePredictor):
    def setup(self):
        """Load the model into memory - this runs once when the model starts"""
        print("Loading model...")
        
        # Your model name
        model_name = os.getenv("HF_MODEL_NAME", "arar123/qwen2b-srs-finetuned")
        
        # Get Hugging Face token (set as environment variable in Replicate)
        hf_token = os.getenv("HF_API_TOKEN", "").strip()
        if not hf_token:
            raise RuntimeError("HF_API_TOKEN is required; set it as an environment variable in Render/Replicate.")
        
        try:
            # Load tokenizer with fallback options
            print(f"Loading tokenizer from {model_name}...")
            try:
                # Try fast tokenizer first
                self.tokenizer = AutoTokenizer.from_pretrained(
                    model_name,
                    token=hf_token if hf_token else None,
                    use_fast=True,
                    trust_remote_code=True
                )
            except Exception as e:
                print(f"Fast tokenizer failed: {e}, trying slow tokenizer...")
                # Fallback to slow tokenizer
                self.tokenizer = AutoTokenizer.from_pretrained(
                    model_name,
                    token=hf_token if hf_token else None,
                    use_fast=False,
                    trust_remote_code=True
                )
            
            print("Tokenizer loaded successfully!")
            
            # Load model
            print(f"Loading model from {model_name}...")
            self.model = AutoModelForCausalLM.from_pretrained(
                model_name,
                token=hf_token if hf_token else None,
                torch_dtype=torch.float16,
                device_map="auto",
                trust_remote_code=True
            )
            print("Model loaded successfully!")
            
            # Create pipeline
            self.pipeline = pipeline(
                "text-generation",
                model=self.model,
                tokenizer=self.tokenizer,
                device_map="auto"
            )
            
            print("Model loaded successfully!")
        except Exception as e:
            print(f"Failed to load model: {e}")
            raise
    
    def predict(
        self,
        prompt: str = Input(description="Input prompt for SRS generation"),
        max_new_tokens: int = Input(default=2000, description="Maximum number of tokens to generate", ge=1, le=4096),
        temperature: float = Input(default=0.4, description="Sampling temperature (0.0-2.0)", ge=0.0, le=2.0),
        top_p: float = Input(default=0.9, description="Top-p sampling (0.0-1.0)", ge=0.0, le=1.0),
        repetition_penalty: float = Input(default=1.05, description="Repetition penalty (1.0-2.0)", ge=1.0, le=2.0)
    ) -> str:
        """
        Run a single prediction on the model
        This is called each time someone uses your model
        """
        try:
            result = self.pipeline(
                prompt,
                max_new_tokens=max_new_tokens,
                temperature=temperature,
                top_p=top_p,
                repetition_penalty=repetition_penalty,
                return_full_text=False,  # Only return generated text, not the prompt
                do_sample=True,
            )
            
            # Extract generated text from result
            if isinstance(result, list) and len(result) > 0:
                generated_text = result[0].get("generated_text", "")
            elif isinstance(result, dict):
                generated_text = result.get("generated_text", "")
            else:
                generated_text = str(result)
            
            return generated_text.strip()
            
        except Exception as e:
            print(f"Prediction error: {e}")
            raise Exception(f"Text generation failed: {e}")

