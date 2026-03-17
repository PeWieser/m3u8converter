import { useState, useCallback, useEffect, useRef } from 'react';
import { addGlobalLog } from '@/components/converter/GlobalLogWindow';

const API_BASE = 'http://127.0.0.1:5001';

export interface LocalBridgeMetadata {
  title?: string;
  show?: string;
  season?: string;
  episode?: string;
  artist?: string;
  year?: string;
  genre?: string;
  description?: string;
}

export interface LocalBridgeState {
  connected: boolean;
  checking: boolean;
  filePath: string | null;
  status: string;
  processing: boolean;
  progress: number;
  progressMessage: string;
  error: string | null;
}

export interface LocalBridgeStartPayload {
  path: string;
  title: string;
  show: string;
  season: string;
  episode: string;
  artist: string;
  year: string;
  genre: string;
  description: string;
  cover: string | null;
  overwrite: boolean;
  outputFolder: string;
}

interface LocalLogEntry {
  time: string;
  text: string;
  color: string;
}

// Track which logs we've already sent to avoid duplicates
let lastLogCount = 0;

export const useLocalBridge = () => {
  const [state, setState] = useState<LocalBridgeState>({
    connected: false,
    checking: true,
    filePath: null,
    status: 'Prüfe Verbindung...',
    processing: false,
    progress: 0,
    progressMessage: '',
    error: null,
  });

  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statusPollingRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  const updateState = useCallback((updates: Partial<LocalBridgeState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${API_BASE}/`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        updateState({ 
          connected: true, 
          checking: false,
          status: 'Verbunden mit PC-Modul',
          error: null 
        });
        return true;
      }
      throw new Error('Server not ready');
    } catch {
      updateState({ 
        connected: false, 
        checking: false,
        status: 'Nicht verbunden',
        error: null 
      });
      return false;
    }
  }, [updateState]);

  const selectFile = useCallback(async (): Promise<string | null> => {
    if (!state.connected) {
      updateState({ error: 'Nicht mit PC-Modul verbunden' });
      return null;
    }

    try {
      updateState({ status: 'Öffne Dateiauswahl...' });

      const response = await fetch(`${API_BASE}/select-file`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Dateiauswahl fehlgeschlagen');
      }

      const data = await response.json();
      
      if (data.path) {
        updateState({ 
          filePath: data.path, 
          status: `Datei ausgewählt: ${data.path.split(/[/\\]/).pop()}`,
          error: null 
        });
        return data.path;
      } else if (data.cancelled) {
        updateState({ status: 'Dateiauswahl abgebrochen' });
        return null;
      }
      
      throw new Error('Keine Datei ausgewählt');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      updateState({ 
        error: message, 
        status: 'Fehler bei Dateiauswahl' 
      });
      return null;
    }
  }, [state.connected, updateState]);

  const stopStatusPolling = useCallback(() => {
    if (statusPollingRef.current) {
      clearInterval(statusPollingRef.current);
      statusPollingRef.current = null;
    }
    isPollingRef.current = false;
    lastLogCount = 0; // Reset log counter when stopping
  }, []);

  const fetchLogs = useCallback(async (): Promise<void> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(`${API_BASE}/logs`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return;
      }

      const logs: LocalLogEntry[] = await response.json();
      
      // Only add new logs (compare by count to avoid duplicates)
      if (logs.length > lastLogCount) {
        const newLogs = logs.slice(lastLogCount);
        newLogs.forEach((log) => {
          // Determine log type based on color or content
          let logType: 'info' | 'success' | 'warning' | 'error' | 'ffmpeg' = 'ffmpeg';
          if (log.color === '#ff5555' || log.text.toLowerCase().includes('error')) {
            logType = 'error';
          } else if (log.color === '#50fa7b' || log.text.toLowerCase().includes('success') || log.text.toLowerCase().includes('done')) {
            logType = 'success';
          } else if (log.color === '#f1fa8c' || log.text.toLowerCase().includes('warn')) {
            logType = 'warning';
          }
          
          addGlobalLog(logType, log.text, 'PC-Modul');
        });
        lastLogCount = logs.length;
      }
    } catch {
      // Silently ignore log fetch errors
    }
  }, []);

  const pollStatus = useCallback(async (): Promise<void> => {
    if (!isPollingRef.current) return;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(`${API_BASE}/status`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn('Status poll response not ok:', response.status);
        return;
      }

      const data = await response.json();
      console.log('Status poll response:', data);
      
      // Update progress and message
      updateState({
        progress: data.percent || 0,
        progressMessage: data.message || '',
        status: data.message || 'Verarbeite...',
      });

      // Also fetch logs
      await fetchLogs();

      if (data.status === 'done') {
        addGlobalLog('success', 'Verarbeitung erfolgreich abgeschlossen!', 'PC-Modul');
        stopStatusPolling();
        updateState({
          processing: false,
          progress: 100,
          progressMessage: 'Fertig!',
          status: 'Verarbeitung abgeschlossen!',
          error: null,
        });
      } else if (data.status === 'error') {
        addGlobalLog('error', data.message || 'Verarbeitung fehlgeschlagen', 'PC-Modul');
        stopStatusPolling();
        updateState({
          processing: false,
          progress: 0,
          progressMessage: '',
          status: 'Verarbeitung fehlgeschlagen',
          error: data.message || 'Unbekannter Fehler',
        });
      }
    } catch (err) {
      // Don't stop polling on transient errors, just log them
      console.warn('Status polling error (will retry):', err);
    }
  }, [updateState, stopStatusPolling, fetchLogs]);

  const startStatusPolling = useCallback(() => {
    console.log('Starting status polling...');
    stopStatusPolling();
    isPollingRef.current = true;
    lastLogCount = 0; // Reset log counter
    
    // Poll immediately, then every 500ms (faster for smoother updates)
    pollStatus();
    statusPollingRef.current = setInterval(pollStatus, 500);
  }, [pollStatus, stopStatusPolling]);

  const fileToBase64 = useCallback(async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const startConversion = useCallback(async (
    filePath: string,
    metadata: LocalBridgeMetadata,
    coverFile?: File,
    overwrite: boolean = false,
    outputFolder: string = 'converted',
  ): Promise<{ success: boolean; error?: string }> => {
    if (!state.connected) {
      return { success: false, error: 'Nicht mit PC-Modul verbunden' };
    }

    if (!filePath) {
      return { success: false, error: 'Kein Dateipfad angegeben' };
    }

    try {
      // Reset state for new conversion
      lastLogCount = 0;
      
      updateState({ 
        processing: true, 
        progress: 0,
        progressMessage: 'Starte...',
        status: 'Starte Verarbeitung...',
        error: null 
      });

      addGlobalLog('info', `Starte lokale Verarbeitung: ${filePath.split(/[/\\]/).pop()}`, 'PC-Modul');

      // Convert cover file to base64 if provided
      let coverBase64: string | null = null;
      if (coverFile) {
        coverBase64 = await fileToBase64(coverFile);
        addGlobalLog('info', 'Cover-Bild wird eingebettet', 'PC-Modul');
      }

      const payload: LocalBridgeStartPayload = {
        path: filePath,
        title: metadata.title || '',
        show: metadata.show || '',
        season: metadata.season || '',
        episode: metadata.episode || '',
        artist: metadata.artist || '',
        year: metadata.year || '',
        genre: metadata.genre || '',
        description: metadata.description || '',
        cover: coverBase64,
        overwrite: overwrite,
      };

      console.log('Sending start request with payload:', { ...payload, cover: payload.cover ? '[BASE64]' : null });

      const response = await fetch(`${API_BASE}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Verarbeitung fehlgeschlagen');
      }

      const responseData = await response.json().catch(() => ({}));
      console.log('Start response:', responseData);

      addGlobalLog('info', 'Verarbeitung gestartet, warte auf Fortschritt...', 'PC-Modul');

      // Start polling for status IMMEDIATELY after successful start
      console.log('Starting status polling immediately after /start success');
      startStatusPolling();

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      console.error('Start conversion error:', err);
      addGlobalLog('error', `Fehler beim Starten: ${message}`, 'PC-Modul');
      updateState({ 
        processing: false, 
        progress: 0,
        progressMessage: '',
        status: 'Verarbeitung fehlgeschlagen',
        error: message 
      });
      return { success: false, error: message };
    }
  }, [state.connected, updateState, fileToBase64, startStatusPolling]);

  const clearFile = useCallback(() => {
    updateState({ 
      filePath: null, 
      status: state.connected ? 'Verbunden mit PC-Modul' : 'Nicht verbunden',
      error: null 
    });
  }, [state.connected, updateState]);

  const setFilePath = useCallback((path: string | null) => {
    updateState({ 
      filePath: path, 
      status: path 
        ? `Datei ausgewählt: ${path.split(/[/\\]/).pop()}`
        : (state.connected ? 'Verbunden mit PC-Modul' : 'Nicht verbunden'),
      error: null 
    });
  }, [state.connected, updateState]);

  const openModule = useCallback(() => {
    window.location.href = 'my-converter://';
  }, []);

  // Initial connection check and periodic re-check
  useEffect(() => {
    checkConnection();

    // Re-check connection every 5 seconds
    checkIntervalRef.current = setInterval(() => {
      checkConnection();
    }, 5000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      stopStatusPolling();
    };
  }, [checkConnection, stopStatusPolling]);

  return {
    ...state,
    checkConnection,
    selectFile,
    startConversion,
    clearFile,
    setFilePath,
    openModule,
  };
};
