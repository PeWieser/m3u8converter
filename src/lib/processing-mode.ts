/**
 * Processing Mode Detection and Management
 * Determines whether to use browser or local processing based on file size and connection status
 */

export type ProcessingMode = 'browser' | 'local' | 'auto';

export interface ProcessingRecommendation {
  mode: ProcessingMode;
  reason: string;
  warning?: string;
  canProcessInBrowser: boolean;
  requiresLocalBridge: boolean;
  showBridgePrompt: boolean;
}

// Thresholds
const LOCAL_RECOMMENDED_SIZE = 1.5 * 1024 * 1024 * 1024; // 1.5 GB
const BROWSER_HARD_LIMIT = 2 * 1024 * 1024 * 1024; // 2 GB

/**
 * Determine the recommended processing mode for a file
 */
export function getProcessingRecommendation(
  fileSize: number,
  localBridgeConnected: boolean
): ProcessingRecommendation {
  // Files over 2GB cannot be processed in browser at all
  if (fileSize > BROWSER_HARD_LIMIT) {
    return {
      mode: 'local',
      reason: 'Datei überschreitet das 2GB Browser-Limit',
      warning: localBridgeConnected 
        ? undefined 
        : 'PC-Modul muss gestartet werden für diese Datei',
      canProcessInBrowser: false,
      requiresLocalBridge: true,
      showBridgePrompt: !localBridgeConnected,
    };
  }
  
  // Files between 1.5GB and 2GB - recommend local but allow browser
  if (fileSize > LOCAL_RECOMMENDED_SIZE) {
    return {
      mode: localBridgeConnected ? 'local' : 'browser',
      reason: 'Große Datei - lokale Verarbeitung empfohlen',
      warning: localBridgeConnected 
        ? undefined 
        : 'Für mehr Stabilität wird das PC-Modul empfohlen. Browser-Verarbeitung ist möglich, aber riskanter.',
      canProcessInBrowser: true,
      requiresLocalBridge: false,
      showBridgePrompt: !localBridgeConnected,
    };
  }
  
  // Smaller files - prefer browser
  return {
    mode: 'browser',
    reason: 'Datei klein genug für Browser-Verarbeitung',
    canProcessInBrowser: true,
    requiresLocalBridge: false,
    showBridgePrompt: false,
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }
  if (bytes >= 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
  if (bytes >= 1024) {
    return (bytes / 1024).toFixed(2) + ' KB';
  }
  return bytes + ' bytes';
}

/**
 * Get threshold values for UI display
 */
export function getThresholds() {
  return {
    localRecommended: LOCAL_RECOMMENDED_SIZE,
    browserHardLimit: BROWSER_HARD_LIMIT,
    localRecommendedGB: 1.5,
    browserHardLimitGB: 2,
  };
}

/**
 * Check if file exceeds browser limit
 */
export function exceedsBrowserLimit(fileSize: number): boolean {
  return fileSize > BROWSER_HARD_LIMIT;
}

/**
 * Check if local processing is recommended
 */
export function isLocalRecommended(fileSize: number): boolean {
  return fileSize > LOCAL_RECOMMENDED_SIZE;
}
