#!/usr/bin/env python3
"""
Flask API Backend for Requirements Engineering System
====================================================

This module provides REST API endpoints for the React frontend to interact
with the requirements processing system.
"""

from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import json
import os
import tempfile
from datetime import datetime
from pathlib import Path
import logging
import re

# Import our existing modules
from main_orchestrator import RequirementsOrchestrator
from srs_generator import SRSGenerator
from json_to_srs_pdf import load_srs_from_json, render_html, save_pdf_or_html
from srs_model_generator import SRSModelGenerator

app = Flask(__name__)

# CORS configuration
# In production, restrict to specific origins for security
allowed_origins = os.environ.get('ALLOWED_ORIGINS', '*').split(',')
if allowed_origins == ['*']:
    CORS(app)  # Allow all origins (development)
else:
    CORS(app, origins=allowed_origins)  # Restrict to specific origins (production)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize orchestrator
orchestrator = RequirementsOrchestrator()
# Ensure audio transcription is enabled for the API unless explicitly disabled elsewhere
try:
    orchestrator.processor.config.enable_whisper = True
except Exception:
    pass

# Helper: serialize SRS object to dict with hallucination analysis if present
def serialize_srs(srs):
    raw_text = getattr(srs, 'raw_text', None) or srs.sections.get('_raw_text')
    hallucination_analysis = srs.sections.get('_hallucination_analysis', {})
    return {
        'document_id': srs.document_id,
        'title': srs.title,
        'version': srs.version,
        'date': srs.date,
        'author': srs.author,
        'sections': srs.sections,
        'raw_text': raw_text,
        'hallucination_analysis': hallucination_analysis
    }


def _extract_text_from_pdf(pdf_path: str) -> str:
    """Best-effort text extraction from PDF; falls back gracefully."""
    try:
        import PyPDF2
    except Exception:
        return ""
    try:
        text_chunks = []
        with open(pdf_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                try:
                    text_chunks.append(page.extract_text() or "")
                except Exception:
                    continue
        return "\n".join(chunks for chunks in text_chunks if chunks)
    except Exception:
        return ""

# Suspicious patterns that indicate potential prompt injection attempts
SUSPICIOUS_PATTERNS = [
    r'ignore\s+(previous|all|the|all\s+previous)\s+instructions?',
    r'forget\s+(the|previous|all|everything)',
    r'new\s+instructions?',
    r'(system|hidden)\s+prompt',
    r'prompt\s+injection',
    r'ignore\s+the\s+prompt',
    r'override\s+(the|previous|system)',
    r'disregard\s+(the|previous|all)',
    r'you\s+are\s+now',
    r'from\s+now\s+on',
    r'act\s+as\s+if',
    r'pretend\s+to\s+be',
    r'roleplay\s+as',
    r'<\|.*?\|>',  # Special tokens
    r'\[INST\].*?\[/INST\]',  # Instruction tags
    r'<\|im_start\|>.*?<\|im_end\|>',  # ChatML tokens
]

def detect_prompt_injection(text: str) -> tuple[bool, list[str]]:
    """
    Detect potential prompt injection attempts in user input.
    
    Args:
        text: The text content to check for prompt injection patterns
    
    Returns:
        Tuple containing:
            - bool: True if suspicious patterns detected, False otherwise
            - list: List of detected suspicious patterns
    """
    if not text:
        return False, []
    
    detected_patterns = []
    text_lower = text.lower()
    
    for pattern in SUSPICIOUS_PATTERNS:
        matches = re.findall(pattern, text_lower, re.IGNORECASE | re.MULTILINE)
        if matches:
            detected_patterns.append(pattern)
    
    # Log suspicious activity if detected
    if detected_patterns:
        logger.warning(
            f"Potential prompt injection detected. Patterns: {detected_patterns}. "
            f"Input preview: {text[:200]}..."
        )
    
    return len(detected_patterns) > 0, detected_patterns

def sanitize_user_input(text: str, max_length: int = 10000) -> str:
    """
    Sanitize user input to prevent prompt injection attacks.
    
    Removes or neutralizes potentially dangerous content:
    - Markdown code blocks
    - Suspicious instruction patterns
    - Excessive special characters
    - Truncates to maximum length
    
    Args:
        text: Raw user input text
        max_length: Maximum allowed length (default: 10000 characters)
    
    Returns:
        Sanitized text safe for use in prompts
    """
    if not text:
        return ""
    
    # Remove markdown code blocks that could contain instructions
    text = re.sub(r'```[\s\S]*?```', '', text)
    text = re.sub(r'`[^`]+`', '', text)
    
    # Remove HTML-like tags that might be interpreted as instructions
    text = re.sub(r'<[^>]+>', '', text)
    
    # Remove special instruction markers
    text = re.sub(r'<\|.*?\|>', '', text)
    text = re.sub(r'\[INST\].*?\[/INST\]', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<\|im_start\|>.*?<\|im_end\|>', '', text, flags=re.DOTALL | re.IGNORECASE)
    
    # Remove excessive newlines (more than 2 consecutive)
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # Remove excessive whitespace
    text = re.sub(r' {3,}', ' ', text)
    
    # Truncate to maximum length
    if len(text) > max_length:
        text = text[:max_length].rsplit(' ', 1)[0]  # Cut at word boundary
    
    return text.strip()

def validate_text_content(text: str) -> dict:
    """
    Validates text content against system requirements.
    
    Performs validation checks to ensure text content meets minimum quality standards:
    - Text must not be empty
    - Must contain at least one alphabetic character
    - Must have a minimum of 50 words
    - Must not be dominated by repeated tokens (anti-spam / anti-garbage)
    - Must not contain prompt-injection attempts
    
    Args:
        text: The text content to validate
    
    Returns:
        Dictionary containing:
            - 'valid' (bool): True if text passes all validation checks
            - 'errors' (list): List of error messages describing validation failures
    """
    errors = []
    
    if not text or not text.strip():
        return {'valid': False, 'errors': ['Text content is empty']}
    
    # Check for prompt injection attempts
    has_injection, detected_patterns = detect_prompt_injection(text)
    if has_injection:
        # Log security event with more context
        logger.warning(
            f"SECURITY ALERT: Prompt injection attempt detected. "
            f"Patterns: {detected_patterns}. "
            f"Input length: {len(text)} chars. "
            f"Input preview: {text[:500]}..."
        )
        errors.append('Input appears to contain prompt-injection patterns. These instructions will be ignored; please provide valid requirements instead.')
        return {
            'valid': False,
            'errors': errors,
            'security_issue': True
        }
    
    # Detect excessive repetition (e.g., "hi hi hi ..." spam)
    words = text.strip().split()
    if words:
        from collections import Counter
        counts = Counter(w.lower() for w in words if w.strip())
        total = sum(counts.values())
        most_common_word, freq = counts.most_common(1)[0]
        if total >= 20 and freq / total >= 0.6:
            errors.append(f"Input appears to be mostly repeated token '{most_common_word}' ({freq} of {total} tokens). Please provide meaningful requirements.")
    
    # Require at least one alphabetic character (allow numbers/symbols but not only them)
    if not re.search(r'[A-Za-z]', text):
        errors.append('Text must include at least one alphabetic character (A-Z).')
    # Check minimum word count (50 words)
    words = text.strip().split()
    word_count = len([word for word in words if word])
    if word_count < 50:
        errors.append(f'Minimum 50 words required (current: {word_count} words)')
    
    return {
        'valid': len(errors) == 0,
        'errors': errors
    }

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'service': 'Requirements Engineering API'
    })

@app.route('/api/process-single', methods=['POST'])
def process_single_requirement():
    """Process a single requirement from text input"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        input_type = data.get('type', 'text')
        content = data.get('content', '')
        project_info = data.get('project_info', {})
        
        if not content:
            return jsonify({'error': 'No content provided'}), 400
        
        # Sanitize user input to prevent prompt injection
        original_length = len(content)
        sanitized_content = sanitize_user_input(content)
        sanitized_length = len(sanitized_content)
        
        # Log if significant content was removed during sanitization
        if original_length > sanitized_length + 100:  # More than 100 chars removed
            logger.info(
                f"Input sanitization removed {original_length - sanitized_length} characters. "
                f"Original: {original_length} chars, Sanitized: {sanitized_length} chars"
            )
        
        if not sanitized_content or len(sanitized_content.strip()) < 10:
            logger.warning(f"Content rejected after sanitization. Original length: {original_length}, Sanitized length: {sanitized_length}")
            return jsonify({'error': 'Content is invalid or too short after sanitization'}), 400
        
        # Validate content (includes prompt injection detection)
        validation = validate_text_content(sanitized_content)
        if not validation['valid']:
            error_status = 403 if validation.get('security_issue') else 400
            return jsonify({
                'error': 'Text content validation failed', 
                'validation_errors': validation['errors']
            }), error_status

        # Prepare input data with sanitized content
        if input_type == 'text':
            input_data = {'type': 'text', 'content': sanitized_content}
        else:
            return jsonify({'error': 'Unsupported input type'}), 400
        
        # Process the requirement
        result = orchestrator.process_single_requirement(input_data)
        
        # Add project info to result
        result['project_info'] = project_info
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error processing single requirement: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/process-audio', methods=['POST'])
def process_audio_requirement():
    """Process a single requirement from audio recording"""
    temp_file_path = None
    try:
        audio_file = request.files.get('audio')
        project_info_str = request.form.get('project_info', '{}')
        
        if not audio_file:
            logger.error("No audio file provided in request")
            return jsonify({'error': 'No audio file provided'}), 400
        
        logger.info(f"Received audio file: {audio_file.filename}, Content-Type: {audio_file.content_type}, Size: {audio_file.content_length} bytes")
        
        # Parse project info
        try:
            project_info = json.loads(project_info_str) if project_info_str else {}
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse project_info JSON: {e}, using empty dict")
            project_info = {}
        
        # Determine file extension from content type or filename
        original_filename = audio_file.filename or 'recording'
        file_ext = None
        
        # Try to get extension from filename
        if '.' in original_filename:
            file_ext = original_filename.rsplit('.', 1)[1].lower()
        
        # If no extension or unsupported, try to determine from content type
        if not file_ext or file_ext not in ['wav', 'webm', 'mp4', 'm4a', 'ogg', 'mp3', 'flac']:
            content_type = audio_file.content_type or ''
            if 'webm' in content_type or 'webm' in original_filename.lower():
                file_ext = 'webm'
            elif 'mp4' in content_type or 'm4a' in content_type or 'mp4' in original_filename.lower():
                file_ext = 'm4a'
            elif 'ogg' in content_type or 'ogg' in original_filename.lower():
                file_ext = 'ogg'
            elif 'wav' in content_type or 'wav' in original_filename.lower():
                file_ext = 'wav'
            else:
                # Default to webm (most common for browser recordings)
                file_ext = 'webm'
                logger.info(f"Unknown audio format, defaulting to webm")
        
        # Create temporary file with appropriate extension
        suffix = f'.{file_ext}'
        logger.info(f"Creating temp file with extension: {suffix}")
        
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
            try:
                audio_file.save(temp_file.name)
                temp_file_path = temp_file.name
                logger.info(f"Audio file saved to: {temp_file_path}, Size: {os.path.getsize(temp_file_path)} bytes")
            except Exception as save_error:
                logger.error(f"Error saving audio file: {save_error}")
                return jsonify({'error': f'Failed to save audio file: {str(save_error)}'}), 500
        
        # Verify file was saved and has content
        if not os.path.exists(temp_file_path):
            logger.error(f"Temp file was not created: {temp_file_path}")
            return jsonify({'error': 'Failed to save audio file'}), 500
        
        file_size = os.path.getsize(temp_file_path)
        if file_size == 0:
            logger.error(f"Audio file is empty: {temp_file_path}")
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
            return jsonify({'error': 'Audio file is empty. Please record again.'}), 400

        # Reject very short audio (< 0.5s)
        try:
            duration = orchestrator.processor._get_audio_duration(temp_file_path)
            if duration <= 0.5:
                logger.error(f"Audio file too short ({duration}s): {temp_file_path}")
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                return jsonify({'error': 'Audio is too short. Please record at least 1 second.'}), 400
        except Exception as dur_err:
            logger.warning(f"Failed to measure duration for {temp_file_path}: {dur_err}")
        
        logger.info(f"Processing audio file: {temp_file_path} ({file_size} bytes)")
        
        # Process the audio requirement
        input_data = {'type': 'audio', 'file_path': temp_file_path}
        result = orchestrator.process_single_requirement(input_data)

        # If processing failed (e.g., whisper disabled or other error), return 400
        if result.get('status') == 'failed':
            error_msg = result.get('error', 'Audio processing failed')
            logger.error(f"Audio processing failed: {error_msg}")
            return jsonify({'error': error_msg}), 400
        
        # Validate the transcribed text
        if result.get('status') == 'completed':
            transcribed_text = result.get('original_text', '')
            logger.info(f"Transcription completed, text length: {len(transcribed_text)} characters")
        
        if not transcribed_text or not transcribed_text.strip():
            logger.error("Transcription resulted in empty text")
            return jsonify({
                'error': 'Audio transcription resulted in empty text. Please ensure your recording is clear and try again.',
                'validation_errors': ['No text was transcribed from the audio']
            }), 400
        
        # Sanitize transcribed text to prevent prompt injection
        sanitized_transcription = sanitize_user_input(transcribed_text)
        if not sanitized_transcription or len(sanitized_transcription.strip()) < 10:
            return jsonify({
                'error': 'Transcribed content is invalid or too short after sanitization',
                'validation_errors': ['Content does not meet security requirements']
            }), 400
        
        # Validate sanitized content
        validation_result = validate_text_content(sanitized_transcription)
        
        # Update result with sanitized text
        if sanitized_transcription != transcribed_text:
            result['original_text'] = sanitized_transcription
            logger.info("Transcribed text was sanitized for security")
        
        if not validation_result['valid']:
            logger.warning(f"Transcribed text validation failed: {validation_result['errors']}")
            return jsonify({
                'error': 'Audio content validation failed',
                'validation_errors': validation_result['errors'],
                'transcribed_text': transcribed_text
            }), 400
        
        # Add project info to result
        result['project_info'] = project_info
        result['source_type'] = 'audio_recording'
        
        logger.info(f"Audio processing completed successfully")
        return jsonify(result)
            
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {str(e)}")
        return jsonify({'error': f'Invalid project_info format: {str(e)}'}), 400
    except Exception as e:
        logger.error(f"Error processing audio requirement: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to process audio: {str(e)}'}), 500
    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                logger.info(f"Cleaned up temp file: {temp_file_path}")
            except Exception as cleanup_error:
                logger.warning(f"Failed to cleanup temp file {temp_file_path}: {cleanup_error}")

@app.route('/api/transcribe-audio', methods=['POST'])
def transcribe_audio_only():
    """Transcribe audio without full processing - for live transcription during recording"""
    temp_file_path = None
    try:
        audio_file = request.files.get('audio')
        
        if not audio_file:
            return jsonify({'error': 'No audio file provided'}), 400
        if (audio_file.content_length or 0) <= 0:
            return jsonify({'error': 'Audio file is empty. Please record again.'}), 400
        
        logger.info(f"Transcription request: {audio_file.filename}, Size: {audio_file.content_length} bytes")
        
        # Determine file extension
        original_filename = audio_file.filename or 'recording'
        file_ext = None
        
        if '.' in original_filename:
            file_ext = original_filename.rsplit('.', 1)[1].lower()
        
        content_type = audio_file.content_type or ''
        if not file_ext or file_ext not in ['wav', 'webm', 'mp4', 'm4a', 'ogg', 'mp3', 'flac']:
            if 'webm' in content_type or 'webm' in original_filename.lower():
                file_ext = 'webm'
            elif 'mp4' in content_type or 'm4a' in content_type:
                file_ext = 'm4a'
            elif 'ogg' in content_type:
                file_ext = 'ogg'
            elif 'wav' in content_type:
                file_ext = 'wav'
            else:
                file_ext = 'webm'
        
        # Create temporary file
        suffix = f'.{file_ext}'
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
            audio_file.save(temp_file.name)
            temp_file_path = temp_file.name
        
        # Reject empty files early
        if not os.path.exists(temp_file_path) or os.path.getsize(temp_file_path) == 0:
            logger.error(f"Transcription file is empty: {temp_file_path}")
            return jsonify({'error': 'Audio file is empty. Please record again.'}), 400

        # Reject very short audio (< 0.5s)
        try:
            duration = orchestrator.processor._get_audio_duration(temp_file_path)
            if duration <= 0.5:
                logger.error(f"Transcription file too short ({duration}s): {temp_file_path}")
                return jsonify({'error': 'Audio is too short. Please record at least 1 second.'}), 400
        except Exception as dur_err:
            logger.warning(f"Failed to measure duration for {temp_file_path}: {dur_err}")
        
        # Transcribe using orchestrator's processor
        try:
            # Ensure whisper is loaded
            if not getattr(orchestrator.processor, 'models_loaded', False):
                orchestrator.processor._load_models()
            transcription = orchestrator.processor._transcribe_audio(temp_file_path)
            logger.info(f"Transcription successful, length: {len(transcription)} characters")
            
            return jsonify({
                'transcription': transcription,
                'success': True
            })
        except Exception as transcribe_error:
            logger.error(f"Transcription error: {str(transcribe_error)}")
            return jsonify({
                'error': f'Transcription failed: {str(transcribe_error)}',
                'transcription': ''
            }), 500
        
    except Exception as e:
        logger.error(f"Error transcribing audio: {str(e)}", exc_info=True)
        return jsonify({'error': f'Transcription failed: {str(e)}', 'transcription': ''}), 500
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except Exception:
                pass

@app.route('/api/process-batch', methods=['POST'])
def process_batch_requirements():
    """Process multiple requirements from uploaded files"""
    try:
        files = request.files.getlist('files')
        project_info_str = request.form.get('project_info', '{}')
        
        if not files:
            return jsonify({'error': 'No files provided'}), 400
        
        project_info = json.loads(project_info_str)
        
        # Create temporary directory for processing
        with tempfile.TemporaryDirectory() as temp_dir:
            results = []
            validation_errors_list = []
            
            for file in files:
                if file.filename == '':
                    continue
                
                # Save file to temp directory
                file_path = os.path.join(temp_dir, file.filename)
                file.save(file_path)

                # Reject zero-size after save
                if not os.path.exists(file_path) or os.path.getsize(file_path) == 0:
                    validation_errors_list.append({
                        'file': file.filename,
                        'errors': ['File is empty. Please upload a valid file.']
                    })
                    continue
                
                # Determine input type and read content for validation
                if file.filename.lower().endswith(('.wav', '.mp3', '.m4a', '.flac')):
                    input_data = {'type': 'audio', 'file_path': file_path}
                    # Process first to get transcription
                    result = orchestrator.process_single_requirement(input_data)
                    content_to_validate = result.get('original_text', '')
                else:
                    # Read text file
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    # Sanitize file content to prevent prompt injection
                    sanitized_content = sanitize_user_input(content)
                    if not sanitized_content or len(sanitized_content.strip()) < 10:
                        validation_errors_list.append({
                            'file': file.filename,
                            'errors': ['Content is invalid or too short after sanitization']
                        })
                        continue
                    
                    content_to_validate = sanitized_content
                    input_data = {'type': 'text', 'content': sanitized_content}
                    # Process the requirement
                    result = orchestrator.process_single_requirement(input_data)
                
                # Validate the content
                validation_result = validate_text_content(content_to_validate)
                
                if not validation_result['valid']:
                    validation_errors_list.append({
                        'file': file.filename,
                        'errors': validation_result['errors']
                    })
                
                result['source_file'] = file.filename
                result['validation'] = validation_result
                results.append(result)
            
            # If any validation errors, return them
            if validation_errors_list:
                return jsonify({
                    'error': 'File content validation failed',
                    'validation_errors': validation_errors_list,
                    'details': 'One or more files do not meet the requirements'
                }), 400
            
            # Add project info to results
            batch_result = {
                'results': results,
                'project_info': project_info,
                'timestamp': datetime.now().isoformat(),
                'total_files': len(results),
                'status': 'completed'
            }
            
            return jsonify(batch_result)
        
    except Exception as e:
        logger.error(f"Error processing batch requirements: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-srs', methods=['POST'])
def generate_srs():
    """
    Generate SRS (Software Requirements Specification) document from processed requirements.
    
    Accepts processed requirement results and project information, then generates
    a complete IEEE 830-1998 compliant SRS document using the model-based generator.
    
    Expected request body:
        - results: List of processed requirement objects
        - project_info: Dictionary containing project metadata (title, author, version)
    
    Returns:
        JSON response containing the generated SRS document with:
            - document_id: Unique identifier for the document
            - title: Document title
            - version: Document version
            - date: Generation date
            - author: Document author
            - sections: Parsed SRS sections (introduction, overall_description, specific_requirements)
            - raw_text: Full raw text output from the model
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        results = data.get('results')
        project_info = data.get('project_info', {})
        
        if not results:
            return jsonify({'error': 'No results provided'}), 400
        
        # Ensure results is a list
        if not isinstance(results, list):
            results = [results]
        
        # Generate SRS content using the model-based generator
        logger.info(f"Generating SRS with {len(results)} result(s)")
        logger.debug(f"Results sample: {results[0] if results else 'No results'}")
        logger.debug(f"Project info: {project_info}")
        
        model_gen = SRSModelGenerator()
        srs = model_gen.generate_srs(results, project_info)
        
        logger.info(f"SRS generated successfully: {srs.document_id}")
        
        # Convert SRS to dictionary for JSON response
        # Get raw_text from attribute or sections
        raw_text = getattr(srs, 'raw_text', None) or srs.sections.get('_raw_text')
        
        # Extract hallucination analysis if available
        hallucination_analysis = srs.sections.get('_hallucination_analysis', {})
        
        srs_dict = {
            'document_id': srs.document_id,
            'title': srs.title,
            'version': srs.version,
            'date': srs.date,
            'author': srs.author,
            'sections': srs.sections,
            'raw_text': raw_text,  # Include full raw text if available
            'hallucination_analysis': hallucination_analysis  # Include hallucination analysis
        }
        
        # Log if hallucinations were detected
        if hallucination_analysis.get('has_hallucinations'):
            logger.warning(
                f"SRS {srs.document_id} has potential hallucinations. "
                f"Confidence: {hallucination_analysis.get('confidence_score', 'N/A')}"
            )
        
        return jsonify(srs_dict)
        
    except Exception as e:
        logger.error(f"Error generating SRS: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/download-srs/<format>', methods=['POST'])
def download_srs(format):
    """Download SRS document in specified format"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        srs_data = data.get('srs_data')
        
        if not srs_data:
            return jsonify({'error': 'No SRS data provided'}), 400
        
        # Create temporary file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        if format.lower() == 'json':
            filename = f"srs_{timestamp}.json"
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                json.dump(srs_data, f, indent=2, ensure_ascii=False)
                temp_file = f.name
        elif format.lower() == 'html':
            filename = f"srs_{timestamp}.html"
            # Generate HTML content
            html_content = generate_html_content(srs_data)
            with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False, encoding='utf-8') as f:
                f.write(html_content)
                temp_file = f.name
        else:
            return jsonify({'error': 'Unsupported format'}), 400
        
        return send_file(
            temp_file,
            as_attachment=True,
            download_name=filename,
            mimetype='application/octet-stream'
        )
        
    except Exception as e:
        logger.error(f"Error downloading SRS: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-srs-pdf', methods=['POST'])
def generate_srs_pdf():
    """
    Generate SRS document as PDF (or HTML fallback) and return as downloadable file.
    
    This endpoint generates a PDF file from SRS data. If PDF generation fails
    (e.g., weasyprint not installed), it falls back to HTML format.
    
    The function prioritizes raw_text if available for full document fidelity,
    otherwise uses parsed sections to reconstruct the document.
    
    Expected request body:
        - document_id: Unique identifier for the document
        - title: Document title
        - version: Document version
        - date: Document date
        - author: Document author
        - raw_text: Full raw text from model (preferred)
        - sections: Parsed SRS sections (fallback if raw_text unavailable)
        - results: Processed requirements (only used if sections are empty)
        - project_info: Project metadata
    
    Returns:
        File download response (PDF or HTML) with appropriate MIME type
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Helper function to check if sections are empty
        def _is_empty_sections(sec: dict) -> bool:
            """
            Check if SRS sections dictionary is effectively empty.
            
            Args:
                sec: Dictionary containing SRS sections
            
            Returns:
                True if sections contain no meaningful content, False otherwise
            """
            if not isinstance(sec, dict):
                return True
            intro = sec.get('introduction') or {}
            overall = sec.get('overall_description') or {}
            has_intro = any(bool(str(intro.get(k, '')).strip()) for k in ['purpose','scope','overview']) or bool(intro.get('definitions'))
            has_overall = any(bool(overall.get(k)) for k in ['product_functions','user_characteristics','constraints','assumptions','dependencies']) or bool(str(overall.get('product_perspective','')).strip())
            return not (has_intro or has_overall)

        # ALWAYS prioritize raw_text if available - this is the exact model output
        raw_text = data.get('raw_text')
        logger.info(f"PDF generation request - raw_text present: {raw_text is not None}, length: {len(raw_text) if raw_text else 0}")
        
        if raw_text and len(raw_text.strip()) > 50:  # Lowered threshold to 50 chars
            logger.info(f"Using provided raw_text for full SRS document generation (length: {len(raw_text)} chars)")
            # Convert raw text to HTML with proper formatting - NO metadata, NO parsing, just raw text
            html = _convert_raw_text_to_html(
                raw_text,
                data.get('document_id', f"SRS-{datetime.now().strftime('%Y%m%d-%H%M%S')}"),
                data.get('title', 'Software Requirements Specification'),
                data.get('version', '1.0'),
                data.get('date', datetime.now().strftime('%Y-%m-%d')),
                data.get('author', 'System')
            )
            out_path = save_pdf_or_html(html, f"srs_{data.get('document_id', 'srs')}.pdf")
            # Determine MIME type and file extension based on actual output
            is_pdf = out_path.endswith('.pdf')
            mimetype = 'application/pdf' if is_pdf else 'text/html; charset=utf-8'
            download_name = os.path.basename(out_path)
            
            # Ensure proper file encoding and headers for PDF
            return send_file(
                out_path, 
                as_attachment=True, 
                download_name=download_name, 
                mimetype=mimetype
            )
        
        # If raw_text is missing or too short, log warning
        if not raw_text:
            logger.warning("raw_text not provided in request - will fall back to parsed sections")
        elif len(raw_text.strip()) <= 50:
            logger.warning(f"raw_text too short ({len(raw_text.strip())} chars) - will fall back to parsed sections")

        sections = data.get('sections') or data.get('srs_sections')
        
        # Only use parsed sections if raw_text is NOT available
        # Check if sections are already provided (from /api/generate-srs)
        if sections and not _is_empty_sections(sections):
            logger.info("Using provided SRS sections (no regeneration needed)")
            # Use provided sections - no regeneration
            srs_data = {
                'document_id': data.get('document_id', f"SRS-{datetime.now().strftime('%Y%m%d-%H%M%S')}"),
                'title': data.get('title', 'Software Requirements Specification'),
                'version': data.get('version', '1.0'),
                'date': data.get('date', datetime.now().strftime('%Y-%m-%d')),
                'author': data.get('author', 'System'),
                'sections': sections,
            }
            html = render_html(srs_data)
            out_path = save_pdf_or_html(html, f"srs_{srs_data['document_id']}.pdf")
            is_pdf = out_path.endswith('.pdf')
            mimetype = 'application/pdf' if is_pdf else 'text/html; charset=utf-8'
            return send_file(
                out_path, 
                as_attachment=True, 
                download_name=os.path.basename(out_path), 
                mimetype=mimetype
            )
        
        # Only generate if sections are truly empty AND results are provided
        # This should rarely happen if frontend calls /api/generate-srs first
        if data.get('results'):
            logger.warning("Sections empty but results provided - generating SRS (this may cause duplicate requests)")
            model_gen = SRSModelGenerator()
            project_info = data.get('project_info', {})
            srs = model_gen.generate_srs(data['results'], project_info)
            # Use raw_text if available, otherwise use sections
            raw_text = getattr(srs, 'raw_text', None) or srs.sections.get('_raw_text')
            if raw_text and len(raw_text.strip()) > 100:
                logger.info("Using raw_text from SRS for full document generation")
                html = _convert_raw_text_to_html(
                    raw_text,
                    srs.document_id,
                    srs.title,
                    srs.version,
                    srs.date,
                    srs.author
                )
            else:
                html = render_html({
                    'document_id': srs.document_id,
                    'title': srs.title,
                    'version': srs.version,
                    'date': srs.date,
                    'author': srs.author,
                    'sections': srs.sections,
                })
            out_path = save_pdf_or_html(html, f"srs_{srs.document_id}.pdf")
            is_pdf = out_path.endswith('.pdf')
            mimetype = 'application/pdf' if is_pdf else 'text/html; charset=utf-8'
            return send_file(
                out_path, 
                as_attachment=True, 
                download_name=os.path.basename(out_path), 
                mimetype=mimetype
            )
        
        # No sections and no results - return error
        return jsonify({'error': 'No SRS sections provided. Please generate SRS first using /api/generate-srs and pass the sections'}), 400
    except Exception as e:
        logger.error(f"Error generating SRS PDF: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/generate-srs-from-audio', methods=['POST'])
def generate_srs_from_audio():
    """
    Direct SRS generation from audio without preprocessing/validation pipeline.
    Steps:
      1) Accept audio file
      2) Transcribe with Whisper
      3) Generate SRS via SRSModelGenerator using the transcription as input
    """
    temp_file_path = None
    try:
        audio_file = request.files.get('audio')
        project_info_str = request.form.get('project_info', '{}')
        try:
            project_info = json.loads(project_info_str) if project_info_str else {}
        except json.JSONDecodeError:
            project_info = {}

        if not audio_file:
            return jsonify({'error': 'No audio file provided'}), 400

        original_filename = audio_file.filename or 'recording'
        file_ext = 'webm'
        if '.' in original_filename:
            file_ext = original_filename.rsplit('.', 1)[1].lower()

        with tempfile.NamedTemporaryFile(suffix=f'.{file_ext}', delete=False) as temp_file:
            audio_file.save(temp_file.name)
            temp_file_path = temp_file.name

        # Verify file has content after saving
        if not os.path.exists(temp_file_path) or os.path.getsize(temp_file_path) == 0:
            return jsonify({'error': 'Audio file is empty. Please record again.'}), 400

        # Duration check
        try:
            duration = orchestrator.processor._get_audio_duration(temp_file_path)
            if duration <= 0.5:
                return jsonify({'error': 'Audio is too short. Please record at least 1 second.'}), 400
        except Exception as dur_err:
            logger.warning(f"Duration check failed: {dur_err}")

        # Transcribe
        if not getattr(orchestrator.processor, 'models_loaded', False):
            orchestrator.processor._load_models()
        transcription = orchestrator.processor._transcribe_audio(temp_file_path)

        if not transcription or not transcription.strip():
            return jsonify({'error': 'Transcription is empty. Please try again with clearer audio.'}), 400

        # Light deduplication: remove consecutive duplicate lines/paragraphs
        def _dedupe_text(text: str) -> str:
            lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
            deduped = []
            prev = None
            for ln in lines:
                if ln != prev:
                    deduped.append(ln)
                prev = ln
            # Also dedupe by paragraphs split on blank lines
            paragraphs = [p.strip() for p in "\n".join(deduped).split("\n\n") if p.strip()]
            deduped_paras = []
            prevp = None
            for p in paragraphs:
                if p != prevp:
                    deduped_paras.append(p)
                prevp = p
            return "\n\n".join(deduped_paras)

        transcription = _dedupe_text(transcription)

        # Generate SRS directly from transcription
        model_gen = SRSModelGenerator()
        results = [{'original_text': transcription}]
        srs = model_gen.generate_srs(results, project_info)

        return jsonify(serialize_srs(srs))

    except Exception as e:
        logger.error(f"Error generating SRS from audio: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to generate SRS from audio: {str(e)}'}), 500
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except Exception:
                pass


@app.route('/api/generate-srs-from-file', methods=['POST'])
def generate_srs_from_file():
    """
    Direct SRS generation from uploaded file (txt or pdf).
    - Saves file locally
    - Extracts text (best effort for PDF)
    - Generates SRS without preprocessing pipeline
    """
    temp_file_path = None
    try:
        file = request.files.get('file')
        project_info_str = request.form.get('project_info', '{}')
        try:
            project_info = json.loads(project_info_str) if project_info_str else {}
        except json.JSONDecodeError:
            project_info = {}

        if not file:
            return jsonify({'error': 'No file provided'}), 400

        original_filename = file.filename or 'document'
        ext = original_filename.rsplit('.', 1)[-1].lower() if '.' in original_filename else 'txt'

        with tempfile.NamedTemporaryFile(suffix=f'.{ext}', delete=False) as temp_file:
            file.save(temp_file.name)
            temp_file_path = temp_file.name

        if not os.path.exists(temp_file_path) or os.path.getsize(temp_file_path) == 0:
            return jsonify({'error': 'File is empty. Please upload a valid file.'}), 400

        text_content = ""
        if ext == 'txt':
            with open(temp_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                text_content = f.read()
        elif ext == 'pdf':
            text_content = _extract_text_from_pdf(temp_file_path)
        else:
            return jsonify({'error': 'Unsupported file type. Please upload .txt or .pdf'}), 400

        if not text_content or len(text_content.strip().split()) < 10:
            return jsonify({'error': 'File content is too short or could not be extracted. Please provide a valid text or PDF.'}), 400

        model_gen = SRSModelGenerator()
        results = [{'original_text': text_content}]
        srs = model_gen.generate_srs(results, project_info)

        return jsonify(serialize_srs(srs))

    except Exception as e:
        logger.error(f"Error generating SRS from file: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to generate SRS from file: {str(e)}'}), 500
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except Exception:
                pass

def _convert_raw_text_to_html(raw_text: str, document_id: str, title: str, version: str, date: str, author: str) -> str:
    """
    Convert raw SRS text from model to HTML, preserving exact formatting from model output.
    
    Args:
        raw_text: Raw text output from the SRS model
        document_id: Unique identifier for the SRS document
        title: Document title
        version: Document version
        date: Document date
        author: Document author
    
    Returns:
        HTML string with cleaned and formatted SRS content
    """
    # Remove markdown code blocks if present (but preserve the content)
    text = raw_text.strip()
    
    # Remove markdown code block markers (```plaintext, ```, etc.)
    if text.startswith("```"):
        # Remove opening code block markers (```plaintext, ```text, etc.)
        text = re.sub(r'^```[a-z]*\s*\n?', '', text, flags=re.IGNORECASE)
        # Remove closing code block markers
        text = re.sub(r'\n?```\s*$', '', text, flags=re.MULTILINE)
        text = text.strip()
    
    # Remove the disclaimer text at the bottom if present
    disclaimer_patterns = [
        r'This document adheres strictly to the IEEE 830-1998 format.*?specifications\.?\s*$',
        r'This document adheres.*?IEEE 830.*?specifications\.?\s*$',
        r'No additional content or assumptions have been added.*?specifications\.?\s*$',
    ]
    for pattern in disclaimer_patterns:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE | re.DOTALL | re.MULTILINE)
    
    # Clean up any trailing whitespace or newlines
    text = text.strip()
    
    # Escape HTML special characters to prevent XSS, but preserve all formatting
    import html
    text = html.escape(text)
    
    # Use pre-wrap to preserve all whitespace, line breaks, and formatting exactly as from model
    return f"""<!DOCTYPE html>
<html>
<head>
    <title>{title}</title>
    <meta charset="UTF-8">
    <style>
        body {{ 
            font-family: Arial, sans-serif; 
            margin: 40px; 
            line-height: 1.6; 
            color: #333;
        }}
        .content {{
            white-space: pre-wrap;
            font-family: Arial, sans-serif;
            line-height: 1.6;
            word-wrap: break-word;
        }}
        @media print {{
            body {{ margin: 20px; }}
        }}
    </style>
</head>
<body>
    <div class="content">{text}</div>
</body>
</html>"""

def generate_html_content(srs_data: dict) -> str:
    """
    Generate HTML content for SRS document from structured data.
    
    Converts SRS document sections into a formatted HTML document suitable
    for display or printing. Handles both 'sections' and 'srs_sections' keys
    for backward compatibility.
    
    Args:
        srs_data: Dictionary containing SRS document data with:
            - title: Document title
            - document_id: Unique document identifier
            - version: Document version
            - date: Document date
            - author: Document author
            - sections or srs_sections: Dictionary containing parsed SRS sections
    
    Returns:
        HTML string containing the formatted SRS document
    """
    sections = srs_data.get('sections') or srs_data.get('srs_sections') or {}
    intro = sections.get('introduction', {})
    overall = sections.get('overall_description', {})
    return f"""
<!DOCTYPE html>
<html>
<head>
    <title>{srs_data['title']}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }}
        h1 {{ color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }}
        h2 {{ color: #34495e; margin-top: 30px; }}
        h3 {{ color: #7f8c8d; margin-top: 20px; }}
        .metadata {{ background-color: #ecf0f1; padding: 15px; margin-bottom: 20px; border-radius: 5px; }}
        ul {{ margin: 10px 0; }}
        li {{ margin: 5px 0; }}
        .section {{ margin: 20px 0; }}
    </style>
</head>
<body>
    <h1>{srs_data['title']}</h1>
    
    <div class="metadata">
        <p><strong>Document ID:</strong> {srs_data['document_id']}</p>
        <p><strong>Version:</strong> {srs_data['version']}</p>
        <p><strong>Date:</strong> {srs_data['date']}</p>
        <p><strong>Author:</strong> {srs_data['author']}</p>
    </div>
    
    <div class="section">
        <h2>1. Introduction</h2>
        <h3>1.1 Purpose</h3>
        <p>{intro.get('purpose','')}</p>
        
        <h3>1.2 Scope</h3>
        <p>{intro.get('scope','')}</p>
        
        <h3>1.3 Definitions</h3>
        <ul>
            {''.join(f'<li>{defn}</li>' for defn in intro.get('definitions', []))}
        </ul>
        
        <h3>1.4 Overview</h3>
        <p>{intro.get('overview','')}</p>
    </div>
    
    <div class="section">
        <h2>2. Overall Description</h2>
        <h3>2.1 Product Functions</h3>
        <ul>
            {''.join(f'<li>{func}</li>' for func in overall.get('product_functions', []))}
        </ul>
        
        <h3>2.2 User Characteristics</h3>
        <ul>
            {''.join(f'<li>{user}</li>' for user in overall.get('user_characteristics', []))}
        </ul>
        
        <h3>2.3 Constraints</h3>
        <ul>
            {''.join(f'<li>{constraint}</li>' for constraint in overall.get('constraints', []))}
        </ul>
        
        <h3>2.4 Assumptions</h3>
        <ul>
            {''.join(f'<li>{assumption}</li>' for assumption in (overall.get('assumptions', []) if isinstance(overall.get('assumptions'), list) else [overall.get('assumptions')] if overall.get('assumptions') else []))}
        </ul>
        
        <h3>2.5 Dependencies</h3>
        <ul>
            {''.join(f'<li>{dep}</li>' for dep in overall.get('dependencies', []))}
        </ul>
    </div>
    
    <div class="section">
        <h2>3. Note</h2>
        <p><em>This is an initial SRS document generated by Module 1. It contains only the Introduction and Overall Description sections. 
        Specific Requirements and other detailed sections will be generated in subsequent modules of the requirements engineering system.</em></p>
    </div>
</body>
</html>"""

@app.route('/api/stats', methods=['GET'])
def get_system_stats():
    """Get system statistics"""
    try:
        stats = orchestrator.get_system_stats()
        return jsonify(stats)
    except Exception as e:
        logger.error(f"Error getting system stats: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/cleanup', methods=['POST'])
def cleanup_system():
    """Clean up old data"""
    try:
        data = request.get_json() or {}
        days_old = data.get('days_old', 30)
        
        orchestrator.cleanup_system(days_old)
        
        return jsonify({
            'message': f'System cleanup completed (removed data older than {days_old} days)',
            'status': 'success'
        })
    except Exception as e:
        logger.error(f"Error during cleanup: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Serve React frontend in production
FRONTEND_BUILD_DIR = os.path.join(os.path.dirname(__file__), 'frontend', 'build')

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """Serve React frontend static files"""
    if path != "" and os.path.exists(os.path.join(FRONTEND_BUILD_DIR, path)):
        return send_from_directory(FRONTEND_BUILD_DIR, path)
    else:
        # Serve index.html for all non-API routes (React Router)
        if os.path.exists(os.path.join(FRONTEND_BUILD_DIR, 'index.html')):
            return send_from_directory(FRONTEND_BUILD_DIR, 'index.html')
        return jsonify({'error': 'Frontend not built. Run: cd frontend && npm run build'}), 404

if __name__ == '__main__':
    print("Starting Requirements Engineering API Server...")
    print("API Endpoints:")
    print("  GET  /api/health - Health check")
    print("  POST /api/process-single - Process single requirement")
    print("  POST /api/process-audio - Process audio recording")
    print("  POST /api/transcribe-audio - Transcribe audio only (for live transcription)")
    print("  POST /api/process-batch - Process batch requirements")
    print("  POST /api/generate-srs - Generate SRS document")
    print("  POST /api/download-srs/<format> - Download SRS")
    print("  GET  /api/stats - Get system statistics")
    print("  POST /api/cleanup - Clean up system")
    
    # Check if frontend is built
    if os.path.exists(FRONTEND_BUILD_DIR):
        print(f"\nFrontend detected at: {FRONTEND_BUILD_DIR}")
        print("Serving frontend and API on http://localhost:8000")
    else:
        print(f"\nFrontend not found at: {FRONTEND_BUILD_DIR}")
        print("API only mode. Build frontend with: cd frontend && npm run build")
    
    port = int(os.environ.get('PORT', 8000))
    debug = os.environ.get('FLASK_ENV', 'production') != 'production'
    
    app.run(host='0.0.0.0', port=port, debug=debug)
