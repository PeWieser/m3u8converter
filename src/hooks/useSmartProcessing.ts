import { useState, useCallback, useEffect, useRef } from 'react';
import { getProcessingRecommendation, type ProcessingRecommendation } from '@/lib/processing-mode';
import { 
  isSupportedVideoFormat, 
  getFormatCapabilities,
  getFormatWarnings,
  type VideoFormatInfo 
} from '@/lib/video-format-utils';
import { useLocalBridge } from './useLocalBridge';

export interface SmartFileSelection {
  file: File | null;
  filePath: string | null; // For local bridge files
  isLocalFile: boolean;
  recommendation: ProcessingRecommendation | null;
  formatInfo: VideoFormatInfo | null;
  formatWarnings: string[];
}

export interface UseSmartProcessingResult {
  // File selection state
  selection: SmartFileSelection;
  
  // Local bridge state
  bridgeConnected: boolean;
  bridgeChecking: boolean;
  
  // Actions
  selectBrowserFile: (file: File) => void;
  selectLocalFile: () => Promise<string | null>;
  clearSelection: () => void;
  checkBridgeConnection: () => Promise<boolean>;
  openBridgeModule: () => void;
  
  // Processing status
  shouldUseLocalProcessing: boolean;
  canProcessInBrowser: boolean;
}

export function useSmartProcessing(): UseSmartProcessingResult {
  const localBridge = useLocalBridge();
  
  const [selection, setSelection] = useState<SmartFileSelection>({
    file: null,
    filePath: null,
    isLocalFile: false,
    recommendation: null,
    formatInfo: null,
    formatWarnings: [],
  });

  // When a browser file is selected
  const selectBrowserFile = useCallback((file: File) => {
    if (!isSupportedVideoFormat(file)) {
      throw new Error('Nicht unterstütztes Videoformat');
    }
    
    const formatInfo = getFormatCapabilities(file);
    const formatWarnings = getFormatWarnings(file);
    const recommendation = getProcessingRecommendation(file.size, localBridge.connected);
    
    setSelection({
      file,
      filePath: null,
      isLocalFile: false,
      recommendation,
      formatInfo,
      formatWarnings,
    });
  }, [localBridge.connected]);

  // When a local file is selected via bridge
  const selectLocalFile = useCallback(async (): Promise<string | null> => {
    const path = await localBridge.selectFile();
    
    if (path) {
      // For local files, we don't have the File object directly
      // The local bridge handles the file
      setSelection({
        file: null,
        filePath: path,
        isLocalFile: true,
        recommendation: {
          mode: 'local',
          reason: 'Lokale Datei via PC-Modul',
          canProcessInBrowser: false,
          requiresLocalBridge: true,
          showBridgePrompt: false,
        },
        formatInfo: null, // Will be determined by local bridge
        formatWarnings: [],
      });
      
      return path;
    }
    
    return null;
  }, [localBridge]);

  // Clear current selection
  const clearSelection = useCallback(() => {
    setSelection({
      file: null,
      filePath: null,
      isLocalFile: false,
      recommendation: null,
      formatInfo: null,
      formatWarnings: [],
    });
    localBridge.clearFile();
  }, [localBridge]);

  // Update recommendation when bridge connection changes
  useEffect(() => {
    if (selection.file) {
      const recommendation = getProcessingRecommendation(
        selection.file.size, 
        localBridge.connected
      );
      setSelection(prev => ({ ...prev, recommendation }));
    }
  }, [localBridge.connected, selection.file]);

  // Computed values
  const shouldUseLocalProcessing = 
    selection.isLocalFile || 
    (selection.recommendation?.mode === 'local' && localBridge.connected);
    
  const canProcessInBrowser = 
    selection.recommendation?.canProcessInBrowser ?? true;

  return {
    selection,
    bridgeConnected: localBridge.connected,
    bridgeChecking: localBridge.checking,
    selectBrowserFile,
    selectLocalFile,
    clearSelection,
    checkBridgeConnection: localBridge.checkConnection,
    openBridgeModule: localBridge.openModule,
    shouldUseLocalProcessing,
    canProcessInBrowser,
  };
}
