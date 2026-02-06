import { useState, useCallback, useEffect, useRef } from 'react';

const API_BASE = 'http://localhost:5000';

export interface LocalBridgeMetadata {
  title?: string;
  author?: string;
  show?: string;
  season?: string;
  episode?: string;
  date?: string;
  director?: string;
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
  error: string | null;
}

export const useLocalBridge = () => {
  const [state, setState] = useState<LocalBridgeState>({
    connected: false,
    checking: true,
    filePath: null,
    status: 'Prüfe Verbindung...',
    processing: false,
    progress: 0,
    error: null,
  });

  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  const startConversion = useCallback(async (
    metadata: LocalBridgeMetadata,
    coverPath?: string,
    outputPath?: string
  ): Promise<{ success: boolean; outputPath?: string; error?: string }> => {
    if (!state.connected || !state.filePath) {
      return { success: false, error: 'Keine Datei ausgewählt oder nicht verbunden' };
    }

    try {
      updateState({ 
        processing: true, 
        progress: 0,
        status: 'Starte Verarbeitung...',
        error: null 
      });

      const response = await fetch(`${API_BASE}/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: state.filePath,
          metadata,
          coverPath,
          outputPath,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Verarbeitung fehlgeschlagen');
      }

      const data = await response.json();

      updateState({ 
        processing: false, 
        progress: 100,
        status: 'Verarbeitung abgeschlossen!',
        error: null 
      });

      return { success: true, outputPath: data.outputPath };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      updateState({ 
        processing: false, 
        progress: 0,
        status: 'Verarbeitung fehlgeschlagen',
        error: message 
      });
      return { success: false, error: message };
    }
  }, [state.connected, state.filePath, updateState]);

  const clearFile = useCallback(() => {
    updateState({ 
      filePath: null, 
      status: state.connected ? 'Verbunden mit PC-Modul' : 'Nicht verbunden',
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
    };
  }, [checkConnection]);

  return {
    ...state,
    checkConnection,
    selectFile,
    startConversion,
    clearFile,
    openModule,
  };
};
