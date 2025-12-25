import { useState, useRef, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type { ConversionMetadata } from '@/types/converter';
import { addGlobalLog } from '@/components/converter/GlobalLogWindow';

const FFMPEG_CORE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

export interface EditorJob {
  id: string;
  file: File;
  metadata: ConversionMetadata;
  coverFile?: File;
  progress: number;
  status: 'idle' | 'processing' | 'completed' | 'error';
  error?: string;
  outputBlob?: Blob;
  outputUrl?: string;
}

export function useFFmpegEditor() {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async () => {
    if (loaded || loading) return;
    
    setLoading(true);
    addGlobalLog('info', 'Loading FFmpeg engine...', 'MP4 Editor');
    try {
      const ffmpeg = new FFmpeg();
      
      ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg Editor]', message);
        addGlobalLog('ffmpeg', message, 'FFmpeg');
      });

      ffmpeg.on('progress', ({ progress }) => {
        setProgress(Math.round(progress * 100));
      });

      await ffmpeg.load({
        coreURL: await toBlobURL(`${FFMPEG_CORE_URL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${FFMPEG_CORE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      ffmpegRef.current = ffmpeg;
      setLoaded(true);
      addGlobalLog('success', 'FFmpeg loaded successfully', 'MP4 Editor');
    } catch (err) {
      console.error('Failed to load FFmpeg:', err);
      addGlobalLog('error', `Failed to load FFmpeg: ${err}`, 'MP4 Editor');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loaded, loading]);

  const editMetadata = useCallback(async (
    videoFile: File,
    metadata: ConversionMetadata,
    coverFile?: File,
    onProgress?: (progress: number) => void
  ): Promise<Blob> => {
    if (!ffmpegRef.current) {
      throw new Error('FFmpeg not loaded');
    }

    const ffmpeg = ffmpegRef.current;
    setProcessing(true);
    setProgress(0);

    try {
      // Write input video to virtual filesystem
      const inputFileName = 'input.mp4';
      const outputFileName = 'output.mp4';
      
      addGlobalLog('info', `Writing video file (${(videoFile.size / 1024 / 1024).toFixed(2)} MB) to FFmpeg filesystem...`, 'MP4 Editor');
      await ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));
      addGlobalLog('success', 'Video file loaded into FFmpeg', 'MP4 Editor');

      // Build FFmpeg command args
      const args: string[] = ['-i', inputFileName];

      // Add cover image if provided
      let hasCover = false;
      if (coverFile) {
        const coverExt = coverFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        const coverFileName = `cover.${coverExt}`;
        addGlobalLog('info', `Adding cover image: ${coverFileName}`, 'MP4 Editor');
        await ffmpeg.writeFile(coverFileName, await fetchFile(coverFile));
        args.push('-i', coverFileName);
        hasCover = true;
      }

      // Map streams
      args.push('-map', '0');
      if (hasCover) {
        args.push('-map', '1');
      }

      // Copy streams without re-encoding (fast!)
      args.push('-c', 'copy');

      // Set cover image disposition if present
      if (hasCover) {
        args.push('-disposition:v:1', 'attached_pic');
      }

      // Add metadata
      if (metadata.title) {
        args.push('-metadata', `title=${metadata.title}`);
      }
      if (metadata.show) {
        args.push('-metadata', `show=${metadata.show}`);
      }
      if (metadata.season) {
        args.push('-metadata', `season_number=${metadata.season}`);
      }
      if (metadata.episode) {
        args.push('-metadata', `episode_sort=${metadata.episode}`);
      }
      if (metadata.date) {
        args.push('-metadata', `date=${metadata.date}`);
      }
      if (metadata.director || metadata.author) {
        args.push('-metadata', `artist=${metadata.director || metadata.author}`);
      }
      if (metadata.genre) {
        args.push('-metadata', `genre=${metadata.genre}`);
      }
      if (metadata.description) {
        args.push('-metadata', `description=${metadata.description}`);
      }

      args.push(outputFileName);

      addGlobalLog('info', `Executing FFmpeg with ${args.length} arguments...`, 'MP4 Editor');
      addGlobalLog('info', `FFmpeg command: ffmpeg ${args.join(' ')}`, 'MP4 Editor');
      await ffmpeg.exec(args);
      addGlobalLog('success', 'FFmpeg processing complete', 'MP4 Editor');

      // Read output file
      addGlobalLog('info', 'Reading output file...', 'MP4 Editor');
      const data = await ffmpeg.readFile(outputFileName);
      
      // Cleanup
      try { await ffmpeg.deleteFile(inputFileName); } catch {}
      try { await ffmpeg.deleteFile(outputFileName); } catch {}
      if (coverFile) {
        try { await ffmpeg.deleteFile(`cover.${coverFile.name.split('.').pop()?.toLowerCase() || 'jpg'}`); } catch {}
      }

      // Create blob properly
      addGlobalLog('info', `Data type: ${typeof data}, Is Uint8Array: ${data instanceof Uint8Array}`, 'MP4 Editor');
      
      let blob: Blob;
      if (data instanceof Uint8Array) {
        // Copy to a new ArrayBuffer to ensure it's a standard ArrayBuffer (not SharedArrayBuffer)
        const buffer = new ArrayBuffer(data.byteLength);
        new Uint8Array(buffer).set(data);
        blob = new Blob([buffer], { type: 'video/mp4' });
      } else {
        // Fallback for string (shouldn't happen with binary files)
        const encoder = new TextEncoder();
        const encoded = encoder.encode(data as string);
        const buffer = new ArrayBuffer(encoded.byteLength);
        new Uint8Array(buffer).set(encoded);
        blob = new Blob([buffer], { type: 'video/mp4' });
      }
      
      addGlobalLog('info', `Output blob size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`, 'MP4 Editor');
      
      if (blob.size === 0) {
        addGlobalLog('error', 'Output file is empty - FFmpeg processing may have failed', 'MP4 Editor');
        throw new Error('Output file is empty - FFmpeg processing may have failed. Check console for FFmpeg logs.');
      }
      
      setProgress(100);
      addGlobalLog('success', `Metadata embedding complete! Output: ${(blob.size / 1024 / 1024).toFixed(2)} MB`, 'MP4 Editor');
      
      return blob;
    } catch (err) {
      console.error('Failed to edit metadata:', err);
      addGlobalLog('error', `Failed to edit metadata: ${err}`, 'MP4 Editor');
      throw err;
    } finally {
      setProcessing(false);
    }
  }, []);

  return {
    load,
    loaded,
    loading,
    progress,
    processing,
    editMetadata,
  };
}
