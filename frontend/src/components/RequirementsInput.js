import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Mic, X, CheckCircle, AlertCircle, AlertTriangle, Square, Sparkles, Info, Loader2, Wand2, ChevronDown, PanelLeft } from 'lucide-react';
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
  const [projectInfoSubmitAttempted, setProjectInfoSubmitAttempted] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  /** Clarification / live copilot — off by default to keep the flow simple */
  const [optionalToolsOpen, setOptionalToolsOpen] = useState(false);
  
  // Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [pendingTranscript, setPendingTranscript] = useState('');
  /** Full transcript after recording (shown in Recording Complete; user can edit before processing). */
  const [recordingTranscript, setRecordingTranscript] = useState('');
  const [isPostRecordingTranscribing, setIsPostRecordingTranscribing] = useState(false);
  const [recordingTranscribeError, setRecordingTranscribeError] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [liveTranscription, setLiveTranscription] = useState('');
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
  const liveTranscriptionRef = useRef('');
  const speechRecognitionRef = useRef(null);
  const speechRecognitionActiveRef = useRef(false);

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

  const requirementGuidance = useMemo(() => {
    const raw = String(textInput || '');
    const cleanedLines = raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const requirementLines = cleanedLines.filter((line) => /[A-Za-z]/.test(line));
    const allText = requirementLines.join(' ');

    const vagueTermPattern = /\b(good|bad|better|worse|fast|quick|user-friendly|efficient|easy)\b/gi;
    const vagueMatches = allText.match(vagueTermPattern) || [];
    const uniqueVague = Array.from(new Set(vagueMatches.map((t) => t.toLowerCase())));

    const hasActor = /\b(user|users|admin|administrator|system|customer|student|teacher|manager|operator|staff)\b/i.test(allText);
    const hasActionVerb = /\b(create|update|delete|view|submit|approve|reject|search|generate|track|notify|send|export|login|upload|download|validate)\b/i.test(allText);
    const hasMeasurableConstraint = /\b(\d+(\.\d+)?\s?(ms|s|sec|seconds|minutes|hours|days|%|percent|kb|mb|gb|users|requests))\b/i.test(allText);
    const hasPriorityWord = /\b(must|shall|should|may|could)\b/i.test(allText);

    const criteria = [
      { label: 'Actor is clear (who)', pass: hasActor },
      { label: 'Action is clear (what)', pass: hasActionVerb },
      { label: 'Uses measurable constraint', pass: hasMeasurableConstraint },
      { label: 'Uses requirement wording (must/shall/should)', pass: hasPriorityWord },
      { label: 'No vague adjectives', pass: uniqueVague.length === 0 },
    ];

    const suggestions = [];
    if (requirementLines.length > 0 && !hasActor) {
      suggestions.push('Add a clear actor in each requirement, such as "User", "Admin", or "System".');
    }
    if (requirementLines.length > 0 && !hasActionVerb) {
      suggestions.push('Use explicit action verbs like create, approve, search, or export.');
    }
    if (requirementLines.length > 0 && !hasMeasurableConstraint) {
      suggestions.push('Add at least one measurable condition (for example response time, limit, or percentage).');
    }
    if (uniqueVague.length > 0) {
      suggestions.push(`Replace vague terms (${uniqueVague.join(', ')}) with testable wording.`);
    }
    if (requirementLines.length >= 3) {
      const veryShort = requirementLines.filter((line) => line.split(/\s+/).length < 5).length;
      if (veryShort >= 2) {
        suggestions.push('Some lines are too short to be testable. Expand each line with condition and expected behavior.');
      }
    }

    return {
      hasInput: requirementLines.length > 0,
      criteria,
      suggestions,
    };
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
      label: 'Telemedicine Platform',
      text: 'Patients should search doctors by specialty, language, and availability, then book virtual appointments with secure video sessions. Doctors need appointment calendars, clinical notes, e-prescription tools, and controlled access to patient history. The system must send reminders, support rescheduling and cancellations, and prevent double booking. Admins should manage provider profiles, consultation fees, and dispute workflows. The platform must enforce role-based access, encrypted records, and reliable session logs for medico-legal audit.'
    },
    {
      label: 'Smart Parking System',
      text: 'Drivers should view nearby parking lots in real time, check available slots, reserve spaces, and pay digitally before arrival. Gate operators need QR validation, manual override, and incident reporting for blocked or damaged spots. The platform must manage reservation expiry, grace periods, and dynamic pricing by demand windows. Administrators should monitor occupancy analytics, revenue summaries, and maintenance schedules. The system should send alerts for overstay cases and keep immutable parking transaction history for operations review.'
    },
    {
      label: 'Warehouse Inventory',
      text: 'Warehouse staff should receive stock, scan barcodes, move items between bins, and process dispatch requests with pick lists. Supervisors need dashboards for stock aging, reorder thresholds, and damaged goods tracking. The system must support batch and serial number tracking, low stock alerts, and cycle count reconciliation. Procurement users should create purchase orders from approved shortages and monitor supplier lead times. All inventory adjustments must be logged with user identity and reason codes for audit accuracy.'
    },
    {
      label: 'Online Exam Proctoring',
      text: 'Students should authenticate, join exam sessions, and submit answers within the configured exam window. Invigilators need live candidate monitoring, suspicious activity flags, and evidence snapshots for review. The system must enforce exam rules like browser lockdown, timed sections, and auto-save recovery on connection loss. Academic admins should configure exam templates, grading schemes, and exception approvals for special cases. Final results should publish only after integrity checks and moderation workflows are completed.'
    },
    {
      label: 'Construction Project Tracker',
      text: 'Project managers should create project plans, define milestones, assign teams, and track daily progress by site and contractor. Field engineers need mobile task updates, image uploads, and issue logs mapped to floor plans. The system must compare planned versus actual timelines, raise delay alerts, and capture change request approvals. Finance users should monitor budget burn, invoice verification, and procurement status. The platform should generate weekly progress reports with risk summaries and action owners.'
    },
    {
      label: 'Restaurant Management',
      text: 'Front desk staff should manage table reservations, walk-in queues, and seating plans based on party size and availability. Waiters need digital order capture, kitchen routing, and bill split support for groups. Kitchen staff should receive prioritized tickets and mark preparation stages in real time. The system must handle out-of-stock menu items, discount rules, and void authorization by managers. Owners should view sales analytics, peak hour utilization, and customer feedback trends for service improvements.'
    },
    {
      label: 'Insurance Claim Processing',
      text: 'Policy holders should submit claims with incident details, supporting documents, and bank information for reimbursement. Claim officers need case assignment, verification checklists, and fraud indicators before decision making. The platform must integrate policy validation, deductible computation, and approval workflows with escalation paths. Supervisors should review pending workloads, turnaround times, and rejection causes by product category. Customers must receive status notifications at each claim stage and downloadable settlement statements on closure.'
    },
    {
      label: 'Public Transport Ticketing',
      text: 'Passengers should plan routes, buy single or monthly passes, and validate tickets through QR or NFC at entry points. Conductors need offline validation capability and sync logs once connectivity is restored. The system must handle fare zones, concession categories, and penalty calculations for invalid travel. Operations teams should monitor route usage, peak traffic trends, and device health across stations. Refund workflows should support service cancellation scenarios with transparent policy-based calculations.'
    },
    {
      label: 'Freelance Marketplace',
      text: 'Clients should post projects, shortlist proposals, negotiate milestones, and release payments based on approved deliverables. Freelancers need profile portfolios, bid management, and secure messaging for project clarification. The platform must support escrow holding, dispute handling, and deadline reminders for both parties. Admin teams should monitor trust signals, policy violations, and account verification status. Ratings and review workflows must prevent abuse and allow evidence-backed moderation for disputed feedback.'
    },
    {
      label: 'Digital Library System',
      text: 'Readers should search books by title, author, subject, and availability, then borrow physical or digital copies according to membership rules. Librarians need catalog management, issue and return workflows, and overdue fine controls. The system must support reservation queues, renewal limits, and damaged book reporting with replacement tracking. Administrators should manage memberships, borrowing policies, and analytics on category demand. Automated reminders should notify users for due dates, expirations, and hold availability updates.'
    },
    {
      label: 'Event Management Portal',
      text: 'Organizers should create events, manage ticket tiers, configure seating maps, and publish schedules with speaker details. Attendees need registration, secure payment, QR ticket download, and personalized agenda views. The system must handle capacity limits, waitlists, promo codes, and cancellation refunds under event policy rules. Venue staff should validate entry, track check-ins, and report onsite issues in real time. Post-event analytics must include attendance, revenue, engagement metrics, and sponsor visibility reports.'
    },
    {
      label: 'Agriculture Advisory App',
      text: 'Farmers should register land profiles, crop cycles, and receive localized advisories for irrigation, fertilization, and pest risks. Field officers need farmer visit logs, recommendation history, and follow-up reminders by village cluster. The platform must integrate weather forecasts, soil data, and seasonal alerts to suggest actionable interventions. Administrators should monitor advisory adoption rates, crop outcomes, and unresolved support requests. The system should support multilingual content, offline data capture, and later synchronization in low-connectivity areas.'
    }
  ], []);

  const applyQuickTemplate = useCallback((templateText) => {
    const cleanedTemplate = String(templateText || '').trim();
    if (!cleanedTemplate) return;

    // Preserve user-authored text and append template as an additional draft block.
    const existing = String(textInput || '').trim();
    const mergedText = existing
      ? `${existing}\n\n---\nTemplate reference:\n${cleanedTemplate}`
      : cleanedTemplate;

    setTextInput(mergedText);
    setClarification(null);
    setError(null);
    setValidationErrors([]);
    setLiveInjectionHint(null);
  }, [textInput]);

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

  // Audio recording & transcription functions
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
      speechRecognitionActiveRef.current = false;

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
        // Stop speech recognition if running
        try {
          if (speechRecognitionRef.current && speechRecognitionActiveRef.current) {
            speechRecognitionRef.current.stop();
          }
        } catch (e) {
          // ignore
        } finally {
          speechRecognitionActiveRef.current = false;
        }
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
      mediaRecorder.start(500); // Collect data twice per second for faster live updates
      setIsRecording(true);
      setRecordingTime(0);
      setLiveTranscription(''); // Reset transcription
      liveTranscriptionRef.current = '';
      setRecordingTranscribeError(null);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // 1) Try browser Speech Recognition for instant on-screen transcript (best UX)
      try {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR) {
          const recognition = new SR();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event) => {
            let interim = '';
            let finalText = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const result = event.results[i];
              const transcript = (result[0]?.transcript || '').trim();
              if (!transcript) continue;
              if (result.isFinal) finalText += transcript + ' ';
              else interim += transcript + ' ';
            }

            setLiveTranscription((prev) => {
              const base = prev && prev.trim() ? prev.trim() + ' ' : '';
              const merged = (base + finalText + interim).replace(/\s+/g, ' ').trim();
              liveTranscriptionRef.current = merged;
              return merged;
            });
          };

          recognition.onerror = () => {
            // fall back to Whisper chunking below
            try {
              recognition.stop();
            } catch (e) {
              // ignore
            }
            speechRecognitionActiveRef.current = false;
          };

          recognition.onend = () => {
            // If still recording, restart to keep capturing (some browsers stop automatically)
            if (speechRecognitionActiveRef.current && mediaRecorderRef.current?.state !== 'inactive') {
              try {
                recognition.start();
              } catch (e) {
                speechRecognitionActiveRef.current = false;
              }
            }
          };

          speechRecognitionRef.current = recognition;
          speechRecognitionActiveRef.current = true;
          recognition.start();
        }
      } catch (e) {
        speechRecognitionActiveRef.current = false;
      }

      // 2) Fallback: periodic Whisper transcription if Speech Recognition isn't available
      if (!speechRecognitionActiveRef.current) {
        transcriptionIntervalRef.current = setInterval(async () => {
          if (audioChunksRef.current.length > 0 && !isTranscribing) {
            try {
              setIsTranscribing(true);
              // Transcribe recent audio window to reduce server latency on mobile networks
              const recentChunks = audioChunksRef.current.slice(-16);
              const currentBlob = new Blob(recentChunks, { type: mimeType });

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
                  timeout: 12000
                });

                if (response.data && response.data.transcription) {
                  setLiveTranscription((prev) => {
                    const newText = response.data.transcription.trim();
                    if (!newText) return prev || '';
                    if (!prev) {
                      liveTranscriptionRef.current = newText;
                      return newText;
                    }
                    // Replace when backend returns a fuller hypothesis; append otherwise.
                    const merged = newText.length >= prev.length
                      ? newText
                      : `${prev} ${newText}`.replace(/\s+/g, ' ').trim();
                    liveTranscriptionRef.current = merged;
                    return merged;
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
        }, 1000); // Try every 1 second for better responsiveness
      }

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
        // Stop speech recognition immediately
        try {
          if (speechRecognitionRef.current) {
            speechRecognitionRef.current.stop();
          }
        } catch (e) {
          // ignore
        } finally {
          speechRecognitionActiveRef.current = false;
        }
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
    liveTranscriptionRef.current = '';
    try {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
    } catch (e) {
      // ignore
    } finally {
      speechRecognitionActiveRef.current = false;
    }
    setPendingTranscript('');
    setRecordingTranscript('');
    setRecordingTranscribeError(null);
    setIsPostRecordingTranscribing(false);
    audioChunksRef.current = [];
    if (transcriptionIntervalRef.current) {
      clearInterval(transcriptionIntervalRef.current);
      transcriptionIntervalRef.current = null;
    }
  }, [audioUrl]);

  const transcribeFullRecording = useCallback(async () => {
    if (!audioBlob || audioBlob.size === 0) {
      throw new Error('Audio recording is empty. Please record again.');
    }

    // Determine file extension based on MIME type (reuse logic from processing)
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

    const response = await axios.post(config.API_ENDPOINTS.TRANSCRIBE_AUDIO, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 60000 // 60 seconds for full transcription
    });

    if (response.data?.error) {
      throw new Error(response.data.error);
    }

    const transcript = (response.data?.transcription || '').trim();
    if (!transcript) {
      throw new Error('No text was transcribed from the audio. Please record again.');
    }

    return transcript;
  }, [audioBlob, projectInfo]);

  useEffect(() => {
    liveTranscriptionRef.current = liveTranscription || '';
  }, [liveTranscription]);

  // When a new recording is ready, transcribe the full clip and show it in the completion panel
  useEffect(() => {
    if (!audioBlob || audioBlob.size === 0) {
      setRecordingTranscript('');
      setIsPostRecordingTranscribing(false);
      setRecordingTranscribeError(null);
      return;
    }

    let cancelled = false;
    setRecordingTranscribeError(null);
    setIsPostRecordingTranscribing(true);
    setPendingTranscript('');
    setRecordingTranscript((prev) => {
      if (prev && prev.trim()) return prev;
      return liveTranscriptionRef.current || '';
    });

    (async () => {
      try {
        const transcript = await transcribeFullRecording();
        if (!cancelled) {
          setRecordingTranscript(transcript);
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Post-recording transcription:', e);
          setRecordingTranscribeError(
            getApiErrorMessage(e, 'Could not transcribe this recording. Edit the text below or try again.')
          );
          setRecordingTranscript((t) =>
            t && t.trim() ? t : liveTranscriptionRef.current || ''
          );
        }
      } finally {
        if (!cancelled) {
          setIsPostRecordingTranscribing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [audioBlob, transcribeFullRecording]);

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

  const getTextRepetitionMetrics = useCallback((text) => {
    const raw = String(text || '');
    const sentenceParts = raw
      .split(/[.!?\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const normalizeSentence = (s) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const meaningful = sentenceParts
      .map(normalizeSentence)
      .filter((s) => s && s.split(' ').filter(Boolean).length >= 4);

    const canonicalSeq = meaningful.join(' || ');
    const counts = new Map();
    for (const sentence of meaningful) {
      counts.set(sentence, (counts.get(sentence) || 0) + 1);
    }

    let repeatedInstances = 0;
    let maxSentenceRepeat = 0;
    for (const count of counts.values()) {
      if (count > 1) repeatedInstances += count;
      if (count > maxSentenceRepeat) maxSentenceRepeat = count;
    }
    const repeatedSentenceRatio = meaningful.length > 0 ? repeatedInstances / meaningful.length : 0;

    let repeatedPairBlockRatio = 0;
    if (meaningful.length >= 4) {
      const pairCounts = new Map();
      for (let i = 0; i < meaningful.length - 1; i += 1) {
        const key = `${meaningful[i]} || ${meaningful[i + 1]}`;
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
      let repeatedPairInstances = 0;
      for (const count of pairCounts.values()) {
        if (count > 1) repeatedPairInstances += count;
      }
      repeatedPairBlockRatio = (meaningful.length - 1) > 0 ? repeatedPairInstances / (meaningful.length - 1) : 0;
    }

    // Detect alternating two-sentence loops: A,B,A,B,... or B,A,B,A,...
    let alternatingTwoStatementRatio = 0;
    if (meaningful.length >= 6) {
      let alternatingMatches = 0;
      const comparisons = meaningful.length - 2;
      for (let i = 2; i < meaningful.length; i += 1) {
        if (meaningful[i] === meaningful[i - 2]) alternatingMatches += 1;
      }
      alternatingTwoStatementRatio = comparisons > 0 ? alternatingMatches / comparisons : 0;
    }

    const words = raw
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    const uniqueWordRatio = words.length > 0 ? new Set(words).size / words.length : 1;

    return {
      meaningfulSentenceCount: meaningful.length,
      repeatedSentenceRatio,
      repeatedPairBlockRatio,
      alternatingTwoStatementRatio,
      maxSentenceRepeat,
      uniqueWordRatio,
    };
  }, []);

  const getTextNoiseMetrics = useCallback((text) => {
    const raw = String(text || '');
    const tokens = raw.split(/\s+/).map((t) => t.trim()).filter(Boolean);
    if (tokens.length === 0) {
      return {
        tokenCount: 0,
        alphaTokenRatio: 0,
        readableWordRatio: 0,
        noisyTokenRatio: 0,
        severeNoiseRuns: 0,
      };
    }

    let alphaTokens = 0;
    let readableWordTokens = 0;
    let noisyTokens = 0;

    for (const token of tokens) {
      const hasAlpha = /[A-Za-z]/.test(token);
      const hasDigit = /\d/.test(token);
      const symbolCount = (token.match(/[^A-Za-z0-9]/g) || []).length;
      const alphaOnly = token.replace(/[^A-Za-z]/g, '');
      const hasVowel = /[aeiouAEIOU]/.test(alphaOnly);
      const compact = token.replace(/\s+/g, '');
      const punctuationDensity = compact.length > 0 ? symbolCount / compact.length : 0;

      if (hasAlpha) alphaTokens += 1;
      if (/^[A-Za-z]+(?:'[A-Za-z]+)?$/.test(token) && token.length >= 2) readableWordTokens += 1;

      const looksLikeNoise =
        (hasAlpha && !hasVowel && alphaOnly.length >= 6) ||
        punctuationDensity >= 0.3 ||
        /([A-Za-z0-9])\1{3,}/.test(token) ||
        (hasAlpha && hasDigit && symbolCount > 0) ||
        (hasAlpha && symbolCount >= 2);
      if (looksLikeNoise) noisyTokens += 1;
    }

    const severeNoiseRuns = (raw.match(/[A-Za-z0-9@#$%^&*_=+|~`<>./\\-]{20,}/g) || []).length;

    return {
      tokenCount: tokens.length,
      alphaTokenRatio: alphaTokens / tokens.length,
      readableWordRatio: readableWordTokens / tokens.length,
      noisyTokenRatio: noisyTokens / tokens.length,
      severeNoiseRuns,
    };
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

  // Re-validate project info only after the user has attempted submission.
  useEffect(() => {
    if (!projectInfoSubmitAttempted) return;
    setProjectInfoErrors(validateProjectInfo());
  }, [projectInfo, validateProjectInfo, projectInfoSubmitAttempted]);

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

    // Detect gibberish/noisy mixed input (letters+digits+symbols without readable requirement text).
    const noise = getTextNoiseMetrics(inputText);
    const isLikelyGibberish =
      words.length >= 12 && (
        noise.alphaTokenRatio < 0.55 ||
        noise.readableWordRatio < 0.4 ||
        noise.noisyTokenRatio > 0.35 ||
        noise.severeNoiseRuns >= 2
      );
    const isSevereNoise =
      words.length >= minWords &&
      (noise.readableWordRatio < 0.3 || noise.noisyTokenRatio > 0.45 || noise.severeNoiseRuns >= 3);
    if (isLikelyGibberish || isSevereNoise) {
      errors.push(
        'Input quality is too low: text looks like random letters/numbers/symbols instead of clear English requirements. Please write meaningful requirement sentences.'
      );
    } else if (
      words.length >= 12 &&
      (noise.readableWordRatio < 0.55 || noise.noisyTokenRatio > 0.22 || noise.severeNoiseRuns >= 1)
    ) {
      warnings.push(
        'Input contains many noisy tokens. Replace random or symbolic text with clear requirement statements.'
      );
    }

    // Check length
    if (inputText.length > maxChars) {
      warnings.push(`Input is very long (${inputText.length} characters). It will be truncated to ${maxChars} characters.`);
    }

    // Detect repeated/looped content that only inflates the word count.
    const repetition = getTextRepetitionMetrics(inputText);
    const isHighSentenceDuplication =
      repetition.meaningfulSentenceCount >= 4 &&
      (repetition.repeatedSentenceRatio >= 0.6 || repetition.maxSentenceRepeat >= 4);
    const isRepeatedTwoStatementLoop =
      repetition.meaningfulSentenceCount >= 6 &&
      (repetition.repeatedPairBlockRatio >= 0.5 || repetition.alternatingTwoStatementRatio >= 0.65);
    const isVeryLowLexicalVariety =
      words.length >= minWords &&
      repetition.uniqueWordRatio <= 0.28 &&
      repetition.maxSentenceRepeat >= 3;
    if (isHighSentenceDuplication || isRepeatedTwoStatementLoop || isVeryLowLexicalVariety) {
      errors.push(
        'Input appears highly repetitive (same statement repeated many times). Please add distinct requirements instead of duplicating lines to reach the word limit.'
      );
    } else if (
      repetition.meaningfulSentenceCount >= 4 &&
      (
        repetition.repeatedSentenceRatio >= 0.45 ||
        repetition.maxSentenceRepeat >= 3 ||
        repetition.repeatedPairBlockRatio >= 0.35 ||
        repetition.alternatingTwoStatementRatio >= 0.5
      )
    ) {
      warnings.push(
        'Your text contains significant repetition. Add more unique requirement details for better SRS quality.'
      );
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
  }, [detectPromptInjection, minWords, maxChars, getTextRepetitionMetrics, getTextNoiseMetrics]);

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

  const processRequirements = useCallback(async () => {
    if (!backendReady) {
      setError('Backend is not reachable. Please start the API server and try again.');
      return;
    }
    setIsProcessing(true);
    setLastSRSAvailable(false);
    setError(null);
    setValidationErrors([]);
    setProjectInfoSubmitAttempted(true);

    const currentProjectErrors = validateProjectInfo();
    if (currentProjectErrors.length > 0) {
      setProjectInfoErrors(currentProjectErrors);
      setError('Please fix project information errors before processing');
      setIsProcessing(false);
      return;
    }

    try {
      // For audio input, use the transcript from the Recording Complete panel (or transcribe if still empty)
      if (inputType === 'audio' && audioBlob) {
        try {
          if (!pendingTranscript) {
            let transcript = (recordingTranscript || '').trim();
            if (!transcript) {
              if (isPostRecordingTranscribing) {
                setError('Live transcript is still preparing. Speak for a few more seconds or wait briefly.');
                setIsProcessing(false);
                return;
              }
              transcript = await transcribeFullRecording();
              setRecordingTranscript(transcript);
            }
            const transcriptValidation = validateInput(transcript);
            if (!transcriptValidation.valid) {
              setValidationErrors(transcriptValidation.errors);
              if (transcriptValidation.securityIssue) {
                setError(
                  'Blocked: instruction-hijack wording detected in audio transcript. Remove unsafe text and try again.'
                );
              } else {
                setError('Please fix validation errors in the transcript before processing');
              }
              setIsProcessing(false);
              return;
            }
            setPendingTranscript(transcript);
            setTextInput(transcript);
            setInputType('text');
            setError(
              'Review the text on the Text Input tab (you can still edit there), then click "Process & Generate SRS" again to continue.'
            );
          }
        } catch (transcriptionError) {
          console.error('Full transcription error:', transcriptionError);
          setError(
            getApiErrorMessage(
              transcriptionError,
              'Failed to transcribe audio. Please try again or record again.'
            )
          );
        } finally {
          setIsProcessing(false);
        }
        return;
      }

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

      /** Hand off to SRS viewer: live stream and final doc render on `/srs` (not a blocking overlay). */
      navigate('/srs', {
        state: {
          srsPipeline: {
            id: Date.now(),
            projectInfo: { ...projectInfo },
            processingPayload: response.data,
            prebuiltSrs: srsFromCombined,
            combinedError: combinedSrsError || null,
          },
        },
      });

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
    }
  }, [backendReady, inputType, textInput, refinedInputText, followupAnswers, clarification, audioBlob, uploadedFiles, projectInfo, validateInput, onResultsGenerated, onSRSGenerated, sanitizeInput, setCurrentResults, liveTranscription, buildFinalTextWithFollowups, navigate, validateProjectInfo, pendingTranscript, transcribeFullRecording, recordingTranscript, isPostRecordingTranscribing]);

  const canProcess = useMemo(() => {
    if (isProcessing) return false;
    if (!backendReady) return false;
    if (inputType === 'text' && (!textInput.trim() || validationErrors.length > 0)) return false;
    if (inputType === 'text' && liveInjectionHint?.level === 'critical') return false;
    if (inputType === 'audio' && !audioBlob) return false;
    if (inputType === 'file' && uploadedFiles.length === 0) return false;
    return true;
  }, [isProcessing, backendReady, inputType, textInput, validationErrors, liveInjectionHint, audioBlob, uploadedFiles]);

  return (
    <div className="relative w-full animate-fade-in" role="main" aria-labelledby="input-heading">
      <div className={`relative rounded-2xl overflow-hidden border ${isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-white/90'}`}>
        <div className="relative rounded-2xl p-4 sm:p-6 md:p-8">
          <div className="flex items-center justify-center mb-6 sm:mb-8">
            <h2 
              id="input-heading"
              className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-center ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
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
                  const titleError = projectInfoSubmitAttempted
                    ? projectInfoErrors.find(e => e.toLowerCase().includes('project title'))
                    : null;
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
                  const authorError = projectInfoSubmitAttempted
                    ? projectInfoErrors.find(e => e.toLowerCase().includes('author'))
                    : null;
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
                  className={`w-full sm:w-auto justify-center flex items-center space-x-2 px-4 py-2.5 rounded-lg transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-r2d-accent focus:ring-offset-2 ${
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
                        onClick={() => applyQuickTemplate(t.text)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-r2d-accent ${
                          isDark 
                            ? 'bg-slate-900 text-slate-200 border-slate-700 hover:border-r2d-accent hover:bg-slate-800'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-r2d-accent hover:bg-r2d-accentMuted/35'
                        }`}
                        aria-label={`Use ${t.label} template`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {showHelp && (
                    <div id="help-text" className={`mt-3 p-3 rounded-lg text-xs animate-slide-up border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-r2d-accentMuted/45 border-r2d-accentMuted text-r2d-primary'}`}>
                      Templates are appended to your current text (they do not replace it). Aim for clear, complete sentences. Mention actors (users/admins), actions, constraints (security/performance), and any integrations. Avoid ambiguous terms like "fast" or "user-friendly" without specifics.
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
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isDark ? 'bg-r2d-primary/40 text-r2d-accentSoft' : 'bg-r2d-accentMuted text-r2d-primary'}`}>
                        <Sparkles className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <h4 className={`text-sm font-semibold flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-r2d-primary'}`}>
                          Optional wording tools
                        </h4>
                        <p className={`text-xs mt-1 max-w-xl ${isDark ? 'text-slate-300' : 'text-r2d-primary/80'}`}>
                          Load suggestions or run full analysis only when you want. Processing does not require this.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {isCopilotLoading && (
                        <span className={`text-xs inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${isDark ? 'bg-slate-900 text-r2d-accentSoft' : 'bg-white text-r2d-primary border border-r2d-accent/30'}`}>
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
                    <div className={`mt-4 rounded-lg border p-3 ${isDark ? 'border-slate-600 bg-slate-900/50' : 'border-r2d-accent/30 bg-white/80'}`}>
                      <p className={`text-[11px] font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-r2d-accentSoft' : 'text-r2d-primary'}`}>
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
                                    className="text-xs px-2.5 py-1 rounded bg-r2d-accent hover:bg-r2d-primaryLight text-white"
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
                    <div className={`mt-4 space-y-4 ${copilotData?.copilot ? `pt-4 border-t ${isDark ? 'border-slate-600' : 'border-r2d-accent/30'}` : ''}`}>
                      <p className={`text-[11px] font-semibold uppercase tracking-wide ${isDark ? 'text-r2d-accentSoft' : 'text-r2d-primary'}`}>
                        Full analysis
                      </p>
                      <div className={`text-xs p-3 rounded border ${isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-r2d-accent/30 text-r2d-primary'}`}>
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

                {requirementGuidance.hasInput && (
                  <div className={`mt-4 rounded-lg border p-3 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                      Requirement recommendations
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {requirementGuidance.criteria.map((item, index) => (
                        <li
                          key={`criterion-${index}`}
                          className={`text-xs ${item.pass ? (isDark ? 'text-emerald-300' : 'text-emerald-700') : (isDark ? 'text-amber-300' : 'text-amber-700')}`}
                        >
                          {item.pass ? 'PASS' : 'NEEDS WORK'}: {item.label}
                        </li>
                      ))}
                    </ul>
                    {requirementGuidance.suggestions.length > 0 && (
                      <div className="mt-3">
                        <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Suggested improvements</p>
                        <ul className="mt-1 space-y-1">
                          {requirementGuidance.suggestions.map((tip, index) => (
                            <li key={`tip-${index}`} className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                              - {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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
                      <div className={`mt-6 p-4 rounded-lg border-2 ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-r2d-accent/30'}`}>
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
                  <div
                    className={`p-6 rounded-lg border animate-slide-up ${
                      isDark ? 'bg-emerald-950/30 border-emerald-800' : 'bg-green-50 border-green-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${isDark ? 'bg-emerald-900' : 'bg-green-100'}`}>
                          <CheckCircle className={`h-6 w-6 ${isDark ? 'text-emerald-400' : 'text-green-600'}`} aria-hidden="true" />
                        </div>
                        <div>
                          <p className={`font-medium ${isDark ? 'text-emerald-100' : 'text-green-900'}`}>Recording Complete</p>
                          <p className={`text-sm ${isDark ? 'text-emerald-300' : 'text-green-700'}`}>Duration: {formatTime(recordingTime)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                        {audioUrl && audioBlob && (
                          <audio
                            controls
                            className="max-w-[100%] sm:max-w-xs"
                            aria-label="Audio playback"
                          >
                            <source src={audioUrl} type={audioBlob.type || 'audio/webm'} />
                            Your browser does not support the audio element.
                          </audio>
                        )}
                        <button
                          onClick={clearRecording}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-300 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                          aria-label="Clear recording"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label
                        htmlFor="recording-transcript"
                        className={`block text-sm font-semibold mb-2 ${isDark ? 'text-emerald-100' : 'text-green-900'}`}
                      >
                        Transcript
                        {isPostRecordingTranscribing && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-r2d-accent">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            Updating…
                          </span>
                        )}
                      </label>
                      {recordingTranscribeError && (
                        <p className="text-sm text-red-600 dark:text-red-400 mb-2" role="alert">
                          {recordingTranscribeError}
                        </p>
                      )}
                      <textarea
                        id="recording-transcript"
                        value={recordingTranscript}
                        onChange={(e) => setRecordingTranscript(e.target.value)}
                        rows={8}
                        className={`w-full rounded-lg border px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-r2d-accent ${
                          isDark
                            ? 'bg-slate-900 border-slate-600 text-slate-100 placeholder:text-slate-500'
                            : 'bg-white border-green-200 text-slate-900 placeholder:text-slate-400'
                        }`}
                        placeholder={
                          isPostRecordingTranscribing
                            ? 'Transcribing your recording…'
                            : 'Transcript appears here. Edit if needed before you generate the SRS.'
                        }
                        aria-busy={isPostRecordingTranscribing}
                      />
                    </div>

                    <p className={`text-sm ${isDark ? 'text-emerald-200' : 'text-green-700'}`}>
                      When the transcript looks right, click <strong className="font-semibold">Process &amp; Generate SRS</strong> below. You can edit the text on the next step if needed, then run it again to finish.
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

          {/* Process Button */}
          <div className="text-center">
            <button
              onClick={processRequirements}
              disabled={!canProcess}
              className="w-full sm:w-auto bg-r2d-primary hover:bg-r2d-primaryLight disabled:bg-slate-400 text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 mx-auto shadow-md hover:shadow-lg disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-r2d-accent focus:ring-offset-2"
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
            {lastSRSAvailable && (
              <details className="mt-4 max-w-sm mx-auto text-left [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl cursor-pointer list-none font-medium border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors">
                  <FileText className="h-4 w-4 shrink-0 text-r2d-primary" aria-hidden="true" />
                  SRS quick links
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
                </summary>
                <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-lg py-1 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => navigate('/srs')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                  >
                    <FileText className="h-4 w-4 text-r2d-primary shrink-0" aria-hidden="true" />
                    View SRS document
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/results')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700"
                  >
                    <PanelLeft className="h-4 w-4 text-r2d-accent shrink-0" aria-hidden="true" />
                    Open processing results
                  </button>
                </div>
              </details>
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
