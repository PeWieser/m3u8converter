import { useState, useCallback, useEffect, useRef } from 'react';

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
}

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
  }, []);

  const pollStatus = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${API_BASE}/status`, {
        method: 'GET',
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      
      updateState({
        progress: data.percent || 0,
        progressMessage: data.message || '',
      });

      if (data.status === 'done') {
        stopStatusPolling();
        updateState({
          processing: false,
          progress: 100,
          progressMessage: '',
          status: 'Verarbeitung abgeschlossen!',
          error: null,
        });
      } else if (data.status === 'error') {
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
      console.error('Status polling error:', err);
    }
  }, [updateState, stopStatusPolling]);

  const startStatusPolling = useCallback(() => {
    stopStatusPolling();
    statusPollingRef.current = setInterval(pollStatus, 1000);
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
  ): Promise<{ success: boolean; error?: string }> => {
    if (!state.connected) {
      return { success: false, error: 'Nicht mit PC-Modul verbunden' };
    }

    if (!filePath) {
      return { success: false, error: 'Kein Dateipfad angegeben' };
    }

    try {
      updateState({ 
        processing: true, 
        progress: 0,
        progressMessage: '',
        status: 'Starte Verarbeitung...',
        error: null 
      });

      // Convert cover file to base64 if provided
      let coverBase64: string | null = null;
      if (coverFile) {
        coverBase64 = await fileToBase64(coverFile);
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
      };

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

      // Start polling for status
      startStatusPolling();

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
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
