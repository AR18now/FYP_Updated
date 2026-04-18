/**
 * Storage utility for managing previous inputs and SRS documents
 * Uses localStorage for client-side persistence
 */

const STORAGE_KEYS = {
  INPUTS: 'req2design_inputs_history',
  SRS_DOCUMENTS: 'req2design_srs_history',
  SETTINGS: 'req2design_settings'
};

/**
 * Get all stored inputs
 */
export const getStoredInputs = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.INPUTS);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading stored inputs:', error);
    return [];
  }
};

/**
 * Convert Blob to base64 string for storage
 */
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = (error) => {
        console.error('Error converting blob to base64:', error);
        reject(error);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error setting up FileReader:', error);
      reject(error);
    }
  });
};

/**
 * Save a new input to storage
 */
export const saveInput = async (inputData) => {
  try {
    const inputs = getStoredInputs();
    
    // Convert audio blob to base64 if present
    let audioData = null;
    let audioMimeType = null;
    if (inputData.audioBlob && inputData.audioBlob instanceof Blob) {
      try {
        audioData = await blobToBase64(inputData.audioBlob);
        audioMimeType = inputData.audioBlob.type || 'audio/webm';
      } catch (error) {
        console.warn('Failed to convert audio blob to base64:', error);
      }
    }
    
    const newInput = {
      id: `input_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      projectInfo: inputData.projectInfo || {},
      inputType: inputData.inputType || 'text',
      content: inputData.content || '',
      fileNames: inputData.fileNames || [],
      // Store audio data if available
      audioData: audioData,
      audioMimeType: audioMimeType,
      // Store transcription if available
      transcription: inputData.transcription || inputData.liveTranscription || '',
      // Store results if available
      results: inputData.results || null,
      ...inputData
    };
    
    // Remove audioBlob from stored data (we've converted it)
    delete newInput.audioBlob;
    
    // Add to beginning of array (most recent first)
    inputs.unshift(newInput);
    
    // Keep only last 50 inputs
    const limited = inputs.slice(0, 50);
    
    localStorage.setItem(STORAGE_KEYS.INPUTS, JSON.stringify(limited));
    return newInput;
  } catch (error) {
    console.error('Error saving input:', error);
    return null;
  }
};

/**
 * Get all stored SRS documents
 */
export const getStoredSRS = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SRS_DOCUMENTS);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading stored SRS:', error);
    return [];
  }
};

/**
 * Save a new SRS document to storage
 * Always creates a new entry (allows multiple SRS per project)
 */
export const saveSRS = (srsData) => {
  try {
    const srsList = getStoredSRS();
    const newSRS = {
      id: srsData.document_id || `srs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      document_id: srsData.document_id || `srs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: srsData.title || 'SRS Document',
      version: srsData.version || '1.0',
      date: srsData.date || new Date().toISOString().split('T')[0],
      author: srsData.author || '',
      raw_text: srsData.raw_text || '',
      sections: srsData.sections || {},
      textual_usecases: srsData.textual_usecases || null,
      edited_html: srsData.edited_html || null,
      // Store preview for quick view
      preview: srsData.raw_text ? srsData.raw_text.substring(0, 200) + '...' : ''
    };
    
    // Always add as new entry (don't update existing) to allow multiple SRS documents
    srsList.unshift(newSRS);
    
    // Keep only last 50 SRS documents (increased from 30)
    const limited = srsList.slice(0, 50);
    
    localStorage.setItem(STORAGE_KEYS.SRS_DOCUMENTS, JSON.stringify(limited));
    return newSRS;
  } catch (error) {
    console.error('Error saving SRS:', error);
    // If storage is full, try to clear old items
    if (error.name === 'QuotaExceededError') {
      try {
        const srsList = getStoredSRS();
        // Keep only last 20
        const limited = srsList.slice(0, 20);
        localStorage.setItem(STORAGE_KEYS.SRS_DOCUMENTS, JSON.stringify(limited));
        // Retry saving
        return saveSRS(srsData);
      } catch (retryError) {
        console.error('Error retrying save after quota exceeded:', retryError);
      }
    }
    return null;
  }
};

/**
 * Get a specific SRS by document_id
 */
export const getSRSById = (documentId) => {
  if (documentId == null || String(documentId).trim() === '') {
    return null;
  }
  try {
    const srsList = getStoredSRS();
    return srsList.find(srs => srs.document_id === documentId || srs.id === documentId);
  } catch (error) {
    console.error('Error getting SRS by ID:', error);
    return null;
  }
};

/**
 * Delete a stored input
 */
export const deleteInput = (inputId) => {
  try {
    const inputs = getStoredInputs();
    const filtered = inputs.filter(input => input.id !== inputId);
    localStorage.setItem(STORAGE_KEYS.INPUTS, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting input:', error);
    return false;
  }
};

/**
 * Delete a stored SRS
 */
export const deleteSRS = (documentId) => {
  if (documentId == null || String(documentId).trim() === '') {
    return false;
  }
  try {
    const srsList = getStoredSRS();
    const filtered = srsList.filter(srs => srs.document_id !== documentId && srs.id !== documentId);
    localStorage.setItem(STORAGE_KEYS.SRS_DOCUMENTS, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting SRS:', error);
    return false;
  }
};

/**
 * Clear all stored data
 */
export const clearAllStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.INPUTS);
    localStorage.removeItem(STORAGE_KEYS.SRS_DOCUMENTS);
    return true;
  } catch (error) {
    console.error('Error clearing storage:', error);
    return false;
  }
};

/**
 * Get storage statistics
 */
export const getStorageStats = () => {
  try {
    const inputs = getStoredInputs();
    const srsList = getStoredSRS();
    
    // Calculate approximate size
    const inputsSize = JSON.stringify(inputs).length;
    const srsSize = JSON.stringify(srsList).length;
    const totalSize = inputsSize + srsSize;
    
    return {
      inputsCount: inputs.length,
      srsCount: srsList.length,
      totalSize: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
    };
  } catch (error) {
    console.error('Error getting storage stats:', error);
    return { inputsCount: 0, srsCount: 0, totalSize: 0, totalSizeMB: '0.00' };
  }
};

