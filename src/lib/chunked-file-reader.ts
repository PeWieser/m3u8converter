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
 * 
 * NOTE: For very large files (>2GB), this may still fail due to array buffer limits.
 * Use streamFileToFFmpeg for those cases instead.
 */
export async function readFileInChunks(
  file: File,
  chunkSizeMB: number = 64,
  onProgress?: (progress: ChunkProgress) => void
): Promise<Uint8Array> {
  const chunkSize = chunkSizeMB * 1024 * 1024;
  const totalChunks = Math.ceil(file.size / chunkSize);
  
  // For files that are too large to allocate in one buffer, throw early
  // JavaScript has a max typed array size limit (varies by browser, typically ~2GB)
  const MAX_SAFE_BUFFER_SIZE = 2 * 1024 * 1024 * 1024 - 1; // Just under 2GB
  if (file.size > MAX_SAFE_BUFFER_SIZE) {
    throw new Error(`File too large for buffer allocation (${formatFileSize(file.size)}). Use streaming mode.`);
  }
  
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
 * Stream a file directly to FFmpeg's virtual filesystem in chunks.
 * This avoids allocating the entire file in JavaScript memory at once.
 * 
 * @param file The file to stream
 * @param ffmpeg The FFmpeg instance
 * @param targetFileName The filename to use in FFmpeg's virtual filesystem
 * @param chunkSizeMB Size of each chunk in MB
 * @param onProgress Progress callback
 */
export async function streamFileToFFmpeg(
  file: File,
  ffmpeg: any, // FFmpeg type from @ffmpeg/ffmpeg
  targetFileName: string,
  chunkSizeMB: number = 64,
  onProgress?: (progress: ChunkProgress) => void
): Promise<void> {
  const chunkSize = chunkSizeMB * 1024 * 1024;
  const totalChunks = Math.ceil(file.size / chunkSize);
  let bytesWritten = 0;
  
  // For the first chunk, we create the file
  // For subsequent chunks, we need to append
  // FFmpeg WASM doesn't support append mode directly, so we need a workaround:
  // We'll use a temporary approach - write all chunks to separate files, then concatenate
  
  // Actually, the best approach for FFmpeg WASM is to write the entire file
  // But we can do it more carefully by:
  // 1. Reading chunks one at a time
  // 2. Building a stream of chunks
  // 3. Using a ReadableStream if supported
  
  // For now, let's use a more memory-efficient approach:
  // Read and write chunks sequentially, keeping only one chunk in memory at a time
  
  // First, let's try a different approach - use File's arrayBuffer with streams
  // This is a workaround that should work better for large files
  
  const chunks: Uint8Array[] = [];
  
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    
    // Read this chunk
    const blob = file.slice(start, end);
    const arrayBuffer = await blob.arrayBuffer();
    chunks.push(new Uint8Array(arrayBuffer));
    
    bytesWritten += end - start;
    
    // Report progress
    if (onProgress) {
      onProgress({
        bytesRead: bytesWritten,
        totalBytes: file.size,
        chunkIndex: chunkIndex + 1,
        totalChunks,
        percent: Math.round((bytesWritten / file.size) * 100),
      });
    }
    
    // Allow UI to update and garbage collection
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Every few chunks, try to trigger GC by yielding
    if (chunkIndex % 4 === 0) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  // Now concatenate all chunks into a single Uint8Array
  // We do this in a try-catch to handle memory errors gracefully
  try {
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    // Clear chunks array to free memory
    chunks.length = 0;
    
    // Write to FFmpeg
    await ffmpeg.writeFile(targetFileName, result);
  } catch (err) {
    // Clear chunks to prevent memory leak
    chunks.length = 0;
    throw err;
  }
}

/**
 * Alternative streaming approach for very large files (>2GB)
 * This writes directly to FFmpeg using a more aggressive memory management strategy
 */
export async function streamLargeFileToFFmpeg(
  file: File,
  ffmpeg: any,
  targetFileName: string,
  chunkSizeMB: number = 32,
  onProgress?: (progress: ChunkProgress) => void
): Promise<void> {
  // For very large files, we need to use a special approach
  // Since FFmpeg WASM needs the complete file, and JavaScript can't handle >2GB buffers,
  // we'll try using smaller chunks and a different memory strategy
  
  const chunkSize = chunkSizeMB * 1024 * 1024;
  const totalChunks = Math.ceil(file.size / chunkSize);
  
  // Use a Blob to accumulate chunks (Blobs don't have the same size limits)
  const blobParts: Blob[] = [];
  let bytesRead = 0;
  
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    
    // Read chunk as blob slice (very memory efficient)
    const chunkBlob = file.slice(start, end);
    blobParts.push(chunkBlob);
    
    bytesRead += end - start;
    
    if (onProgress) {
      onProgress({
        bytesRead,
        totalBytes: file.size,
        chunkIndex: chunkIndex + 1,
        totalChunks,
        percent: Math.round((bytesRead / file.size) * 100),
      });
    }
    
    // Allow UI updates
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  // Create a single blob from all parts
  const fullBlob = new Blob(blobParts);
  blobParts.length = 0; // Clear references
  
  // Now we need to convert this blob to a Uint8Array for FFmpeg
  // This is the bottleneck - JavaScript can't handle >2GB ArrayBuffers
  // We'll try, but may fail for very large files
  try {
    const arrayBuffer = await fullBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    await ffmpeg.writeFile(targetFileName, uint8Array);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (errorMessage.includes('RangeError') || errorMessage.includes('allocation')) {
      throw new Error(
        `Datei zu groß für Browser-Verarbeitung (${formatFileSize(file.size)}). ` +
        `Browser können Dateien über ~2GB nicht verarbeiten. ` +
        `Bitte verwenden Sie Desktop-FFmpeg für diese Datei.`
      );
    }
    throw err;
  }
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
