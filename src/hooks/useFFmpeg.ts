import { useState, useRef, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type { ConversionJob, M3U8Playlist } from '@/types/converter';
import { parseM3U8, getBaseUrl } from '@/lib/m3u8-parser';

const FFMPEG_CORE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

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
      // source is already the content for local files
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
      
      // Estimate file size (rough: 500KB per second for video, 128kbps for audio)
      const estimatedSize = job.audioOnly 
        ? (playlist.totalDuration || 0) * 16 * 1024 // ~128kbps
        : (playlist.totalDuration || 0) * 500 * 1024; // ~4Mbps
      onEstimatedSize(estimatedSize);

      // Download segments with parallel threads
      const CONCURRENT_DOWNLOADS = 6; // Number of parallel download threads
      addLog(`Downloading segments (${CONCURRENT_DOWNLOADS} parallel threads)...`);
      const segmentFiles: string[] = new Array(segments.length).fill('');
      let completedDownloads = 0;
      
      const downloadSegment = async (index: number): Promise<void> => {
        const segment = segments[index];
        const filename = `segment_${index.toString().padStart(4, '0')}.ts`;
        
        try {
          const segmentData = await fetchFile(segment.uri);
          await ffmpeg.writeFile(filename, segmentData);
          segmentFiles[index] = filename;
        } catch (error) {
          addLog(`Warning: Failed to download segment ${index}, skipping...`);
          segmentFiles[index] = '';
        }
        
        completedDownloads++;
        const downloadProgress = (completedDownloads / segments.length) * 50;
        onProgress(downloadProgress, logs);
        
        if (completedDownloads % 10 === 0 || completedDownloads === segments.length) {
          addLog(`Downloaded ${completedDownloads}/${segments.length} segments`);
        }
      };
      
      // Process segments in batches for parallel downloading
      for (let i = 0; i < segments.length; i += CONCURRENT_DOWNLOADS) {
        const batch = segments.slice(i, i + CONCURRENT_DOWNLOADS);
        const batchPromises = batch.map((_, batchIndex) => 
          downloadSegment(i + batchIndex)
        );
        await Promise.all(batchPromises);
      }
      
      // Filter out failed downloads while maintaining order
      const validSegmentFiles = segmentFiles.filter(f => f !== '');

      if (validSegmentFiles.length === 0) {
        throw new Error('No segments could be downloaded');
      }

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
      // Create a proper ArrayBuffer from the data
      let arrayBuffer: ArrayBuffer;
      if (typeof data === 'string') {
        arrayBuffer = new TextEncoder().encode(data).buffer as ArrayBuffer;
      } else {
        // Create a new ArrayBuffer copy to avoid SharedArrayBuffer issues
        arrayBuffer = new ArrayBuffer(data.byteLength);
        new Uint8Array(arrayBuffer).set(data);
      }
      const blob = new Blob([arrayBuffer], { type: mimeType });
      
      addLog(`Conversion complete! Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
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
