import { useState, useRef, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type { ConversionJob, M3U8Playlist } from '@/types/converter';
import { parseM3U8, getBaseUrl } from '@/lib/m3u8-parser';

const FFMPEG_CORE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

// Number of concurrent download threads - optimized for speed
const CONCURRENT_DOWNLOADS = 16;

// Retry configuration for failed downloads
const MAX_RETRIES = 3;
const RETRY_DELAY = 500;

export function useFFmpeg() {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (loaded || loading) return;
    
    setLoading(true);
    try {
      const ffmpeg = new FFmpeg();
      
      ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
      });

      await ffmpeg.load({
        coreURL: await toBlobURL(`${FFMPEG_CORE_URL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${FFMPEG_CORE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      ffmpegRef.current = ffmpeg;
      setLoaded(true);
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [loaded, loading]);

  const fetchM3U8Content = async (source: string, sourceType: 'file' | 'url'): Promise<{ content: string; baseUrl?: string }> => {
    if (sourceType === 'file') {
      return { content: source };
    }
    
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch M3U8: ${response.statusText}`);
    }
    return { 
      content: await response.text(), 
      baseUrl: getBaseUrl(source) 
    };
  };

  // Optimized fetch with retries and connection reuse
  const fetchWithRetry = async (url: string, retries = MAX_RETRIES): Promise<ArrayBuffer> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          // Keep-alive is enabled by default in modern browsers
          // This helps with connection pooling
        });
        
        if (response.status === 429) {
          // Rate limited - back off exponentially
          const backoffTime = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          continue;
        }
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.arrayBuffer();
      } catch (error) {
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (attempt + 1)));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Max retries exceeded');
  };

  const convert = useCallback(async (
    job: ConversionJob,
    onProgress: (progress: number, logs: string[]) => void,
    onEstimatedSize: (size: number) => void
  ): Promise<Blob> => {
    if (!ffmpegRef.current) {
      throw new Error('FFmpeg not loaded');
    }

    const ffmpeg = ffmpegRef.current;
    const logs: string[] = [];
    const addLog = (msg: string) => {
      logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
      onProgress(0, [...logs]);
    };

    try {
      addLog('Parsing M3U8 playlist...');
      
      const { content, baseUrl } = await fetchM3U8Content(job.source, job.sourceType);
      let playlist: M3U8Playlist = await parseM3U8(content, baseUrl);
      
      // If master playlist and variant selected, fetch the media playlist
      if (playlist.type === 'master' && job.selectedVariant) {
        addLog(`Fetching ${job.selectedVariant.name} quality stream...`);
        const variantResponse = await fetch(job.selectedVariant.uri);
        const variantContent = await variantResponse.text();
        playlist = await parseM3U8(variantContent, getBaseUrl(job.selectedVariant.uri));
      }

      if (playlist.type !== 'media' || !playlist.segments) {
        throw new Error('No valid media segments found');
      }

      const segments = playlist.segments;
      addLog(`Found ${segments.length} segments (${Math.round(playlist.totalDuration || 0)}s)`);
      
      // Estimate file size
      const estimatedSize = job.audioOnly 
        ? (playlist.totalDuration || 0) * 16 * 1024
        : (playlist.totalDuration || 0) * 500 * 1024;
      onEstimatedSize(estimatedSize);

      // Download segments with high-speed parallel threads
      addLog(`Downloading segments (${CONCURRENT_DOWNLOADS} parallel connections)...`);
      
      // RAM buffer for all segments - avoid disk I/O
      const segmentBuffers: Map<number, Uint8Array> = new Map();
      let completedDownloads = 0;
      let failedDownloads = 0;
      const startTime = Date.now();
      
      // Create a semaphore for controlling concurrency
      const downloadSegment = async (index: number): Promise<void> => {
        const segment = segments[index];
        
        try {
          const arrayBuffer = await fetchWithRetry(segment.uri);
          segmentBuffers.set(index, new Uint8Array(arrayBuffer));
        } catch (error) {
          console.warn(`Failed to download segment ${index}:`, error);
          failedDownloads++;
        }
        
        completedDownloads++;
        const downloadProgress = (completedDownloads / segments.length) * 50;
        onProgress(downloadProgress, logs);
        
        // Update log every 20 segments or at completion
        if (completedDownloads % 20 === 0 || completedDownloads === segments.length) {
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = completedDownloads / elapsed;
          addLog(`Downloaded ${completedDownloads}/${segments.length} segments (${speed.toFixed(1)} seg/s)`);
        }
      };
      
      // Process segments in parallel batches for maximum throughput
      const batchDownload = async () => {
        const queue: Promise<void>[] = [];
        let nextIndex = 0;
        
        const processNext = async (): Promise<void> => {
          if (nextIndex >= segments.length) return;
          
          const currentIndex = nextIndex++;
          await downloadSegment(currentIndex);
          await processNext();
        };
        
        // Start CONCURRENT_DOWNLOADS parallel workers
        for (let i = 0; i < Math.min(CONCURRENT_DOWNLOADS, segments.length); i++) {
          queue.push(processNext());
        }
        
        await Promise.all(queue);
      };
      
      await batchDownload();
      
      const downloadedCount = segmentBuffers.size;
      
      if (downloadedCount === 0) {
        throw new Error('No segments could be downloaded');
      }

      if (failedDownloads > 0) {
        addLog(`Warning: ${failedDownloads} segments failed, continuing with ${downloadedCount} segments`);
      }

      // Write segments to FFmpeg filesystem in order
      addLog('Preparing segments for conversion...');
      const validSegmentFiles: string[] = [];
      
      for (let i = 0; i < segments.length; i++) {
        const buffer = segmentBuffers.get(i);
        if (buffer) {
          const filename = `segment_${i.toString().padStart(4, '0')}.ts`;
          await ffmpeg.writeFile(filename, buffer);
          validSegmentFiles.push(filename);
        }
      }
      
      // Clear RAM buffer
      segmentBuffers.clear();

      // Create concat file
      const concatContent = validSegmentFiles.map(f => `file '${f}'`).join('\n');
      await ffmpeg.writeFile('concat.txt', concatContent);

      addLog('Converting to ' + (job.audioOnly ? 'MP3' : 'MP4') + '...');
      
      const outputFile = job.audioOnly ? 'output.mp3' : 'output.mp4';
      
      ffmpeg.on('progress', ({ progress }) => {
        const conversionProgress = 50 + (progress * 50);
        onProgress(Math.min(conversionProgress, 99), logs);
      });

      const args = job.audioOnly
        ? ['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-vn', '-acodec', 'libmp3lame', '-q:a', '2', outputFile]
        : ['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', '-movflags', '+faststart', outputFile];

      await ffmpeg.exec(args);

      addLog('Reading output file...');
      const data = await ffmpeg.readFile(outputFile);
      
      // Cleanup
      for (const file of validSegmentFiles) {
        try { await ffmpeg.deleteFile(file); } catch {}
      }
      try { await ffmpeg.deleteFile('concat.txt'); } catch {}
      try { await ffmpeg.deleteFile(outputFile); } catch {}

      const mimeType = job.audioOnly ? 'audio/mp3' : 'video/mp4';
      let arrayBuffer: ArrayBuffer;
      if (typeof data === 'string') {
        arrayBuffer = new TextEncoder().encode(data).buffer as ArrayBuffer;
      } else {
        arrayBuffer = new ArrayBuffer(data.byteLength);
        new Uint8Array(arrayBuffer).set(data);
      }
      const blob = new Blob([arrayBuffer], { type: mimeType });
      
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      addLog(`Conversion complete! Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB in ${totalTime}s`);
      onProgress(100, logs);
      
      return blob;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Error: ${errorMsg}`);
      throw error;
    }
  }, []);

  return { 
    load, 
    loaded, 
    loading, 
    convert,
    ffmpeg: ffmpegRef.current 
  };
}
