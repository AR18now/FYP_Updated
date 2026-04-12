import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Mic, X, CheckCircle, AlertCircle, AlertTriangle, Square, Sparkles, Info, Loader2, Wand2 } from 'lucide-react';
import axios from 'axios';
import { saveInput, saveSRS } from '../utils/storage';
import config from '../config';
import { useTheme } from '../context/ThemeContext';
import { getApiErrorMessage } from '../utils/apiErrors';

const RequirementsInput = ({ onResultsGenerated, onSRSGenerated, theme: themeProp, setCurrentResults = () => {} }) => {
  const { theme: themeFromContext } = useTheme();
  const theme = themeProp ?? themeFromContext ?? 'light';
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
  /** Live debounced hint while typing: instruction-hijack lookalikes (not for normal “alerts/notifications” reqs). */
  const [liveInjectionHint, setLiveInjectionHint] = useState(null);
  const [projectInfoErrors, setProjectInfoErrors] = useState([]);
  const [showHelp, setShowHelp] = useState(false);
  /** Clarification / live copilot — off by default to keep the flow simple */
  const [optionalToolsOpen, setOptionalToolsOpen] = useState(false);
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
  const [clarification, setClarification] = useState(null);
  const [isClarifying, setIsClarifying] = useState(false);
  const [refinedInputText, setRefinedInputText] = useState('');
  const [followupAnswers, setFollowupAnswers] = useState({});
  const [copilotData, setCopilotData] = useState(null);
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);
  const [skippedSuggestions, setSkippedSuggestions] = useState({});
  const [copilotAnswer, setCopilotAnswer] = useState('');
  const [copilotThread, setCopilotThread] = useState([]);
  const [backendReady, setBackendReady] = useState(true);
  const [backendStatusText, setBackendStatusText] = useState('Checking backend...');
  const navigate = useNavigate();
  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const transcriptionIntervalRef = useRef(null);
  const audioChunksRef = useRef([]);
  const injectionCheckTimerRef = useRef(null);

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

  const unresolvedClarificationItems = useMemo(() => {
    if (!clarification) return 0;
    const ambiguities = clarification.ambiguities?.length || 0;
    const missing = clarification.add_suggestions?.length || 0;
    return ambiguities + missing;
  }, [clarification]);

  // High-confidence only — must stay aligned with api_server SUSPICIOUS_PATTERNS (narrow list).
  const injectionPatternsCritical = useMemo(
    () => [
      /\bignore\s+(?:all\s+)?previous\s+instructions?\b/i,
      /\bignore\s+all\s+instructions?\b/i,
      /\bdisregard\s+(?:all\s+)?(?:previous\s+)?instructions?\b/i,
      /\bremove\s+(?:all\s+)?previous\s+instructions?\b/i,
      /\bdelete\s+(?:all\s+)?previous\s+instructions?\b/i,
      /\bdiscard\s+(?:all\s+)?previous\s+instructions?\b/i,
      /\b(?:clear|erase)\s+all\s+previous\s+instructions?\b/i,
      /\breplace\s+(?:all\s+)?previous\s+instructions?\b/i,
      /\bdo\s+not\s+follow\s+(?:any\s+)?(?:previous\s+)?instructions?\b/i,
      /\bforget\s+all\s+(?:previous\s+)?instructions?\b/i,
      /\bforget\s+everything\b/i,
      /\bprompt\s+injection\b/i,
      /\bignore\s+the\s+prompt\b/i,
      /\b(?:new|updated)\s+instructions\s*:\s*/i,
      /\bact\s+as\s+if\b/i,
      /\bpretend\s+to\s+be\b/i,
      /\bpretend\s+you\s+are\b/i,
      /\broleplay\s+as\b/i,
      /<\|[^|]+\|>/,
      /\[INST\].*?\[\/INST\]/i,
      /<\|im_start\|>.*?<\|im_end\|>/i,
      /<\|(user|assistant|system|eot_id)\|>/i,
    ],
    []
  );

  // Soft hints only (never block submit): wording that often appears in hijacks but also rarely in real SRS.
  const injectionPatternsCaution = useMemo(
    () => [
      /\bfrom\s+now\s+on\b/i,
      /\byou\s+are\s+now\b/i,
      /\boverride\s+(?:the\s+)?(?:previous|system)\b/i,
      /\b(?:system|hidden)\s+prompt\b/i,
    ],
    []
  );

  const matchesAnyPattern = useCallback((text, patterns) => {
    if (!text || !patterns?.length) return false;
    return patterns.some((re) => {
      re.lastIndex = 0;
      return re.test(text);
    });
  }, []);

  /**
   * Same as server-side blocking list — used for submit validation.
   */
  const detectPromptInjection = useCallback(
    (text) => {
      if (!text) return { hasInjection: false, patterns: [] };
      const detectedPatterns = [];
      for (const pattern of injectionPatternsCritical) {
        pattern.lastIndex = 0;
        if (pattern.test(text)) {
          detectedPatterns.push(pattern.toString());
        }
      }
      return {
        hasInjection: detectedPatterns.length > 0,
        patterns: detectedPatterns,
      };
    },
    [injectionPatternsCritical]
  );

  const classifyInjectionWhileTyping = useCallback(
    (text) => {
      if (!text || !text.trim()) return null;
      if (matchesAnyPattern(text, injectionPatternsCritical)) {
        return {
          level: 'critical',
          title: 'Blocked: instruction-hijack wording',
          body:
            'Phrases such as “ignore/remove/delete all previous instructions”, role-play orders, or model tokens (e.g. <|assistant|>) are not allowed. Processing is disabled until you delete this wording. Describe only what the product must do—without telling the AI to ignore its rules.',
        };
      }
      if (matchesAnyPattern(text, injectionPatternsCaution)) {
        return {
          level: 'caution',
          title: 'Wording resembles common hijack phrases',
          body:
            'Phrases like “from now on” or “system prompt” sometimes appear in attacks. If you are writing legitimate requirements—including a system that sends alerts, notifications, or security warnings—you can usually ignore this. We only block clear hijack patterns and special tokens when you submit.',
        };
      }
      return null;
    },
    [injectionPatternsCritical, injectionPatternsCaution, matchesAnyPattern]
  );

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

  // Backend health probe to reduce failed actions during testing.
  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      try {
        const res = await axios.get(config.API_ENDPOINTS.HEALTH, { timeout: 8000 });
        if (cancelled) return;
        const ok = String(res?.data?.status || '').toLowerCase() === 'healthy';
        setBackendReady(ok);
        setBackendStatusText(ok ? 'Backend connected' : 'Backend responded with unhealthy status');
      } catch (e) {
        if (cancelled) return;
        setBackendReady(false);
        setBackendStatusText('Backend unreachable. Start api_server.py and retry.');
      }
    };
    probe();
    const timer = setInterval(probe, 20000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const loadLiveCopilotHints = useCallback(async () => {
    if (!textInput || textInput.trim().length < 28) {
      setError('Add a bit more text (28+ characters) before loading suggestions.');
      return;
    }
    setError(null);
    try {
      setIsCopilotLoading(true);
      const response = await axios.post(config.API_ENDPOINTS.CLARIFICATION_COPILOT, {
        content: textInput,
      });
      setCopilotData(response.data);
      setCopilotThread([]);
      setCopilotAnswer('');
      setSkippedSuggestions({});
    } catch (err) {
      console.error('Live copilot failed:', err);
      setError(getApiErrorMessage(err, 'Could not load suggestions.'));
    } finally {
      setIsCopilotLoading(false);
    }
  }, [textInput]);

  const nextCopilotTurn = useCallback(async () => {
    if (!copilotAnswer.trim()) return;
    if (!copilotData) return;
    try {
      setIsCopilotLoading(true);
      const response = await axios.post(config.API_ENDPOINTS.CLARIFICATION_COPILOT_TURN, {
        content: textInput,
        latest_answer: copilotAnswer.trim(),
        question_queue: copilotData.question_queue || []
      });
      setCopilotThread((prev) => [
        ...prev,
        { role: 'assistant', text: copilotData?.copilot?.question || '' },
        { role: 'user', text: copilotAnswer.trim() }
      ]);
      setCopilotData(response.data);
      setCopilotAnswer('');
      setSkippedSuggestions({});
    } catch (err) {
      console.error('Copilot turn failed:', err);
      alert(getApiErrorMessage(err, 'Could not process copilot turn.'));
    } finally {
      setIsCopilotLoading(false);
    }
  }, [copilotAnswer, copilotData, textInput]);

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

  // Debounced: warn while typing if text resembles hijacks (critical blocks submit; caution is advisory only).
  useEffect(() => {
    if (inputType !== 'text') {
      setLiveInjectionHint(null);
      return;
    }
    if (injectionCheckTimerRef.current) clearTimeout(injectionCheckTimerRef.current);
    injectionCheckTimerRef.current = setTimeout(() => {
      setLiveInjectionHint(classifyInjectionWhileTyping(textInput));
    }, 380);
    return () => {
      if (injectionCheckTimerRef.current) clearTimeout(injectionCheckTimerRef.current);
    };
  }, [textInput, inputType, classifyInjectionWhileTyping]);

  // Handle text input change with validation
  const handleTextInputChange = useCallback((e) => {
    const newText = e.target.value;
    setTextInput(newText);
    setClarification(null);
    
    if (newText.trim()) {
      const errors = validateTextInput(newText);
      setValidationErrors(errors);
    } else {
      setValidationErrors([]);
    }
  }, [validateTextInput]);

  // Validate input before processing
  /** Same shape as ResultsView /api/generate-srs expects */
  const buildRequirementsArray = useCallback((resultsData) => {
    if (!resultsData) return [];
    if (Array.isArray(resultsData)) return resultsData;
    if (resultsData.results && Array.isArray(resultsData.results)) return resultsData.results;
    if (resultsData.status) return [resultsData];
    return [resultsData];
  }, []);

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
      errors.push(
        'Blocked: text contains instruction-hijack phrases (e.g. ignore/remove previous instructions, model tokens). Delete them and describe only product behavior.'
      );
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

  const runClarification = useCallback(async () => {
    if (!textInput.trim()) {
      setError('Please enter requirements text first.');
      return;
    }
    setIsClarifying(true);
    setError(null);
    try {
      const response = await axios.post(config.API_ENDPOINTS.CLARIFY_REQUIREMENTS, {
        content: textInput
      });
      setClarification(response.data);
      setRefinedInputText(response.data?.suggested_rewrite || textInput);
      setFollowupAnswers({});
    } catch (err) {
      console.error('Clarification failed:', err);
      setError(getApiErrorMessage(err, 'Failed to analyze clarifications.'));
    } finally {
      setIsClarifying(false);
    }
  }, [textInput]);

  const applySuggestion = useCallback((suggestionText) => {
    if (!suggestionText) return;
    setRefinedInputText(suggestionText);
  }, []);

  const buildFinalTextWithFollowups = useCallback((baseText, answersMap) => {
    const safeBase = (baseText || '').trim();
    const entries = Object.entries(answersMap || {})
      .filter(([, value]) => String(value || '').trim())
      .sort((a, b) => Number(a[0]) - Number(b[0]));

    if (entries.length === 0) return safeBase;

    const answerLines = entries.map(([idx, value]) => `- Q${Number(idx) + 1}: ${String(value).trim()}`);
    const followupBlock = `\n\nClarifications Provided:\n${answerLines.join('\n')}`;
    return `${safeBase}${followupBlock}`.trim();
  }, []);

  const applyFollowupAnswers = useCallback(() => {
    const base = refinedInputText?.trim() || textInput;
    const merged = buildFinalTextWithFollowups(base, followupAnswers);
    if (merged) {
      setRefinedInputText(merged);
    }
  }, [buildFinalTextWithFollowups, refinedInputText, textInput, followupAnswers]);

  const useRefinedAsInput = useCallback(() => {
    if (!refinedInputText?.trim()) return;
    const finalText = buildFinalTextWithFollowups(refinedInputText, followupAnswers);
    setTextInput(finalText);
    setValidationErrors(validateTextInput(finalText));
  }, [refinedInputText, followupAnswers, validateTextInput, buildFinalTextWithFollowups]);

  const generateSRSFromAudioDirect = useCallback(async () => {
    if (!backendReady) {
      setError('Backend is not reachable. Please start the API server and try again.');
      return;
    }
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
        navigate('/results');
      }
    } catch (err) {
      console.error('Direct SRS generation error:', err);
      setError(getApiErrorMessage(err, 'Failed to generate SRS from audio.'));
    } finally {
      setIsGeneratingDirectSRS(false);
    }
  }, [backendReady, inputType, audioBlob, projectInfo, onSRSGenerated, setCurrentResults]);

  // Direct SRS generation from uploaded file (txt/pdf)
  const generateSRSFromFileDirect = useCallback(async () => {
    if (!backendReady) {
      setError('Backend is not reachable. Please start the API server and try again.');
      return;
    }
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
        navigate('/results');
      }
    } catch (err) {
      console.error('Direct SRS from file error:', err);
      setError(getApiErrorMessage(err, 'Failed to generate SRS from file.'));
    } finally {
      setIsGeneratingDirectSRS(false);
    }
  }, [backendReady, uploadedFiles, projectInfo, onSRSGenerated, setCurrentResults]);

  const processRequirements = useCallback(async () => {
    if (!backendReady) {
      setError('Backend is not reachable. Please start the API server and try again.');
      return;
    }
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
            setError(
              'Blocked: instruction-hijack wording detected. Remove phrases that try to override the AI (e.g. “remove all previous instructions”) and keep only real requirements.'
            );
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
      /** When set, SRS was produced in the same HTTP call as processing (text-only). */
      let srsFromCombined = null;
      /** Server-side SRS failure after successful processing (combined endpoint only). */
      let combinedSrsError = null;

      if (inputType === 'text' && textInput.trim()) {
        // Sanitize input before sending to backend
        const baseText = refinedInputText?.trim() ? refinedInputText : textInput;
        const sourceText = buildFinalTextWithFollowups(baseText, followupAnswers);
        const sanitizedContent = sanitizeInput(sourceText);
        const clarificationSummary = clarification ? {
          clarification_score: clarification.clarification_score,
          unresolved_items: clarification.unresolved_items,
          warning_level: clarification.warning_level,
          ambiguities_count: clarification.ambiguities?.length || 0,
          add_suggestions_count: clarification.add_suggestions?.length || 0,
          followup_answers_count: Object.values(followupAnswers || {}).filter(v => String(v || '').trim()).length,
        } : null;
        const combined = await axios.post(
          config.API_ENDPOINTS.PROCESS_AND_GENERATE_SRS,
          {
            type: 'text',
            content: sanitizedContent,
            project_info: {
              ...projectInfo,
              clarification_summary: clarificationSummary
            }
          },
          { timeout: 300000 }
        );
        response = { data: combined.data.processing };
        if (combined.data?.srs_error && !combined.data?.srs) {
          combinedSrsError = combined.data.srs_error;
        } else {
          srsFromCombined = combined.data.srs;
        }
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

      setProcessingProgress(88);
      setResults(response.data);
      onResultsGenerated(response.data);

      try {
        await saveInput({
          projectInfo: {
            ...projectInfo,
            clarification_summary: clarification ? {
              clarification_score: clarification.clarification_score,
              unresolved_items: clarification.unresolved_items,
              warning_level: clarification.warning_level,
            } : null
          },
          inputType: inputType,
          content: inputType === 'text'
            ? buildFinalTextWithFollowups((refinedInputText?.trim() ? refinedInputText : textInput), followupAnswers)
            : (inputType === 'audio' ? 'Audio recording' : 'File upload'),
          fileNames: inputType === 'file' ? uploadedFiles.map(({ file }) => file.name) : [],
          results: response.data,
          audioBlob: inputType === 'audio' ? audioBlob : null,
          transcription: inputType === 'audio' ? (response.data?.original_text || liveTranscription || '') : '',
          liveTranscription: inputType === 'audio' ? liveTranscription : '',
          clarification: clarification || null
        });
      } catch (error) {
        console.error('Error saving input to storage:', error);
      }

      onSRSGenerated(null);

      if (combinedSrsError) {
        setProcessingProgress(100);
        navigate('/results');
        return;
      }

      try {
        let srsPayload = srsFromCombined;
        if (!srsPayload) {
          const requirementsArray = buildRequirementsArray(response.data);
          setProcessingProgress(92);
          const srsResponse = await axios.post(
            config.API_ENDPOINTS.GENERATE_SRS,
            {
              results: requirementsArray,
              project_info: projectInfo,
            },
            { timeout: 300000 }
          );
          srsPayload = srsResponse.data;
        } else {
          setProcessingProgress(92);
        }

        if (srsPayload && (srsPayload.sections || srsPayload.raw_text)) {
          onSRSGenerated(srsPayload);
          try {
            saveSRS(srsPayload);
          } catch (e) {
            console.error('Error saving SRS to storage:', e);
          }
          setLastSRSAvailable(true);
          setProcessingProgress(100);
          navigate('/results');
        } else {
          setProcessingProgress(100);
          navigate('/results');
        }
      } catch (srsErr) {
        console.error('SRS generation failed:', srsErr);
        setProcessingProgress(100);
        setError(getApiErrorMessage(srsErr, 'SRS generation failed. Please retry from the Results page.'));
      }

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
        setError(getApiErrorMessage(err, 'An error occurred while processing.'));
        
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
  }, [backendReady, inputType, textInput, refinedInputText, followupAnswers, clarification, audioBlob, uploadedFiles, projectInfo, validateInput, onResultsGenerated, onSRSGenerated, sanitizeInput, setCurrentResults, liveTranscription, buildFinalTextWithFollowups, buildRequirementsArray, navigate]);

  const canProcess = useMemo(() => {
    if (isProcessing) return false;
    if (!backendReady) return false;
    if (projectInfoErrors.length > 0) return false;
    if (inputType === 'text' && (!textInput.trim() || validationErrors.length > 0)) return false;
    if (inputType === 'text' && liveInjectionHint?.level === 'critical') return false;
    if (inputType === 'audio' && !audioBlob) return false;
    if (inputType === 'file' && uploadedFiles.length === 0) return false;
    return true;
  }, [isProcessing, backendReady, inputType, textInput, validationErrors, liveInjectionHint, audioBlob, uploadedFiles, projectInfoErrors]);

  return (
    <div className="relative max-w-5xl mx-auto animate-fade-in" role="main" aria-labelledby="input-heading">
      {(isProcessing || isGeneratingDirectSRS) && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-r2d-primary/50 backdrop-blur-sm px-4"
          aria-live="polite"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 shadow-2xl dark:bg-slate-900 dark:border-slate-600 text-center"
            role="status"
          >
            <div className="mx-auto mb-6 relative h-14 w-14">
              <div className="absolute inset-0 rounded-full border-[3px] border-r2d-accent/25" />
              <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-r2d-accent border-r-blue-400 animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-r2d-primary dark:text-slate-100">
              {isGeneratingDirectSRS ? 'Generating SRS' : 'Processing & generating SRS'}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Model inference and document assembly in progress. Please keep this page open.
            </p>
            {isProcessing && (
              <div className="mt-6 text-left space-y-2">
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-r2d-accent to-blue-400 transition-all duration-300"
                    style={{ width: `${Math.max(8, processingProgress)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 tabular-nums">{Math.round(processingProgress)}% complete</p>
              </div>
            )}
          </div>
        </div>
      )}
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
          {!backendReady && (
            <div className={`mb-5 rounded-lg border px-3 py-2 text-xs ${
              isDark ? 'border-rose-800 bg-rose-900/20 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}>
              {backendStatusText}
            </div>
          )}

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
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-r2d-accent focus:border-transparent hover:border-opacity-80 transition-all duration-200 ${
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
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-r2d-accent focus:border-transparent hover:border-opacity-80 transition-all duration-200 ${
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
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-r2d-accent focus:ring-offset-2 ${
                    inputType === type 
                      ? 'bg-r2d-primary text-white shadow-md border border-r2d-primary' 
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
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
                  className={`w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-r2d-accent focus:border-transparent transition-all duration-200 resize-y ${
                    validationErrors.length > 0
                      ? `${isDark ? 'border-red-400/70 bg-red-900/20 text-slate-100' : 'border-red-300 bg-red-50 text-slate-900'}`
                      : liveInjectionHint?.level === 'critical'
                        ? `${isDark ? 'border-rose-500/80 bg-rose-950/30 text-slate-100' : 'border-rose-400 bg-rose-50 text-slate-900'}`
                        : liveInjectionHint?.level === 'caution'
                          ? `${isDark ? 'border-amber-500/60 bg-amber-950/25 text-slate-100' : 'border-amber-300 bg-amber-50/90 text-slate-900'}`
                          : `${isDark ? 'border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-600' : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300'}`
                  }`}
                  placeholder="Describe what the system should do. Process anytime — optional tools are below."
                  aria-label="Requirements text input"
                  aria-invalid={validationErrors.length > 0 || liveInjectionHint?.level === 'critical'}
                  aria-describedby={
                    validationErrors.length > 0
                      ? 'validation-errors'
                      : liveInjectionHint
                        ? 'live-injection-hint'
                        : undefined
                  }
                />

                {liveInjectionHint && (
                  <div
                    id="live-injection-hint"
                    role="alert"
                    className={`mt-3 flex gap-3 rounded-lg border px-3 py-2.5 text-sm leading-relaxed ${
                      liveInjectionHint.level === 'critical'
                        ? isDark
                          ? 'border-rose-500/60 bg-rose-950/40 text-rose-100'
                          : 'border-rose-200 bg-rose-50 text-rose-950'
                        : isDark
                          ? 'border-amber-600/50 bg-amber-950/35 text-amber-100'
                          : 'border-amber-200 bg-amber-50 text-amber-950'
                    }`}
                  >
                    <AlertTriangle
                      className={`h-5 w-5 shrink-0 mt-0.5 ${liveInjectionHint.level === 'critical' ? 'text-rose-500' : 'text-amber-600'}`}
                      aria-hidden
                    />
                    <div>
                      <p className="font-semibold">{liveInjectionHint.title}</p>
                      <p className="mt-1 opacity-95">{liveInjectionHint.body}</p>
                    </div>
                  </div>
                )}

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
                
                <p className={`mt-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Need at least 50 words and one letter. Symbols and numbers are fine.
                </p>

                {/* Quick templates */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Quick Templates</p>
                    <button
                      type="button"
                      onClick={() => setShowHelp(!showHelp)}
                      className="text-xs text-r2d-accent hover:text-r2d-primaryLight focus:outline-none focus:ring-2 focus:ring-r2d-accent rounded px-2 py-1 transition-colors"
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
                          setLiveInjectionHint(null);
                        }}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-r2d-accent ${
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

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setOptionalToolsOpen((o) => !o)}
                    className={`text-sm w-full sm:w-auto px-4 py-2 rounded-lg border transition-colors ${
                      isDark
                        ? 'border-slate-600 text-slate-200 hover:bg-slate-800'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                    aria-expanded={optionalToolsOpen}
                  >
                    {optionalToolsOpen ? 'Hide optional wording tools' : 'Optional: wording help & questions'}
                  </button>
                </div>

                {optionalToolsOpen && (
                <div className={`mt-3 p-4 rounded-xl border ${isDark ? 'bg-slate-800/90 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isDark ? 'bg-r2d-primary/40 text-blue-200' : 'bg-r2d-accentMuted text-r2d-primary'}`}>
                        <Sparkles className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <h4 className={`text-sm font-semibold flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-indigo-950'}`}>
                          Optional wording tools
                        </h4>
                        <p className={`text-xs mt-1 max-w-xl ${isDark ? 'text-slate-300' : 'text-indigo-900/80'}`}>
                          Load suggestions or run full analysis only when you want. Processing does not require this.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {isCopilotLoading && (
                        <span className={`text-xs inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${isDark ? 'bg-slate-900 text-cyan-300' : 'bg-white text-cyan-800 border border-cyan-200'}`}>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          Loading…
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={loadLiveCopilotHints}
                        disabled={isCopilotLoading}
                        className="text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 px-4 py-2 rounded-lg text-sm"
                      >
                        Load suggestions
                      </button>
                      <button
                        type="button"
                        onClick={runClarification}
                        disabled={isClarifying}
                        className="bg-r2d-primary hover:bg-r2d-primaryLight disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-sm"
                      >
                        {isClarifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                        {isClarifying ? 'Analyzing…' : 'Full analysis'}
                      </button>
                    </div>
                  </div>

                  {/* Live suggestions (loaded on demand) */}
                  {copilotData?.copilot && (
                    <div className={`mt-4 rounded-lg border p-3 ${isDark ? 'border-slate-600 bg-slate-900/50' : 'border-cyan-200/80 bg-white/80'}`}>
                      <p className={`text-[11px] font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-cyan-300' : 'text-cyan-800'}`}>
                        Live guidance
                      </p>
                      <div className="space-y-3">
                        {copilotThread.length > 0 && (
                          <div className={`p-3 rounded border max-h-44 overflow-auto ${isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
                            {copilotThread.map((m, idx) => (
                              <p key={`thread-${idx}`} className="text-xs mb-1">
                                <strong>{m.role === 'assistant' ? 'Assistant' : 'You'}:</strong> {m.text}
                              </p>
                            ))}
                          </div>
                        )}
                        <div className={`p-3 rounded border text-xs ${isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'}`}>
                          <strong>Question:</strong> {copilotData.copilot.question || 'No question'}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={copilotAnswer}
                            onChange={(e) => setCopilotAnswer(e.target.value)}
                            placeholder="Answer to continue the conversation…"
                            className={`flex-1 px-3 py-2 rounded border text-xs ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}
                          />
                          <button
                            type="button"
                            onClick={nextCopilotTurn}
                            disabled={isCopilotLoading || !copilotAnswer.trim()}
                            className="text-xs px-3 py-2 rounded bg-r2d-primary hover:bg-r2d-primaryLight disabled:bg-gray-400 text-white"
                          >
                            Next
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(copilotData.copilot.suggestions || []).map((s, idx) => {
                            if (skippedSuggestions[idx]) return null;
                            return (
                              <div key={`copilot-s-${idx}`} className={`p-3 rounded border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                                <p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{s.title}</p>
                                <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                  <strong>Why:</strong> {s.reason}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (s.rewrite) setRefinedInputText(s.rewrite);
                                    }}
                                    className="text-xs px-2.5 py-1 rounded bg-r2d-primary hover:bg-r2d-primaryLight text-white"
                                  >
                                    Apply
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSkippedSuggestions((prev) => ({ ...prev, [idx]: true }))}
                                    className="text-xs px-2.5 py-1 rounded bg-slate-500 hover:bg-slate-600 text-white"
                                  >
                                    Skip
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => alert(`Why this suggestion?\n\n${s.reason || 'No reason provided.'}`)}
                                    className="text-xs px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-700 text-white"
                                  >
                                    Why this?
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Full analysis layer */}
                  {clarification && (
                    <div className={`mt-4 space-y-4 ${copilotData?.copilot ? `pt-4 border-t ${isDark ? 'border-slate-600' : 'border-indigo-200'}` : ''}`}>
                      <p className={`text-[11px] font-semibold uppercase tracking-wide ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}>
                        Full analysis
                      </p>
                      <div className={`text-xs p-3 rounded border ${isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-indigo-200 text-indigo-900'}`}>
                        <div className="flex flex-wrap gap-4">
                          <span><strong>Score:</strong> {Math.round((clarification.clarification_score || 0) * 100)}%</span>
                          <span><strong>Warning:</strong> {clarification.warning_level || 'low'}</span>
                          <span><strong>Unresolved:</strong> {unresolvedClarificationItems}</span>
                        </div>
                      </div>

                      <div>
                        <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Highlighted ambiguity</label>
                        <div className={`mt-1 text-sm p-3 rounded border whitespace-pre-wrap ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
                          {clarification.highlighted_text || textInput}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Suggested rewrite</label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => applySuggestion(clarification.suggested_rewrite)}
                              className="text-xs px-2.5 py-1 rounded bg-r2d-primary hover:bg-r2d-primaryLight text-white"
                            >
                              Apply suggestion
                            </button>
                            <button
                              type="button"
                              onClick={useRefinedAsInput}
                              className="text-xs px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              Use as input
                            </button>
                          </div>
                        </div>
                        <textarea
                          value={refinedInputText}
                          onChange={(e) => setRefinedInputText(e.target.value)}
                          rows={6}
                          className={`mt-1 w-full px-3 py-2 rounded border text-sm ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}
                        />
                      </div>

                      {(clarification.add_suggestions?.length > 0 || clarification.remove_suggestions?.length > 0) && (
                        <div className="grid md:grid-cols-2 gap-3">
                          <div className={`p-3 rounded border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                            <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Suggestions to add</p>
                            <ul className="space-y-2">
                              {(clarification.add_suggestions || []).map((s, idx) => (
                                <li key={`add-${idx}`} className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>- {s}</li>
                              ))}
                            </ul>
                          </div>
                          <div className={`p-3 rounded border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                            <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Suggestions to replace/remove</p>
                            <ul className="space-y-2 max-h-32 overflow-auto">
                              {(clarification.remove_suggestions || []).slice(0, 8).map((s, idx) => (
                                <li key={`rm-${idx}`} className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>- {s}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {clarification.clarification_questions?.length > 0 && (
                        <div className={`p-3 rounded border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                            <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                              Optional follow-up questions
                            </p>
                            <button
                              type="button"
                              onClick={applyFollowupAnswers}
                              className="text-xs px-2.5 py-1 rounded bg-r2d-primary hover:bg-r2d-primaryLight text-white"
                            >
                              Apply follow-up answers
                            </button>
                          </div>
                          <div className="space-y-3">
                            {clarification.clarification_questions.slice(0, 5).map((q, idx) => (
                              <div key={`q-${idx}`}>
                                <p className={`text-xs mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{q}</p>
                                <input
                                  type="text"
                                  value={followupAnswers[idx] || ''}
                                  onChange={(e) => setFollowupAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                                  placeholder="Type your clarification..."
                                  className={`w-full px-2.5 py-2 rounded border text-xs ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                )}

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
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Audio Recording
                </label>
                
                {/* Validation Guidelines */}
                <div className={`mb-4 text-sm p-3 rounded-lg border ${isDark ? 'text-slate-300 bg-slate-800 border-slate-700' : 'text-slate-600 bg-r2d-accentMuted/40 border-r2d-accentMuted'}`}>
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
                  <div className={`text-center p-8 border-2 border-dashed rounded-lg transition-colors duration-200 ${isDark ? 'border-slate-600 bg-slate-900/40 hover:border-slate-500' : 'border-slate-300 bg-slate-50/50 hover:border-slate-400'}`}>
                    <div className={`mb-4 transition-transform duration-300 ${isRecording ? 'animate-pulse scale-110' : ''}`}>
                      <Mic className={`h-16 w-16 mx-auto ${isRecording ? 'text-red-500' : (isDark ? 'text-slate-500' : 'text-slate-400')}`} aria-hidden="true" />
                    </div>
                    <p className={`text-lg mb-4 font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
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
                    <p className={`text-sm mt-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Record your requirements by speaking into your microphone
                    </p>
                    
                    {/* Live Transcription Display (visible during and after recording) */}
                    {(isRecording || liveTranscription) && (
                      <div className={`mt-6 p-4 rounded-lg border-2 ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-blue-200'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <label className={`text-sm font-semibold flex items-center space-x-2 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                            <Sparkles className={`h-4 w-4 ${isTranscribing ? 'animate-pulse text-r2d-accent' : (isDark ? 'text-slate-500' : 'text-slate-400')}`} aria-hidden="true" />
                            <span>Live Transcription</span>
                            {isTranscribing && (
                              <span className="text-xs text-r2d-accent animate-pulse">Updating...</span>
                            )}
                            {!isRecording && liveTranscription && (
                              <span className="text-xs text-emerald-400">Last recorded transcription</span>
                            )}
                          </label>
                        </div>
                        <div className={`min-h-[100px] max-h-[200px] overflow-y-auto p-3 rounded border ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}>
                          {liveTranscription ? (
                            <p className="text-base leading-relaxed whitespace-pre-wrap font-medium">{liveTranscription}</p>
                          ) : (
                            <p className={`text-sm italic ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
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
                <div className={`mb-4 text-sm p-3 rounded-lg border ${isDark ? 'text-slate-300 bg-slate-800 border-slate-700' : 'text-slate-600 bg-r2d-accentMuted/40 border-r2d-accentMuted'}`}>
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
                      ? (isDark ? 'border-r2d-accent bg-r2d-primary/20 scale-102' : 'border-r2d-accent bg-r2d-accentMuted/40 scale-102')
                      : (isDark ? 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/60' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50')
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-label="File upload area"
                >
                  <input {...getInputProps()} aria-label="File input" />
                  <Upload className={`h-12 w-12 mx-auto mb-4 transition-colors duration-200 ${isDragActive ? 'text-r2d-accent' : (isDark ? 'text-slate-500' : 'text-slate-400')}`} aria-hidden="true" />
                  {isDragActive ? (
                    <p className="text-lg text-r2d-accent font-medium">Drop the files here...</p>
                  ) : (
                    <div>
                      <p className={`text-lg mb-2 font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        Drag & drop files here, or click to select
                      </p>
                      <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Supports: .txt, .pdf
                      </p>
                    </div>
                  )}
                </div>

                {/* Uploaded Files List */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-4 space-y-2 animate-slide-up">
                    <h4 className={`text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Uploaded Files ({uploadedFiles.length}):</h4>
                    {uploadedFiles.map(({ file, id, status }) => {
                      const extension = file.name.toLowerCase().split('.').pop();
                      const isValidType = extension === 'txt' || extension === 'pdf';
                      
                      return (
                        <div key={id} className={`flex items-center justify-between p-3 rounded-lg transition-colors duration-200 ${
                          isValidType
                            ? `${isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-50 hover:bg-slate-100'}`
                            : `${isDark ? 'bg-red-950/30 border border-red-800' : 'bg-red-50 border border-red-200'}`
                        }`}>
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                            {extension === 'pdf' ? (
                              <FileText className="h-4 w-4 text-red-500 flex-shrink-0" aria-hidden="true" />
                          ) : (
                            <FileText className="h-4 w-4 text-r2d-accent flex-shrink-0" aria-hidden="true" />
                          )}
                            <span className={`text-sm font-medium truncate ${!isValidType ? 'text-red-600' : ''}`} title={file.name}>
                              {file.name}
                              {!isValidType && <span className="ml-2 text-xs text-red-500">(Invalid type)</span>}
                            </span>
                          <span className={`text-xs flex-shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
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
            <div className={`mb-6 p-4 rounded-lg animate-slide-up border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`} role="status" aria-live="polite">
              <div className="flex items-center space-x-2 mb-2">
                <AlertCircle className="h-5 w-5 text-r2d-accent flex-shrink-0" aria-hidden="true" />
                <span className={`${isDark ? 'text-slate-200' : 'text-slate-700'} font-semibold`}>{error}</span>
              </div>
              {validationErrors.length > 0 && (
                <div className="mt-3 ml-7 space-y-2">
                  {validationErrors.map((err, index) => (
                    <div key={index} className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      • {err}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Processing Progress */}
          {isProcessing && (
            <div className={`mb-6 p-4 rounded-lg animate-slide-up border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-r2d-accentMuted/40 border-r2d-accentMuted'}`}>
              <div className="flex items-center space-x-3 mb-3">
                <Loader2 className="h-5 w-5 text-r2d-accent animate-spin" aria-hidden="true" />
                <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-r2d-primary'}`}>Processing requirements and generating SRS…</span>
              </div>
              <div className={`w-full rounded-full h-2.5 ${isDark ? 'bg-slate-700' : 'bg-blue-100'}`}>
                <div 
                  className="bg-r2d-accent h-2.5 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${processingProgress}%` }}
                  role="progressbar"
                  aria-valuenow={Math.round(processingProgress)}
                  aria-valuemin="0"
                  aria-valuemax="100"
                />
              </div>
              <p className={`text-xs mt-2 ${isDark ? 'text-slate-300' : 'text-r2d-primary'}`}>{Math.round(processingProgress)}% complete</p>
            </div>
          )}

          {/* Process Button */}
          <div className="text-center">
            <button
              onClick={processRequirements}
              disabled={!canProcess}
              className="bg-r2d-primary hover:bg-r2d-primaryLight disabled:bg-slate-400 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center space-x-2 mx-auto shadow-md hover:shadow-lg disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-r2d-accent focus:ring-offset-2"
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
                  <span>Process &amp; Generate SRS</span>
                </>
              )}
            </button>
            {inputType === 'audio' && audioBlob && audioBlob.size > 0 && (
              <button
                onClick={generateSRSFromAudioDirect}
                disabled={isGeneratingDirectSRS}
                className="mt-4 bg-r2d-accent hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center space-x-2 mx-auto shadow-md hover:shadow-lg disabled:bg-slate-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-r2d-accent focus:ring-offset-2"
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
                className="mt-4 bg-r2d-primary hover:bg-r2d-primaryLight text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center space-x-2 mx-auto shadow-md hover:shadow-lg disabled:bg-slate-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-r2d-accent focus:ring-offset-2"
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
                Requirements processed and SRS generation finished. Opening Results…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequirementsInput;
