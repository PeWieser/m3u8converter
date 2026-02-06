/**
 * Chunked File Reader for large files
 * Reads files in chunks to avoid memory issues with WebAssembly
 */

export interface ChunkProgress {
  bytesRead: number;
  totalBytes: number;
  chunkIndex: number;
  totalChunks: number;
  percent: number;
}

export interface MemorySettings {
  chunkSizeMB: number;
  thriftyMode: boolean;
}

export const DEFAULT_MEMORY_SETTINGS: MemorySettings = {
  chunkSizeMB: 64,
  thriftyMode: false,
};

// Load settings from localStorage
export function loadMemorySettings(): MemorySettings {
  try {
    const stored = localStorage.getItem('ffmpeg-memory-settings');
    if (stored) {
      return { ...DEFAULT_MEMORY_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn('Failed to load memory settings:', e);
  }
  return DEFAULT_MEMORY_SETTINGS;
}

// Save settings to localStorage
export function saveMemorySettings(settings: MemorySettings): void {
  try {
    localStorage.setItem('ffmpeg-memory-settings', JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save memory settings:', e);
  }
}

/**
 * Read a file in chunks and return a complete Uint8Array
 * This is more memory-efficient for very large files as it processes in chunks
 */
export async function readFileInChunks(
  file: File,
  chunkSizeMB: number = 64,
  onProgress?: (progress: ChunkProgress) => void
): Promise<Uint8Array> {
  const chunkSize = chunkSizeMB * 1024 * 1024;
  const totalChunks = Math.ceil(file.size / chunkSize);
  
  // Pre-allocate the complete buffer
  const result = new Uint8Array(file.size);
  let bytesRead = 0;
  
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    
    // Read this chunk
    const chunk = file.slice(start, end);
    const arrayBuffer = await chunk.arrayBuffer();
    const chunkData = new Uint8Array(arrayBuffer);
    
    // Copy into result buffer
    result.set(chunkData, start);
    bytesRead += chunkData.length;
    
    // Report progress
    if (onProgress) {
      onProgress({
        bytesRead,
        totalBytes: file.size,
        chunkIndex: chunkIndex + 1,
        totalChunks,
        percent: Math.round((bytesRead / file.size) * 100),
      });
    }
    
    // Allow UI to update between chunks
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  return result;
}

/**
 * Get human-readable file size
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
 * Check if file is considered "large" and may need special handling
 */
export function isLargeFile(file: File): boolean {
  // Files over 500MB are considered large
  return file.size > 500 * 1024 * 1024;
}

/**
 * Check if file may cause memory issues
 */
export function mayExceedMemoryLimit(file: File): boolean {
  // Files over 1.5GB are likely to cause issues
  return file.size > 1.5 * 1024 * 1024 * 1024;
}

/**
 * Get memory warning message based on file size
 */
export function getMemoryWarning(file: File): string | null {
  if (file.size > 3 * 1024 * 1024 * 1024) {
    return `Diese Datei ist sehr groß (${formatFileSize(file.size)}). Dateien über 3GB können im Browser aufgrund von WebAssembly-Speicherlimits problematisch sein. Erwägen Sie die Verwendung von Desktop-FFmpeg.`;
  }
  if (file.size > 1.5 * 1024 * 1024 * 1024) {
    return `Große Datei erkannt (${formatFileSize(file.size)}). Aktivieren Sie den "Sparsamen Modus" für bessere Stabilität bei großen Dateien.`;
  }
  return null;
}
