import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Mic, X, CheckCircle, AlertCircle, Square, Sparkles, Info, Loader2 } from 'lucide-react';
import axios from 'axios';
import { saveInput } from '../utils/storage';
import config from '../config';

const RequirementsInput = ({ onResultsGenerated, onSRSGenerated, theme = 'dark', setCurrentResults = () => {} }) => {
  const isDark = theme === 'dark';
  const [inputType, setInputType] = useState('text');
  const [textInput, setTextInput] = useState('');
  const [projectInfo, setProjectInfo] = useState({
    title: '',
    author: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [projectInfoErrors, setProjectInfoErrors] = useState([]);
  const [showHelp, setShowHelp] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  
  // Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [liveTranscription, setLiveTranscription] = useState('');
  const [isGeneratingDirectSRS, setIsGeneratingDirectSRS] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [lastSRSAvailable, setLastSRSAvailable] = useState(false);
  const navigate = useNavigate();
  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const transcriptionIntervalRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Memoized computed values
  const wordCount = useMemo(() => {
    return (textInput || '').trim().split(/\s+/).filter(w => w.length > 0).length;
  }, [textInput]);

  const hasLetter = useMemo(() => {
    return /[A-Za-z]/.test(textInput || '');
  }, [textInput]);

  const charCount = useMemo(() => {
    return (textInput || '').length;
  }, [textInput]);

  const minWords = 50;
  const maxChars = 10000; // Maximum input length

  // Suspicious patterns for prompt injection detection
  const suspiciousPatterns = [
    /ignore\s+(previous|all|the|all\s+previous)\s+instructions?/i,
    /forget\s+(the|previous|all|everything)/i,
    /new\s+instructions?/i,
    /(system|hidden)\s+prompt/i,
    /prompt\s+injection/i,
    /ignore\s+the\s+prompt/i,
    /override\s+(the|previous|system)/i,
    /disregard\s+(the|previous|all)/i,
    /you\s+are\s+now/i,
    /from\s+now\s+on/i,
    /act\s+as\s+if/i,
    /pretend\s+to\s+be/i,
    /roleplay\s+as/i,
    /<\|.*?\|>/,
    /\[INST\].*?\[\/INST\]/i,
    /<\|im_start\|>.*?<\|im_end\|>/i,
  ];

  /**
   * Detects potential prompt injection patterns in user input.
   * @param {string} text - The text to check
   * @returns {Object} - { hasInjection: boolean, patterns: string[] }
   */
  const detectPromptInjection = useCallback((text) => {
    if (!text) return { hasInjection: false, patterns: [] };
    
    const detectedPatterns = [];
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(text)) {
        detectedPatterns.push(pattern.toString());
      }
    }
    
    return {
      hasInjection: detectedPatterns.length > 0,
      patterns: detectedPatterns
    };
  }, []);

  /**
   * Sanitizes user input by removing potentially dangerous content.
   * @param {string} text - The text to sanitize
   * @returns {string} - Sanitized text
   */
  const sanitizeInput = useCallback((text) => {
    if (!text) return '';
    
    let sanitized = text;
    
    // Remove markdown code blocks
    sanitized = sanitized.replace(/```[\s\S]*?```/g, '');
    sanitized = sanitized.replace(/`[^`]+`/g, '');
    
    // Remove HTML-like tags
    sanitized = sanitized.replace(/<[^>]+>/g, '');
    
    // Remove special instruction markers
    sanitized = sanitized.replace(/<\|.*?\|>/g, '');
    sanitized = sanitized.replace(/\[INST\].*?\[\/INST\]/gi, '');
    sanitized = sanitized.replace(/<\|im_start\|>.*?<\|im_end\|>/gi, '');
    
    // Remove excessive newlines
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
    
    // Remove excessive whitespace
    sanitized = sanitized.replace(/ {3,}/g, ' ');
    
    // Truncate to max length
    if (sanitized.length > maxChars) {
      sanitized = sanitized.substring(0, maxChars).replace(/\s+\S*$/, '');
    }
    
    return sanitized.trim();
  }, []);
  const progressPct = useMemo(() => {
    return Math.min(100, Math.round((wordCount / minWords) * 100));
  }, [wordCount]);

  const templates = useMemo(() => [
    {
      label: 'User Management',
      text: 'The system should allow users to register, log in, reset passwords, and update profiles. Administrators can manage user roles, permissions, and view audit logs. The platform must ensure strong security, including session management, rate limiting, and multi-factor authentication. Notifications should be sent for critical actions and profile changes. The system must scale to handle peak usage and maintain availability, and provide basic audit trails for compliance reviews.'
    },
    {
      label: 'E-commerce',
      text: 'Users can browse products, search by keywords and filters, add items to cart, and checkout. Payments must be processed securely with receipts sent via email. Administrators can add, edit, and remove products, manage inventory, and review orders. The site should be responsive, accessible, and support promotional discounts and coupon codes. The system must handle returns, refunds, and out-of-stock items gracefully without losing user carts.'
    },
    {
      label: 'Analytics Dashboard',
      text: 'The application provides interactive charts, filters, and export options for business KPIs. Users can create custom dashboards, schedule reports, and share insights with teams. Data must refresh periodically and maintain accuracy. Access control should restrict sensitive metrics to authorized roles. The system should support drill-down views, anomaly highlights, and notify owners if data sources fail or become stale.'
    },
    {
      label: 'Hospital Appointment',
      text: 'Patients should be able to find doctors by specialty, book appointments, and get reminders. Doctors need to block unavailable slots, view daily schedules, and mark completed visits. The system must handle walk-ins, rescheduling, cancellations, and avoid double booking. Basic patient history should be visible during booking. The platform should send SMS/email reminders and maintain a minimal audit of booking changes for staff.'
    },
    {
      label: 'Food Delivery',
      text: 'Customers can browse restaurants, customize orders, schedule deliveries, and track riders live. Restaurants receive orders, confirm preparation time, and mark orders ready. Drivers accept delivery tasks, navigate optimized routes, and report incidents. The system must retry failed payments and handle order substitutions. Users should get status notifications, and restaurants need a simple way to pause orders during rush hours or outages.'
    },
    {
      label: 'Learning Management',
      text: 'Instructors can create courses, upload videos, add quizzes, and set grading rules. Learners enroll, track progress, take timed quizzes, and download certificates. The platform should support cohorts, discussion threads, announcements, and basic plagiarism checks for assignments. The system must handle assignment deadlines, late submissions with penalties, and allow instructors to export grades and feedback.'
    },
    {
      label: 'Facilities Maintenance',
      text: 'Staff should log issues (HVAC, electrical, plumbing) with photos and priority. Managers assign tickets to technicians based on skill and availability. Technicians update status, add parts used, and record time spent. The system must send escalations for overdue tickets and produce weekly SLA reports. A simple mobile view is needed for technicians, and tickets should capture location and contact details for the requesting employee.'
    },
    {
      label: 'Banking Onboarding',
      text: 'New customers submit KYC documents, perform liveness checks, and e-sign agreements. Compliance officers review flagged applications, request clarifications, and approve or reject. The system integrates with credit bureaus and must log every decision for audits. Users need status updates and secure in-app messaging. The flow should support retries for failed uploads and allow applicants to pick up where they left off.'
    },
    {
      label: 'Travel Booking',
      text: 'Users search multi-city itineraries, compare fares, and filter by baggage and refund policies. They can reserve seats, add insurance, and receive e-tickets. The system must handle voucher redemptions, fare changes, and alternative options when inventory expires during checkout. The platform should offer trip reminders, simple changes/cancellations, and store passenger profiles for faster bookings.'
    }
  ], []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const onDrop = useCallback((acceptedFiles) => {
    // Validate file types - only accept .txt and .pdf
    const validFiles = acceptedFiles.filter(file => {
      const extension = file.name.toLowerCase().split('.').pop();
      const isValid = extension === 'txt' || extension === 'pdf';
      if (!isValid) {
        setError(`Invalid file type: ${file.name}. Only .txt and .pdf files are accepted.`);
      }
      return isValid;
    });

    if (validFiles.length === 0) {
      return; // No valid files to add
    }

    // Only allow one file at a time; replace any existing
    const newFiles = validFiles.slice(0, 1).map(file => ({
      file,
      id: Date.now() + Math.random(),
      status: 'pending'
    }));
    setUploadedFiles(newFiles);
    setError(null); // Clear any previous errors if files are valid
  }, []);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf']
    },
    multiple: true,
    onDropRejected: (rejectedFiles) => {
      const rejectedNames = rejectedFiles.map(f => f.file.name).join(', ');
      setError(`Invalid file type(s). Only .txt and .pdf files are accepted. Rejected: ${rejectedNames}`);
    }
  });

  // Show file rejection errors
  useEffect(() => {
    if (fileRejections && fileRejections.length > 0) {
      const rejectedNames = fileRejections.map(f => f.file.name).join(', ');
      setError(`File(s) rejected: ${rejectedNames}. Only .txt and .pdf files are accepted.`);
    }
  }, [fileRejections]);

  const removeFile = useCallback((fileId) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  // Audio recording functions
  const startRecording = useCallback(async () => {
    try {
      // Clear any previous errors
      setError(null);
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Check if MediaRecorder is supported
      if (!window.MediaRecorder) {
        throw new Error('MediaRecorder is not supported in this browser');
      }

      // Determine the best MIME type supported by the browser
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType
      });
      const chunks = [];
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
        chunks.push(event.data);
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        }
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
        // Clear transcription interval
        if (transcriptionIntervalRef.current) {
          clearInterval(transcriptionIntervalRef.current);
          transcriptionIntervalRef.current = null;
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('An error occurred during recording. Please try again.');
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingTime(0);
      setLiveTranscription(''); // Reset transcription

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Start periodic transcription (every 5 seconds)
      transcriptionIntervalRef.current = setInterval(async () => {
        if (audioChunksRef.current.length > 0 && !isTranscribing) {
          try {
            setIsTranscribing(true);
            // Create a blob from accumulated chunks
            const currentBlob = new Blob(audioChunksRef.current, { type: mimeType });
            
            if (currentBlob.size > 0) {
              // Determine file extension
              let extension = 'webm';
              if (mimeType.includes('mp4')) {
                extension = 'm4a';
              } else if (mimeType.includes('ogg')) {
                extension = 'ogg';
              } else if (mimeType.includes('wav')) {
                extension = 'wav';
              }

              const formData = new FormData();
              formData.append('audio', currentBlob, `recording_chunk.${extension}`);
              formData.append('project_info', JSON.stringify(projectInfo));

              const response = await axios.post(config.API_ENDPOINTS.TRANSCRIBE_AUDIO, formData, {
                headers: {
                  'Content-Type': 'multipart/form-data'
                },
                timeout: 30000 // 30 seconds for transcription
              });

              if (response.data && response.data.transcription) {
                setLiveTranscription(prev => {
                  // Append new transcription, avoiding duplicates
                  const newText = response.data.transcription.trim();
                  if (prev && !prev.includes(newText)) {
                    return prev + ' ' + newText;
                  }
                  return newText || prev;
                });
              }
            }
          } catch (err) {
            // Silently fail for live transcription - don't show errors
            console.log('Live transcription update failed:', err.message);
          } finally {
            setIsTranscribing(false);
          }
        }
      }, 5000); // Transcribe every 5 seconds

    } catch (error) {
      console.error('Error starting recording:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setError('Microphone access denied. Please allow microphone access in your browser settings to record audio.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else if (error.name === 'NotSupportedError') {
        setError('Audio recording is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Edge.');
      } else {
        setError(`Failed to start recording: ${error.message}. Please try again.`);
      }
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
        }
      setIsRecording(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } catch (error) {
        console.error('Error stopping recording:', error);
        setError('Error stopping recording. Please try again.');
      }
    }
  }, [isRecording]);

  const clearRecording = useCallback(() => {
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingTime(0);
    setLiveTranscription('');
    audioChunksRef.current = [];
    if (transcriptionIntervalRef.current) {
      clearInterval(transcriptionIntervalRef.current);
      transcriptionIntervalRef.current = null;
    }
  }, [audioUrl]);

  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Validation function
  const validateTextInput = useCallback((text) => {
    const errors = [];
    const trimmed = text || '';
    const wordCount = trimmed.trim().split(/\s+/).filter(word => word.length > 0).length;
    const hasLetter = /[A-Za-z]/.test(trimmed);
    if (!hasLetter) {
      errors.push('Text must include at least one alphabetic character (A-Z).');
    }
    if (wordCount < 50) {
      errors.push(`Minimum 50 words required (current: ${wordCount} words)`);
    }
    return errors;
  }, []);

  // Project info validation
  const validateProjectInfo = useCallback(() => {
    const errors = [];
    const titlePattern = /^[A-Za-z][A-Za-z0-9\s\-_,'.]*$/;
    const authorPattern = /^[A-Za-z][A-Za-z\s\-']*$/;

    if (!projectInfo.title.trim()) {
      errors.push('Project Title cannot be empty.');
    } else if (!titlePattern.test(projectInfo.title.trim())) {
      errors.push('Project Title must start with a letter and include only letters, numbers, spaces, - _ , \' . characters.');
    }

    if (!projectInfo.author.trim()) {
      errors.push('Author cannot be empty.');
    } else if (!authorPattern.test(projectInfo.author.trim())) {
      errors.push('Author must start with a letter and include only letters, spaces, and -\'.');
    }

    return errors;
  }, [projectInfo]);

  // Live-validate project info for immediate feedback
  useEffect(() => {
    setProjectInfoErrors(validateProjectInfo());
  }, [projectInfo, validateProjectInfo]);

  // Handle text input change with validation
  const handleTextInputChange = useCallback((e) => {
    const newText = e.target.value;
    setTextInput(newText);
    
    if (newText.trim()) {
      const errors = validateTextInput(newText);
      setValidationErrors(errors);
    } else {
      setValidationErrors([]);
    }
  }, [validateTextInput]);

  // Validate input before processing
  const validateInput = useCallback((inputText) => {
    const errors = [];
    const warnings = [];

    if (!inputText || !inputText.trim()) {
      errors.push('Text input is required');
      return { valid: false, errors, warnings };
    }

    // Check for prompt injection
    const injectionCheck = detectPromptInjection(inputText);
    if (injectionCheck.hasInjection) {
      errors.push('Input contains suspicious patterns that could interfere with processing. Please remove any instruction-like text.');
      return { valid: false, errors, warnings, securityIssue: true };
    }

    // Check word count
    const words = inputText.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length < minWords) {
      errors.push(`Minimum ${minWords} words required (current: ${words.length} words)`);
    }

    // Check for alphabetic characters
    if (!/[A-Za-z]/.test(inputText)) {
      errors.push('Text must include at least one alphabetic character (A-Z)');
    }

    // Check length
    if (inputText.length > maxChars) {
      warnings.push(`Input is very long (${inputText.length} characters). It will be truncated to ${maxChars} characters.`);
    }

    // Check for code blocks (warning, not error)
    if (/```/.test(inputText)) {
      warnings.push('Code blocks detected. They will be removed during processing.');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }, [detectPromptInjection, minWords, maxChars]);

  const generateSRSFromAudioDirect = useCallback(async () => {
    if (inputType !== 'audio') {
      setError('Switch to audio mode and record/upload audio first.');
      return;
    }
    if (!audioBlob || audioBlob.size === 0) {
      setError('No audio available. Please record first.');
      return;
    }

    setIsGeneratingDirectSRS(true);
    setLastSRSAvailable(false);
    setError(null);
    setValidationErrors([]);

    try {
      let extension = 'webm';
      if (audioBlob.type.includes('mp4')) extension = 'm4a';
      else if (audioBlob.type.includes('ogg')) extension = 'ogg';
      else if (audioBlob.type.includes('wav')) extension = 'wav';

      const formData = new FormData();
      formData.append('audio', audioBlob, `recording.${extension}`);
      formData.append('project_info', JSON.stringify(projectInfo));

      const response = await axios.post(config.API_ENDPOINTS.GENERATE_SRS_FROM_AUDIO, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 240000,
      });

      if (response.data) {
        onSRSGenerated(response.data);
        setResults(response.data);
        if (setCurrentResults) setCurrentResults(response.data);
        setLastSRSAvailable(true);
      }
    } catch (err) {
      console.error('Direct SRS generation error:', err);
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('Request timed out. Please try a shorter recording or try again.');
      } else {
        setError(err.response?.data?.error || 'Failed to generate SRS from audio.');
      }
    } finally {
      setIsGeneratingDirectSRS(false);
    }
  }, [inputType, audioBlob, projectInfo, onSRSGenerated, setCurrentResults]);

  // Direct SRS generation from uploaded file (txt/pdf)
  const generateSRSFromFileDirect = useCallback(async () => {
    if (uploadedFiles.length === 0) {
      setError('Please upload a txt or pdf file first.');
      return;
    }
    const firstFile = uploadedFiles[0].file;
    const extension = firstFile.name.toLowerCase().split('.').pop();
    if (extension !== 'txt' && extension !== 'pdf') {
      setError('Unsupported file type. Please upload .txt or .pdf.');
      return;
    }

    setIsGeneratingDirectSRS(true);
    setLastSRSAvailable(false);
    setError(null);
    setValidationErrors([]);

    try {
      const formData = new FormData();
      formData.append('file', firstFile);
      formData.append('project_info', JSON.stringify(projectInfo));

      const response = await axios.post(config.API_ENDPOINTS.GENERATE_SRS_FROM_FILE, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000,
      });

      if (response.data) {
        onSRSGenerated(response.data);
        setResults(response.data);
        if (setCurrentResults) setCurrentResults(response.data);
        setLastSRSAvailable(true);
      }
    } catch (err) {
      console.error('Direct SRS from file error:', err);
      setError(err.response?.data?.error || 'Failed to generate SRS from file.');
    } finally {
      setIsGeneratingDirectSRS(false);
    }
  }, [uploadedFiles, projectInfo, onSRSGenerated, setCurrentResults]);

  const processRequirements = useCallback(async () => {
    setIsProcessing(true);
    setLastSRSAvailable(false);
    setError(null);
    setValidationErrors([]);
    setProcessingProgress(0);

    const currentProjectErrors = validateProjectInfo();
    if (currentProjectErrors.length > 0) {
      setProjectInfoErrors(currentProjectErrors);
      setError('Please fix project information errors before processing');
      setIsProcessing(false);
      return;
    }

    // Simulate progress for better UX
    progressIntervalRef.current = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 10;
      });
    }, 500);

    try {
      // Validate and sanitize text input before processing
      if (inputType === 'text' && textInput.trim()) {
        const validation = validateInput(textInput);
        if (!validation.valid) {
          setValidationErrors(validation.errors);
          if (validation.securityIssue) {
            setError('Security: Input contains suspicious patterns. Please remove any instruction-like text.');
          } else {
          setError('Please fix validation errors before processing');
          }
          setIsProcessing(false);
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          return;
        }
        
        // Show warnings if any
        if (validation.warnings.length > 0) {
          console.warn('Input warnings:', validation.warnings);
        }
      }

      let response;

      if (inputType === 'text' && textInput.trim()) {
        // Sanitize input before sending to backend
        const sanitizedContent = sanitizeInput(textInput);
        response = await axios.post(config.API_ENDPOINTS.PROCESS_SINGLE, {
          type: 'text',
          content: sanitizedContent,
          project_info: projectInfo
        });
      } else if (inputType === 'audio' && audioBlob) {
        // Validate audio blob exists and has content
        if (!audioBlob || audioBlob.size === 0) {
          setError('Audio recording is empty. Please record again.');
          setIsProcessing(false);
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          return;
        }

        // Determine file extension based on MIME type
        let extension = 'webm';
        if (audioBlob.type.includes('mp4')) {
          extension = 'm4a';
        } else if (audioBlob.type.includes('ogg')) {
          extension = 'ogg';
        } else if (audioBlob.type.includes('wav')) {
          extension = 'wav';
        }

        const formData = new FormData();
        formData.append('audio', audioBlob, `recording.${extension}`);
        formData.append('project_info', JSON.stringify(projectInfo));

        console.log('Sending audio to backend:', {
          blobSize: audioBlob.size,
          blobType: audioBlob.type,
          extension: extension,
          projectInfo: projectInfo
        });

        response = await axios.post(config.API_ENDPOINTS.PROCESS_AUDIO, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          timeout: 240000, // 4 minutes timeout for longer recordings
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const uploadProgress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              // Update progress to show upload progress (0-50%) then processing (50-100%)
              setProcessingProgress(Math.min(50, uploadProgress));
            }
          }
        });
      } else if (uploadedFiles.length > 0) {
        // Validate all uploaded files are txt or pdf
        const invalidFiles = uploadedFiles.filter(({ file }) => {
          const extension = file.name.toLowerCase().split('.').pop();
          return extension !== 'txt' && extension !== 'pdf';
        });

        if (invalidFiles.length > 0) {
          const invalidNames = invalidFiles.map(({ file }) => file.name).join(', ');
          setError(`Invalid file type(s): ${invalidNames}. Only .txt and .pdf files are accepted.`);
          setIsProcessing(false);
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          return;
        }

        const formData = new FormData();
        uploadedFiles.forEach(({ file }) => {
          formData.append('files', file);
        });
        formData.append('project_info', JSON.stringify(projectInfo));

        response = await axios.post(config.API_ENDPOINTS.PROCESS_BATCH, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      } else {
        throw new Error('Please provide text input, record audio, or upload files');
      }

      setProcessingProgress(100);
      setResults(response.data);
      onResultsGenerated(response.data);
      
      // Save input to storage
      try {
        await saveInput({
          projectInfo: projectInfo,
          inputType: inputType,
          content: inputType === 'text' ? textInput : (inputType === 'audio' ? 'Audio recording' : 'File upload'),
          fileNames: inputType === 'file' ? uploadedFiles.map(({ file }) => file.name) : [],
          results: response.data,
          // Save audio data if available
          audioBlob: inputType === 'audio' ? audioBlob : null,
          transcription: inputType === 'audio' ? (response.data?.original_text || liveTranscription || '') : '',
          liveTranscription: inputType === 'audio' ? liveTranscription : ''
        });
      } catch (error) {
        console.error('Error saving input to storage:', error);
      }
      
      // Don't auto-generate SRS - let user click "Generate SRS" button on results page

    } catch (err) {
      console.error('Processing error:', err);
      
      // Handle network errors
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('Request timed out. The audio file might be too large or the server is taking too long to process. Please try again with a shorter recording.');
      } else if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        setError(`Network error: Could not connect to the server. Please ensure the backend server is running on ${config.API_BASE_URL}`);
      } else if (!err.response) {
        setError(`Connection error: ${err.message || 'Unable to reach the server. Please check if the backend is running.'}`);
      } else if (err.response?.data?.validation_errors) {
        const validationData = err.response.data.validation_errors;
        
        if (Array.isArray(validationData) && validationData.length > 0) {
          if (validationData[0].file && validationData[0].errors) {
            const errorMessages = validationData.map(item => 
              `${item.file}: ${item.errors.join(', ')}`
            );
            setError('Validation failed for uploaded files');
            setValidationErrors(errorMessages);
          } else {
            setError(err.response.data.error || 'Audio content validation failed');
            setValidationErrors(validationData);
          }
        } else if (typeof validationData === 'string') {
          setError(err.response.data.error || 'Validation failed');
          setValidationErrors([validationData]);
        }
      } else {
        // Show detailed error message from backend
        const errorMsg = err.response?.data?.error || err.message || 'An error occurred while processing';
        setError(errorMsg);
        
        // If there's transcribed text, show it
        if (err.response?.data?.transcribed_text) {
          console.log('Transcribed text:', err.response.data.transcribed_text);
        }
      }
    } finally {
      setIsProcessing(false);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setTimeout(() => setProcessingProgress(0), 1000);
    }
  }, [inputType, textInput, audioBlob, uploadedFiles, projectInfo, validateTextInput, onResultsGenerated]);

  const generateSRS = useCallback(async (resultsData) => {
    try {
      let requirementsArray;
      
      if (Array.isArray(resultsData)) {
        requirementsArray = resultsData;
      } else if (resultsData.results && Array.isArray(resultsData.results)) {
        requirementsArray = resultsData.results;
      } else if (resultsData.status) {
        requirementsArray = [resultsData];
      } else {
        requirementsArray = [resultsData];
      }
      
      const response = await axios.post(config.API_ENDPOINTS.GENERATE_SRS, {
        results: requirementsArray,
        project_info: projectInfo
      });
      
      onSRSGenerated(response.data);
    } catch (err) {
      console.error('SRS generation failed:', err);
    }
  }, [projectInfo, onSRSGenerated]);

  const canProcess = useMemo(() => {
    if (isProcessing) return false;
    if (projectInfoErrors.length > 0) return false;
    if (inputType === 'text' && (!textInput.trim() || validationErrors.length > 0)) return false;
    if (inputType === 'audio' && !audioBlob) return false;
    if (inputType === 'file' && uploadedFiles.length === 0) return false;
    return true;
  }, [isProcessing, inputType, textInput, validationErrors, audioBlob, uploadedFiles, projectInfoErrors]);

  return (
    <div className="max-w-5xl mx-auto animate-fade-in" role="main" aria-labelledby="input-heading">
      <div className={`relative rounded-2xl overflow-hidden border ${isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-white/90'}`}>
        <div className="relative rounded-2xl p-6 md:p-8">
          <div className="flex items-center justify-center mb-8">
            <h2 
              id="input-heading"
              className={`text-2xl md:text-3xl lg:text-4xl font-extrabold text-center ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
            >
              Input Requirements
            </h2>
          </div>

          {/* Project Information */}
          <section className="mb-8" aria-labelledby="project-info-heading">
            <h3 id="project-info-heading" className={`text-lg md:text-xl font-semibold mb-4 flex items-center space-x-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              <FileText className="h-5 w-5" aria-hidden="true" />
              <span>Project Information</span>
            </h3>
            <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="project-title" className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Project Title
                </label>
                {(() => {
                  const titleError = projectInfoErrors.find(e => e.toLowerCase().includes('project title'));
                  return (
                    <>
                <input
                  id="project-title"
                  type="text"
                  value={projectInfo.title}
                  onChange={(e) => setProjectInfo(prev => ({ ...prev, title: e.target.value }))}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-opacity-80 transition-all duration-200 ${
                          titleError
                            ? `${isDark ? 'border-red-400/70 bg-red-900/15 text-slate-100' : 'border-red-300 bg-red-50 text-slate-900'}`
                            : `${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`
                        }`}
                  placeholder="Enter project title"
                  aria-label="Project title"
                        aria-invalid={!!titleError}
                        pattern="^[A-Za-z][A-Za-z0-9\\s\\-_,'.]*$"
                        title="Letters required; allow letters, numbers, spaces, and -_,'."
                      />
                      {titleError && (
                        <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> {titleError}
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
              <div>
                <label htmlFor="project-author" className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Author
                </label>
                {(() => {
                  const authorError = projectInfoErrors.find(e => e.toLowerCase().includes('author'));
                  return (
                    <>
                <input
                  id="project-author"
                  type="text"
                  value={projectInfo.author}
                  onChange={(e) => setProjectInfo(prev => ({ ...prev, author: e.target.value }))}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-opacity-80 transition-all duration-200 ${
                          authorError
                            ? `${isDark ? 'border-red-400/70 bg-red-900/15 text-slate-100' : 'border-red-300 bg-red-50 text-slate-900'}`
                            : `${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`
                        }`}
                  placeholder="Enter author name"
                  aria-label="Author name"
                        aria-invalid={!!authorError}
                        pattern="^[A-Za-z][A-Za-z\\s\\-'.]*$"
                        title="Letters required; allow letters, spaces, and -'."
                      />
                      {authorError && (
                        <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> {authorError}
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </section>

          {/* Input Type Selection */}
          <section className="mb-8" aria-labelledby="input-method-heading">
            <h3 id="input-method-heading" className={`text-lg md:text-xl font-semibold mb-4 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              Input Method
            </h3>
            <div className="flex flex-wrap gap-3 mb-6" role="tablist" aria-label="Input method selection">
              {[
                { type: 'text', label: 'Text Input', icon: FileText },
                { type: 'audio', label: 'Audio Recording', icon: Mic },
                { type: 'file', label: 'File Upload', icon: Upload }
              ].map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => setInputType(type)}
                  role="tab"
                  aria-selected={inputType === type}
                  aria-controls={`${type}-panel`}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    inputType === type 
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white scale-105 shadow-md' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-102'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Text Input Panel */}
            {inputType === 'text' && (
              <div id="text-panel" role="tabpanel" aria-labelledby="text-tab" className="animate-slide-up">
                <label htmlFor="requirements-text" className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Requirements Text
                </label>
                <textarea
                  id="requirements-text"
                  value={textInput}
                  onChange={handleTextInputChange}
                  rows={10}
                  className={`w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 resize-y ${
                    validationErrors.length > 0 
                      ? `${isDark ? 'border-red-400/70 bg-red-900/20 text-slate-100' : 'border-red-300 bg-red-50 text-slate-900'}`
                      : `${isDark ? 'border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-600' : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300'}`
                  }`}
                  placeholder="Enter your requirements here..."
                  aria-label="Requirements text input"
                  aria-invalid={validationErrors.length > 0}
                  aria-describedby={validationErrors.length > 0 ? 'validation-errors' : undefined}
                />

                {/* Progress bar */}
                <div className={`mt-3 h-2.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} role="progressbar" aria-valuenow={progressPct} aria-valuemin="0" aria-valuemax="100">
                  <div
                    className={`h-full transition-all duration-500 ease-out progress-animated`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                {/* Live counters and badges */}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <span 
                    className={`inline-flex items-center px-2.5 py-1 rounded-full border transition-colors duration-200 ${
                      hasLetter 
                        ? `${isDark ? 'bg-emerald-900/30 text-emerald-200 border-emerald-600/50' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`
                        : `${isDark ? 'bg-red-900/30 text-red-200 border-red-600/50' : 'bg-red-50 text-red-700 border-red-200'}`
                    }`}
                    aria-label={hasLetter ? 'Letters detected' : 'Add at least one letter'}
                  >
                    {hasLetter ? '✓ Letters detected' : '✗ Add at least one letter'}
                  </span>
                  <span 
                    className={`inline-flex items-center px-2.5 py-1 rounded-full border transition-colors duration-200 ${
                      wordCount >= minWords 
                        ? `${isDark ? 'bg-emerald-900/30 text-emerald-200 border-emerald-600/50' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`
                        : `${isDark ? 'bg-amber-900/30 text-amber-200 border-amber-600/50' : 'bg-amber-50 text-amber-700 border-amber-200'}`
                    }`}
                    aria-label={`${wordCount} out of ${minWords} words required`}
                  >
                    {wordCount} / {minWords} words
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full border ${isDark ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-slate-50 text-slate-700 border-slate-200'}`} aria-label={`${charCount} characters`}>
                    {charCount} characters
                  </span>
                </div>
                
                {/* Validation Guidelines */}
                <div className={`mt-3 text-sm p-3 rounded-lg border ${isDark ? 'text-slate-200 bg-slate-800 border-slate-700' : 'text-slate-600 bg-sky-50 border-sky-100'}`}>
                  <p className="font-medium mb-1 flex items-center space-x-1">
                    <Info className="h-4 w-4" aria-hidden="true" />
                    <span>Requirements:</span>
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs ml-5">
                    <li>Minimum 50 words required</li>
                    <li>Numbers and symbols allowed, but include at least one letter</li>
                  </ul>
                </div>

                {/* Quick templates */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Quick Templates</p>
                    <button
                      type="button"
                      onClick={() => setShowHelp(!showHelp)}
                      className="text-xs text-indigo-500 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-2 py-1 transition-colors"
                      aria-expanded={showHelp}
                      aria-controls="help-text"
                    >
                      {showHelp ? 'Hide tips' : 'Show tips'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {templates.map((t) => (
                      <button
                        key={t.label}
                        type="button"
                        onClick={() => {
                          setTextInput(t.text);
                          setError(null);
                          setValidationErrors([]);
                        }}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                          isDark 
                            ? 'bg-slate-900 text-slate-200 border-slate-700 hover:border-sky-400 hover:bg-slate-800'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-sky-400 hover:bg-sky-50'
                        }`}
                        aria-label={`Use ${t.label} template`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {showHelp && (
                    <div id="help-text" className={`mt-3 p-3 rounded-lg text-xs animate-slide-up border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-sky-50 border-sky-100 text-sky-800'}`}>
                      Aim for clear, complete sentences. Mention actors (users/admins), actions, constraints (security/performance), and any integrations. Avoid ambiguous terms like "fast" or "user-friendly" without specifics.
                    </div>
                  )}
                </div>

                {/* Validation Errors */}
                {validationErrors.length > 0 && (
                  <div id="validation-errors" className="mt-3 space-y-2" role="alert" aria-live="polite">
                    {validationErrors.map((error, index) => (
                      <div key={index} className="flex items-start space-x-2 text-sm text-red-600 animate-slide-up">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                        <span>{error}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Audio Recording Panel */}
            {inputType === 'audio' && (
              <div id="audio-panel" role="tabpanel" aria-labelledby="audio-tab" className="animate-slide-up">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Audio Recording
                </label>
                
                {/* Validation Guidelines */}
                <div className="mb-4 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <p className="font-medium mb-1 flex items-center space-x-1">
                    <Info className="h-4 w-4" aria-hidden="true" />
                    <span>Recording Requirements:</span>
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs ml-5">
                    <li>Minimum 50 words required</li>
                    <li>Speak clearly and at a moderate pace</li>
                  </ul>
                </div>
                
                {!audioBlob ? (
                  <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50/50 hover:border-gray-400 transition-colors duration-200">
                    <div className={`mb-4 transition-transform duration-300 ${isRecording ? 'animate-pulse scale-110' : ''}`}>
                      <Mic className={`h-16 w-16 mx-auto ${isRecording ? 'text-red-500' : 'text-gray-400'}`} aria-hidden="true" />
                    </div>
                    <p className="text-lg text-gray-600 mb-4 font-medium">
                      {isRecording ? (
                        <span className="flex items-center justify-center space-x-2">
                          <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                          <span>Recording... {formatTime(recordingTime)}</span>
                        </span>
                      ) : (
                        'Click to start recording'
                      )}
                    </p>
                    <div className="flex justify-center space-x-4">
                      {!isRecording ? (
                        <button
                          onClick={startRecording}
                          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                          aria-label="Start audio recording"
                        >
                          <Mic className="h-5 w-5" aria-hidden="true" />
                          <span>Start Recording</span>
                        </button>
                      ) : (
                        <button
                          onClick={stopRecording}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                          aria-label="Stop audio recording"
                        >
                          <Square className="h-5 w-5" aria-hidden="true" />
                          <span>Stop Recording</span>
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-4">
                      Record your requirements by speaking into your microphone
                    </p>
                    
                    {/* Live Transcription Display (visible during and after recording) */}
                    {(isRecording || liveTranscription) && (
                      <div className={`mt-6 p-4 rounded-lg border-2 ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-blue-200'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <label className={`text-sm font-semibold flex items-center space-x-2 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                            <Sparkles className={`h-4 w-4 ${isTranscribing ? 'animate-pulse text-blue-400' : 'text-gray-400'}`} aria-hidden="true" />
                            <span>Live Transcription</span>
                            {isTranscribing && (
                              <span className="text-xs text-blue-400 animate-pulse">Updating...</span>
                            )}
                            {!isRecording && liveTranscription && (
                              <span className="text-xs text-emerald-400">Last recorded transcription</span>
                            )}
                          </label>
                        </div>
                        <div className={`min-h-[100px] max-h-[200px] overflow-y-auto p-3 rounded border ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-gray-50 border-gray-200 text-slate-900'}`}>
                          {liveTranscription ? (
                            <p className="text-base leading-relaxed whitespace-pre-wrap font-medium">{liveTranscription}</p>
                          ) : (
                            <p className={`text-sm italic ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                              Transcription will appear here as you speak...
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-green-50 p-6 rounded-lg border border-green-200 animate-slide-up">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-green-100 rounded-full">
                          <CheckCircle className="h-6 w-6 text-green-600" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="font-medium text-green-900">Recording Complete</p>
                          <p className="text-sm text-green-700">Duration: {formatTime(recordingTime)}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {audioUrl && audioBlob && (
                          <audio controls className="mr-2" aria-label="Audio playback">
                            <source src={audioUrl} type={audioBlob.type || 'audio/webm'} />
                            Your browser does not support the audio element.
                          </audio>
                        )}
                        <button
                          onClick={clearRecording}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                          aria-label="Clear recording"
                        >
                          <X className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-green-700">
                      Your audio recording is ready for processing. Click "Process Requirements" to analyze it.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* File Upload Panel */}
            {inputType === 'file' && (
              <div id="file-panel" role="tabpanel" aria-labelledby="file-tab" className="animate-slide-up">
                {/* Validation Guidelines */}
                <div className="mb-4 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <p className="font-medium mb-1 flex items-center space-x-1">
                    <Info className="h-4 w-4" aria-hidden="true" />
                    <span>File Content Requirements:</span>
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs ml-5">
                    <li>Minimum 50 words required per file</li>
                    <li>Supported formats: .txt, .pdf</li>
                  </ul>
                </div>
                
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${
                    isDragActive 
                      ? 'border-blue-500 bg-blue-50 scale-102' 
                      : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-label="File upload area"
                >
                  <input {...getInputProps()} aria-label="File input" />
                  <Upload className={`h-12 w-12 mx-auto mb-4 transition-colors duration-200 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} aria-hidden="true" />
                  {isDragActive ? (
                    <p className="text-lg text-blue-600 font-medium">Drop the files here...</p>
                  ) : (
                    <div>
                      <p className="text-lg text-gray-600 mb-2 font-medium">
                        Drag & drop files here, or click to select
                      </p>
                      <p className="text-sm text-gray-500">
                        Supports: .txt, .pdf
                      </p>
                    </div>
                  )}
                </div>

                {/* Uploaded Files List */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-4 space-y-2 animate-slide-up">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Uploaded Files ({uploadedFiles.length}):</h4>
                    {uploadedFiles.map(({ file, id, status }) => {
                      const extension = file.name.toLowerCase().split('.').pop();
                      const isValidType = extension === 'txt' || extension === 'pdf';
                      
                      return (
                        <div key={id} className={`flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 transition-colors duration-200 ${
                          isValidType ? 'bg-gray-50' : 'bg-red-50 border border-red-200'
                        }`}>
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                            {extension === 'pdf' ? (
                              <FileText className="h-4 w-4 text-red-500 flex-shrink-0" aria-hidden="true" />
                          ) : (
                            <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" aria-hidden="true" />
                          )}
                            <span className={`text-sm font-medium truncate ${!isValidType ? 'text-red-600' : ''}`} title={file.name}>
                              {file.name}
                              {!isValidType && <span className="ml-2 text-xs text-red-500">(Invalid type)</span>}
                            </span>
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          onClick={() => removeFile(id)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 flex-shrink-0"
                          aria-label={`Remove ${file.name}`}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg animate-slide-up" role="alert" aria-live="assertive">
              <div className="flex items-center space-x-2 mb-2">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" aria-hidden="true" />
                <span className="text-red-700 font-semibold">{error}</span>
              </div>
              {validationErrors.length > 0 && (
                <div className="mt-3 ml-7 space-y-2">
                  {validationErrors.map((err, index) => (
                    <div key={index} className="text-sm text-red-600">
                      • {err}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Processing Progress */}
          {isProcessing && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg animate-slide-up">
              <div className="flex items-center space-x-3 mb-3">
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin" aria-hidden="true" />
                <span className="text-blue-700 font-medium">Processing requirements...</span>
              </div>
              <div className="w-full bg-blue-100 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${processingProgress}%` }}
                  role="progressbar"
                  aria-valuenow={Math.round(processingProgress)}
                  aria-valuemin="0"
                  aria-valuemax="100"
                />
              </div>
              <p className="text-xs text-blue-600 mt-2">{Math.round(processingProgress)}% complete</p>
            </div>
          )}

          {/* Process Button */}
          <div className="text-center">
            <button
              onClick={processRequirements}
              disabled={!canProcess}
              className="bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-600 hover:via-indigo-600 hover:to-purple-700 disabled:from-gray-400 disabled:via-gray-400 disabled:to-gray-500 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center space-x-2 mx-auto shadow-md hover:shadow-xl hover:scale-105 disabled:hover:scale-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2"
              aria-label="Process requirements"
              aria-busy={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" aria-hidden="true" />
                  <span>Process Requirements</span>
                </>
              )}
            </button>
            {inputType === 'audio' && audioBlob && audioBlob.size > 0 && (
              <button
                onClick={generateSRSFromAudioDirect}
                disabled={isGeneratingDirectSRS}
                className="mt-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600 hover:from-emerald-600 hover:via-teal-600 hover:to-blue-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center space-x-2 mx-auto shadow-md hover:shadow-xl hover:scale-105 disabled:from-gray-400 disabled:via-gray-400 disabled:to-gray-500 disabled:hover:scale-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
                aria-label="Generate SRS directly from audio"
                aria-busy={isGeneratingDirectSRS}
              >
                {isGeneratingDirectSRS ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    <span>Generating SRS...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" aria-hidden="true" />
                    <span>Generate SRS</span>
                  </>
                )}
              </button>
            )}
            {uploadedFiles.length > 0 && (
              <button
                onClick={generateSRSFromFileDirect}
                disabled={isGeneratingDirectSRS}
                className="mt-4 bg-gradient-to-r from-indigo-500 via-blue-600 to-cyan-500 hover:from-indigo-600 hover:via-blue-700 hover:to-cyan-600 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center space-x-2 mx-auto shadow-md hover:shadow-xl hover:scale-105 disabled:from-gray-400 disabled:via-gray-400 disabled:to-gray-500 disabled:hover:scale-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
                aria-label="Generate SRS directly from file"
                aria-busy={isGeneratingDirectSRS}
              >
                {isGeneratingDirectSRS ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    <span>Generating SRS...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" aria-hidden="true" />
                    <span>Generate SRS (File)</span>
                  </>
                )}
              </button>
            )}
            {lastSRSAvailable && !isGeneratingDirectSRS && (
              <button
                type="button"
                onClick={() => navigate('/srs')}
                className="mt-4 inline-flex items-center justify-center px-6 py-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-all duration-200 shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
              >
                <FileText className="h-5 w-5 mr-2" aria-hidden="true" />
                View SRS
              </button>
            )}
          </div>

          {/* Results Preview */}
          {results && (
            <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg animate-slide-up" role="status" aria-live="polite">
              <div className="flex items-center space-x-2 mb-4">
                <CheckCircle className="h-5 w-5 text-green-500" aria-hidden="true" />
                <h3 className="text-lg font-semibold text-green-800">Processing Complete!</h3>
              </div>
              <p className="text-green-700">
                Requirements processed successfully. Navigate to Results page to generate SRS.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequirementsInput;
