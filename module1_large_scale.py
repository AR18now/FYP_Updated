#!/usr/bin/env python3
"""
Module 1 - Large Scale Requirements Intake & Preprocessing + SRS Generation
==========================================================================

This module implements a production-ready system for:
1. Input Collection (text/audio)
2. Audio-to-Text Transcription (Whisper)
3. Preprocessing with ambiguity detection
4. IEEE 830-compliant SRS generation
5. Batch processing for large datasets

Author: Requirements Engineering System
Version: 1.0
"""

import os
import json
import logging
import asyncio
import multiprocessing
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
import pandas as pd
import numpy as np

# ML and NLP imports
import whisper
import spacy
import torch
from transformers import T5Tokenizer, T5ForConditionalGeneration
import re
from collections import defaultdict, Counter

# Audio processing
import librosa
import soundfile as sf
from pydub import AudioSegment

# Configuration
@dataclass
class Config:
    """Configuration settings for Module 1"""
    # Model settings
    whisper_model_size: str = "small"
    flan_model_name: str = "google/flan-t5-small"
    spacy_model_name: str = "en_core_web_sm"
    enable_whisper: bool = False
    
    # Processing settings
    max_workers: int = 4
    batch_size: int = 10
    max_audio_duration: int = 300  # 5 minutes
    
    # File paths
    input_dir: str = "data/input"
    output_dir: str = "data/output"
    temp_dir: str = "data/temp"
    models_dir: str = "models"
    
    # SRS settings
    srs_template_path: str = "templates/srs_template.json"
    
    # Ambiguity detection
    ambiguity_threshold: float = 0.7
    max_ambiguity_questions: int = 5

class RequirementsProcessor:
    """Main processor for requirements intake and preprocessing"""
    
    def __init__(self, config: Config):
        self.config = config
        self.logger = self._setup_logging()
        self.models = {}
        self.ambiguity_patterns = self._load_ambiguity_patterns()
        
        # Create directories
        self._create_directories()
        
        # Lazy model load: defer heavy inits until first use
        self.models_loaded = False
    
    def _setup_logging(self) -> logging.Logger:
        """Setup logging configuration"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('module1.log'),
                logging.StreamHandler()
            ]
        )
        return logging.getLogger(__name__)
    
    def _create_directories(self):
        """Create necessary directories"""
        for directory in [self.config.input_dir, self.config.output_dir, 
                         self.config.temp_dir, self.config.models_dir]:
            Path(directory).mkdir(parents=True, exist_ok=True)
    
    def _load_ambiguity_patterns(self) -> Dict[str, List[str]]:
        """Load patterns for detecting ambiguous terms"""
        return {
            'modal_verbs': ['should', 'could', 'might', 'may', 'can', 'will', 'shall'],
            'quantifiers': ['often', 'sometimes', 'usually', 'typically', 'generally', 'frequently'],
            'adjectives': ['fast', 'slow', 'large', 'small', 'many', 'few', 'several', 'multiple'],
            'quality_terms': ['easy', 'difficult', 'simple', 'complex', 'user-friendly', 'intuitive'],
            'performance_terms': ['efficient', 'effective', 'reliable', 'secure', 'stable', 'robust'],
            'time_terms': ['immediately', 'quickly', 'soon', 'eventually', 'periodically'],
            'size_terms': ['big', 'huge', 'tiny', 'massive', 'enormous', 'minimal']
        }
    
    def _load_models(self):
        """Load all required models"""
        self.logger.info("Loading models...")
        
        try:
            # Load Whisper (optional)
            if self.config.enable_whisper:
                self.logger.info("Loading Whisper model...")
                # Force CPU load to avoid meta tensor/device issues
                self.models['whisper'] = whisper.load_model(self.config.whisper_model_size, device="cpu")
            
            # Load spaCy
            self.logger.info("Loading spaCy model...")
            try:
                self.models['spacy'] = spacy.load(self.config.spacy_model_name)
            except Exception as sp_err:
                self.logger.warning(f"spaCy model '{self.config.spacy_model_name}' not found ({sp_err}); using blank 'en' pipeline")
                self.models['spacy'] = spacy.blank('en')
            # Ensure sentence boundaries to avoid E030
            if "sentencizer" not in self.models['spacy'].pipe_names:
                self.models['spacy'].add_pipe("sentencizer")
            
            # Load Flan-T5
            self.logger.info(f"Loading Flan-T5 model ({self.config.flan_model_name})...")
            try:
                self.models['flan_tokenizer'] = T5Tokenizer.from_pretrained(self.config.flan_model_name)
                # Force CPU dtype to avoid meta tensor errors
                self.models['flan_model'] = T5ForConditionalGeneration.from_pretrained(
                    self.config.flan_model_name,
                    device_map=None,
                    torch_dtype=torch.float32,
                    low_cpu_mem_usage=False
                )
            except Exception as flan_err:
                self.logger.warning(f"Flan-T5 load failed ({flan_err}); continuing without flan extraction.")
                self.models['flan_tokenizer'] = None
                self.models['flan_model'] = None
            
            self.logger.info("All models loaded successfully!")
            self.models_loaded = True
            
        except Exception as e:
            self.logger.error(f"Error loading models: {str(e)}")
            raise
    
    def process_single_requirement(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a single requirement (text or audio)
        
        Args:
            input_data: Dictionary containing 'type' ('text' or 'audio') and 'content' or 'file_path'
        
        Returns:
            Processed requirement data
        """
        try:
            if not getattr(self, 'models_loaded', False):
                self._load_models()
            # Step 1: Input Collection and Transcription
            if input_data['type'] == 'audio':
                if not self.config.enable_whisper:
                    raise RuntimeError("Audio processing disabled: enable_whisper is False in config")
                text = self._transcribe_audio(input_data['file_path'])
            else:
                text = input_data['content']
            
            # Step 2: Preprocessing
            preprocessed = self._preprocess_text(text)
            
            # Step 3: Ambiguity Detection
            ambiguities = self._detect_ambiguities(text, preprocessed)
            
            # Step 4: Field Extraction
            extracted_fields = self._extract_requirements_fields(text)
            
            # Step 5: Generate SRS sections
            srs_sections = self._generate_srs_sections(extracted_fields, text)
            
            return {
                'original_text': text,
                'preprocessed': preprocessed,
                'ambiguities': ambiguities,
                'extracted_fields': extracted_fields,
                'srs_sections': srs_sections,
                'timestamp': datetime.now().isoformat(),
                'status': 'completed'
            }
            
        except Exception as e:
            self.logger.error(f"Error processing requirement: {str(e)}")
            return {
                'error': str(e),
                'status': 'failed',
                'timestamp': datetime.now().isoformat()
            }
    
    def _transcribe_audio(self, file_path: str) -> str:
        """Transcribe audio file to text using Whisper"""
        try:
            # Ensure models are loaded and whisper is available
            if not getattr(self, 'models_loaded', False):
                self._load_models()
            if 'whisper' not in self.models:
                raise RuntimeError("Whisper model is not loaded. Ensure enable_whisper=True and whisper is installed.")

            # Basic file sanity checks
            file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
            if file_size < 4096:  # <4KB is effectively empty
                raise ValueError("Audio file is too small or empty for transcription.")

            # Check audio duration
            duration = self._get_audio_duration(file_path)
            if duration <= 0.5:
                raise ValueError("Audio is too short to transcribe. Please record at least 1 second.")
            if duration > self.config.max_audio_duration:
                self.logger.warning(f"Audio file {file_path} is {duration}s long, may take time to process")
            
            # Transcribe
            result = self.models['whisper'].transcribe(file_path)
            return result["text"].strip()
            
        except Exception as e:
            self.logger.error(f"Error transcribing audio {file_path}: {str(e)}")
            raise
    
    def _get_audio_duration(self, file_path: str) -> float:
        """Get duration of audio file in seconds"""
        try:
            audio = AudioSegment.from_file(file_path)
            return len(audio) / 1000.0
        except:
            return 0.0
    
    def _preprocess_text(self, text: str) -> Dict[str, Any]:
        """Preprocess text using spaCy"""
        doc = self.models['spacy'](text)
        
        return {
            'sentences': [sent.text.strip() for sent in doc.sents],
            'tokens': [token.text for token in doc if not token.is_space and not token.is_punct],
            'lemmas': [token.lemma_ for token in doc if not token.is_space and not token.is_punct],
            'entities': [(ent.text, ent.label_) for ent in doc.ents],
            'noun_phrases': [chunk.text for chunk in doc.noun_chunks],
            'pos_tags': [(token.text, token.pos_) for token in doc if not token.is_space]
        }
    
    def _detect_ambiguities(self, text: str, preprocessed: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Detect ambiguous terms and phrases in requirements"""
        ambiguities = []
        doc = self.models['spacy'](text)
        
        for token in doc:
            if not token.is_space and not token.is_punct:
                word = token.text.lower()
                
                # Check against ambiguity patterns
                for category, patterns in self.ambiguity_patterns.items():
                    if word in patterns:
                        # Get context
                        start = max(0, token.i - 3)
                        end = min(len(doc), token.i + 4)
                        context = doc[start:end].text
                        
                        ambiguities.append({
                            'word': token.text,
                            'category': category,
                            'context': context,
                            'position': token.i,
                            'suggestion': self._get_clarification_suggestion(word, category)
                        })
        
        return ambiguities
    
    def _get_clarification_suggestion(self, word: str, category: str) -> str:
        """Generate clarification suggestions for ambiguous terms"""
        suggestions = {
            'modal_verbs': f"Consider replacing '{word}' with specific conditions or constraints",
            'quantifiers': f"Specify frequency or occurrence rate instead of '{word}'",
            'adjectives': f"Define measurable criteria for '{word}' (e.g., 'fast' = <2 seconds)",
            'quality_terms': f"Provide specific usability metrics for '{word}'",
            'performance_terms': f"Define performance benchmarks for '{word}'",
            'time_terms': f"Specify exact timeframes instead of '{word}'",
            'size_terms': f"Define specific measurements for '{word}'"
        }
        return suggestions.get(category, f"Please clarify what you mean by '{word}'")
    
    def _extract_requirements_fields(self, text: str) -> Dict[str, str]:
        """Extract structured requirements fields using Flan-T5"""
        if not self.models.get('flan_model') or not self.models.get('flan_tokenizer'):
            self.logger.warning("Flan model unavailable; skipping field extraction.")
            return {}
        prompt = f"""
Analyze this requirements text and extract key information:

Text: {text}

Extract the following information:
1. What is the main purpose or goal of this system?
2. What is the scope or boundaries of this system?
3. What are the main functions or features mentioned?
4. What are the limitations or constraints mentioned?
5. Who are the main stakeholders or users mentioned?
6. What assumptions are being made?
7. What external dependencies are mentioned?

Provide clear, specific answers based on the text. Do not use placeholder text like "[extracted purpose]".
"""
        
        try:
            # Tokenize and generate
            inputs = self.models['flan_tokenizer'].encode(
                prompt, return_tensors="pt", max_length=512, truncation=True
            )
            
            with torch.no_grad():
                outputs = self.models['flan_model'].generate(
                    inputs,
                    max_length=512,
                    num_beams=4,
                    early_stopping=True,
                    temperature=0.7,
                    do_sample=True
                )
            
            # Decode and parse
            generated_text = self.models['flan_tokenizer'].decode(outputs[0], skip_special_tokens=True)
            return self._parse_extracted_fields(generated_text)
            
        except Exception as e:
            self.logger.error(f"Error extracting fields: {str(e)}")
            return {}
    
    def _parse_extracted_fields(self, text: str) -> Dict[str, str]:
        """Parse extracted fields from model output"""
        fields = {}
        
        # If the model returns structured format with colons
        if ':' in text:
            lines = text.strip().split('\n')
            for line in lines:
                if ':' in line:
                    key, value = line.split(':', 1)
                    key = key.strip()
                    value = value.strip()
                    # Remove placeholder text
                    if not value.startswith('[') and not value.endswith(']'):
                        fields[key] = value
        
        # If no structured format, try to extract from numbered list
        if not fields:
            lines = text.strip().split('\n')
            field_mapping = {
                '1': 'Purpose',
                '2': 'Scope', 
                '3': 'Product Functions',
                '4': 'Constraints',
                '5': 'Stakeholders',
                '6': 'Assumptions',
                '7': 'Dependencies'
            }
            
            for line in lines:
                line = line.strip()
                if line and (line.startswith('1.') or line.startswith('2.') or 
                           line.startswith('3.') or line.startswith('4.') or
                           line.startswith('5.') or line.startswith('6.') or 
                           line.startswith('7.')):
                    # Extract field number and content
                    parts = line.split('.', 1)
                    if len(parts) == 2:
                        field_num = parts[0].strip()
                        content = parts[1].strip()
                        if field_num in field_mapping and content:
                            fields[field_mapping[field_num]] = content
        
        # If still no fields, create basic extraction from original text
        if not fields:
            # Fallback: create basic fields from the original text
            fields = {
                'Purpose': 'System requirements analysis',
                'Scope': 'Requirements specification',
                'Product Functions': 'Core system functionality',
                'Constraints': 'System limitations',
                'Stakeholders': 'System users',
                'Assumptions': 'System assumptions',
                'Dependencies': 'External dependencies'
            }
        
        return fields
    
    def _generate_srs_sections(self, fields: Dict[str, str], original_text: str) -> Dict[str, Any]:
        """Generate IEEE 830-compliant SRS sections"""
        # Extract basic information from original text if fields are not properly extracted
        purpose = fields.get('Purpose', 'To be defined')
        scope = fields.get('Scope', 'To be defined')
        
        # If fields are not properly extracted, try to infer from original text
        if purpose == 'To be defined' or purpose == 'System requirements analysis':
            purpose = self._extract_purpose_from_text(original_text)
        
        if scope == 'To be defined' or scope == 'Requirements specification':
            scope = self._extract_scope_from_text(original_text)
        
        return {
            'introduction': {
                'purpose': purpose,
                'scope': scope,
                'definitions': self._extract_definitions(original_text),
                'references': [],
                'overview': 'This document specifies the requirements for the system described below.'
            },
            'overall_description': {
                'product_perspective': fields.get('Dependencies', 'To be defined'),
                'product_functions': self._extract_functions_from_text(original_text, fields.get('Product Functions')),
                'user_characteristics': self._extract_stakeholders_from_text(original_text, fields.get('Stakeholders')),
                'constraints': self._extract_constraints_from_text(original_text, fields.get('Constraints')),
                'assumptions': fields.get('Assumptions', 'To be defined')
            }
        }
    
    def _extract_purpose_from_text(self, text: str) -> str:
        """Extract purpose from original text"""
        # Look for purpose indicators
        purpose_indicators = ['must', 'should', 'need to', 'require', 'provide', 'allow', 'enable']
        sentences = text.split('.')
        
        for sentence in sentences:
            sentence = sentence.strip().lower()
            if any(indicator in sentence for indicator in purpose_indicators):
                return sentence.capitalize()
        
        return "System requirements specification and implementation"
    
    def _extract_scope_from_text(self, text: str) -> str:
        """Extract scope from original text"""
        # Look for scope indicators
        scope_indicators = ['system', 'application', 'platform', 'service', 'tool']
        sentences = text.split('.')
        
        for sentence in sentences:
            sentence = sentence.strip().lower()
            if any(indicator in sentence for indicator in scope_indicators):
                return sentence.capitalize()
        
        return "Complete system implementation and deployment"
    
    def _extract_functions_from_text(self, text: str, fallback: str = None) -> List[str]:
        """Extract product functions from original text"""
        if fallback and fallback != 'To be defined' and fallback != 'Core system functionality':
            return [fallback]
        
        functions = []
        # Look for function indicators
        function_indicators = ['provide', 'allow', 'enable', 'support', 'create', 'manage', 'track', 'update']
        
        sentences = text.split('.')
        for sentence in sentences:
            sentence = sentence.strip()
            if any(indicator in sentence.lower() for indicator in function_indicators):
                # Extract the main action
                words = sentence.split()
                for i, word in enumerate(words):
                    if word.lower() in function_indicators and i < len(words) - 1:
                        # Extract the function description
                        func_desc = ' '.join(words[i:i+5])  # Take next 5 words
                        functions.append(func_desc)
                        break
        
        return functions[:5] if functions else ['Core system functionality']
    
    def _extract_stakeholders_from_text(self, text: str, fallback: str = None) -> List[str]:
        """Extract stakeholders from original text"""
        if fallback and fallback != 'To be defined' and fallback != 'System users':
            return [fallback]
        
        stakeholders = []
        # Look for stakeholder indicators
        stakeholder_indicators = ['user', 'admin', 'trader', 'investor', 'analyst', 'customer', 'client']
        
        words = text.lower().split()
        for word in words:
            if word in stakeholder_indicators:
                stakeholders.append(word.capitalize())
        
        return list(set(stakeholders)) if stakeholders else ['System users']
    
    def _extract_constraints_from_text(self, text: str, fallback: str = None) -> List[str]:
        """Extract constraints from original text"""
        if fallback and fallback != 'To be defined' and fallback != 'System limitations':
            return [fallback]
        
        constraints = []
        # Look for constraint indicators
        constraint_indicators = ['must', 'should', 'require', 'limit', 'constraint', 'restriction']
        
        sentences = text.split('.')
        for sentence in sentences:
            sentence = sentence.strip()
            if any(indicator in sentence.lower() for indicator in constraint_indicators):
                constraints.append(sentence)
        
        return constraints[:3] if constraints else ['System performance requirements']
    
    def _extract_definitions(self, text: str) -> List[str]:
        """Extract key terms and definitions from text"""
        # Simple definition extraction - can be enhanced
        doc = self.models['spacy'](text)
        definitions = []
        
        for chunk in doc.noun_chunks:
            if len(chunk.text.split()) >= 2:  # Multi-word terms
                definitions.append(chunk.text)
        
        return list(set(definitions))[:10]  # Limit to 10 definitions
    
    def process_batch(self, input_files: List[str]) -> List[Dict[str, Any]]:
        """Process multiple requirements files in batch"""
        self.logger.info(f"Processing batch of {len(input_files)} files")
        
        results = []
        
        # Use ThreadPoolExecutor for I/O bound tasks
        with ThreadPoolExecutor(max_workers=self.config.max_workers) as executor:
            futures = []
            
            for file_path in input_files:
                # Determine input type
                if file_path.lower().endswith(('.wav', '.mp3', '.m4a', '.flac')):
                    input_data = {'type': 'audio', 'file_path': file_path}
                else:
                    # Assume text file
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    input_data = {'type': 'text', 'content': content}
                
                future = executor.submit(self.process_single_requirement, input_data)
                futures.append(future)
            
            # Collect results
            for future in futures:
                try:
                    result = future.result(timeout=300)  # 5 minute timeout
                    results.append(result)
                except Exception as e:
                    self.logger.error(f"Error in batch processing: {str(e)}")
                    results.append({'error': str(e), 'status': 'failed'})
        
        return results
    
    def save_results(self, results: List[Dict[str, Any]], output_file: str = None):
        """Save processing results to file"""
        if output_file is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = f"{self.config.output_dir}/module1_results_{timestamp}.json"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        self.logger.info(f"Results saved to {output_file}")
        return output_file

def main():
    """Main function for testing Module 1"""
    config = Config()
    processor = RequirementsProcessor(config)
    
    # Example usage
    sample_text = """
    We need to develop a comprehensive stock prediction system that can analyze 
    historical market data and provide accurate predictions for various stocks. 
    The system should be fast and user-friendly, allowing traders to make 
    informed decisions quickly. It must support multiple data sources and 
    integrate with existing trading platforms.
    """
    
    # Process single requirement
    result = processor.process_single_requirement({
        'type': 'text',
        'content': sample_text
    })
    
    print("Processing Result:")
    print(json.dumps(result, indent=2))
    
    # Save results
    processor.save_results([result])

if __name__ == "__main__":
    main()
