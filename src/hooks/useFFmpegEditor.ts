import { useState, useRef, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type { ConversionMetadata } from '@/types/converter';

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
    try {
      const ffmpeg = new FFmpeg();
      
      ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg Editor]', message);
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
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      throw error;
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
      
      console.log('Writing video file to FFmpeg filesystem...');
      await ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));

      // Build FFmpeg command args
      const args: string[] = ['-i', inputFileName];

      // Add cover image if provided
      let hasCover = false;
      if (coverFile) {
        const coverExt = coverFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        const coverFileName = `cover.${coverExt}`;
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

      console.log('Running FFmpeg with args:', args.join(' '));
      await ffmpeg.exec(args);

      // Read output file
      const data = await ffmpeg.readFile(outputFileName);
      
      // Cleanup
      try { await ffmpeg.deleteFile(inputFileName); } catch {}
      try { await ffmpeg.deleteFile(outputFileName); } catch {}
      if (coverFile) {
        try { await ffmpeg.deleteFile(`cover.${coverFile.name.split('.').pop()?.toLowerCase() || 'jpg'}`); } catch {}
      }

      // Create blob
      let arrayBuffer: ArrayBuffer;
      if (typeof data === 'string') {
        arrayBuffer = new TextEncoder().encode(data).buffer as ArrayBuffer;
      } else {
        arrayBuffer = new ArrayBuffer(data.byteLength);
        new Uint8Array(arrayBuffer).set(data);
      }
      
      const blob = new Blob([arrayBuffer], { type: 'video/mp4' });
      setProgress(100);
      
      return blob;
    } catch (error) {
      console.error('Failed to edit metadata:', error);
      throw error;
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
