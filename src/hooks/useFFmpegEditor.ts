import { useState, useRef, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type { ConversionMetadata } from '@/types/converter';
import { addGlobalLog } from '@/components/converter/GlobalLogWindow';
import { 
  readFileInChunks,
  streamLargeFileToFFmpeg,
  formatFileSize,
  loadMemorySettings, 
  type MemorySettings,
  type ChunkProgress 
} from '@/lib/chunked-file-reader';

const FFMPEG_CORE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

// Threshold for using chunked reading (500MB)
const CHUNKED_READING_THRESHOLD = 500 * 1024 * 1024;

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
  const [readingProgress, setReadingProgress] = useState<ChunkProgress | null>(null);

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
    onProgress?: (progress: number) => void,
    memorySettings?: MemorySettings,
    encodingArgs?: string[]
  ): Promise<Blob> => {
    if (!ffmpegRef.current) {
      throw new Error('FFmpeg not loaded');
    }

    const ffmpeg = ffmpegRef.current;
    setProcessing(true);
    setProgress(0);
    setReadingProgress(null);

    // Get memory settings
    const settings = memorySettings || loadMemorySettings();
    const useChunkedReading = videoFile.size > CHUNKED_READING_THRESHOLD || settings.thriftyMode;
    const effectiveChunkSize = settings.thriftyMode 
      ? Math.min(settings.chunkSizeMB, 32) 
      : settings.chunkSizeMB;

    // Threshold for using streaming mode (files that might exceed buffer limits)
    const STREAMING_THRESHOLD = 1.5 * 1024 * 1024 * 1024; // 1.5GB
    const useStreamingMode = videoFile.size > STREAMING_THRESHOLD;

    try {
      // Write input video to virtual filesystem
      const inputFileName = 'input.mp4';
      const outputFileName = 'output.mp4';
      
      const sizeDisplay = formatFileSize(videoFile.size);

      if (useStreamingMode) {
        // For very large files, use the streaming approach
        addGlobalLog('warning', `Sehr große Datei erkannt (${sizeDisplay}). Verwende Streaming-Modus...`, 'MP4 Editor');
        
        try {
          await streamLargeFileToFFmpeg(
            videoFile,
            ffmpeg,
            inputFileName,
            effectiveChunkSize,
            (chunkProgress) => {
              setReadingProgress(chunkProgress);
              if (chunkProgress.chunkIndex % 5 === 0 || chunkProgress.chunkIndex === chunkProgress.totalChunks) {
                addGlobalLog(
                  'warning', 
                  `Streaming: ${chunkProgress.percent}% (Chunk ${chunkProgress.chunkIndex}/${chunkProgress.totalChunks})`, 
                  'MP4 Editor'
                );
              }
            }
          );
          addGlobalLog('success', 'Video erfolgreich in FFmpeg geladen', 'MP4 Editor');
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          addGlobalLog('error', errorMsg, 'MP4 Editor');
          throw err;
        }
      } else if (useChunkedReading) {
        addGlobalLog('warning', `Verwende Chunk-Reading (${effectiveChunkSize}MB Chunks) für große Datei: ${sizeDisplay}`, 'MP4 Editor');
        
        try {
          const fileData = await readFileInChunks(
            videoFile, 
            effectiveChunkSize,
            (chunkProgress) => {
              setReadingProgress(chunkProgress);
              if (chunkProgress.chunkIndex % 3 === 0 || chunkProgress.chunkIndex === chunkProgress.totalChunks) {
                addGlobalLog(
                  'warning', 
                  `Lese Datei: ${chunkProgress.percent}% (Chunk ${chunkProgress.chunkIndex}/${chunkProgress.totalChunks})`, 
                  'MP4 Editor'
                );
              }
            }
          );
          
          addGlobalLog('warning', 'Schreibe Daten in FFmpeg Dateisystem...', 'MP4 Editor');
          await ffmpeg.writeFile(inputFileName, fileData);
          addGlobalLog('success', 'Video in FFmpeg geladen', 'MP4 Editor');
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          
          // Check for memory-related errors
          if (errorMsg.includes('memory') || errorMsg.includes('OOM') || errorMsg.includes('RangeError') || errorMsg.includes('allocation')) {
            addGlobalLog('error', `Speicherfehler: Die Datei ist zu groß für den verfügbaren Arbeitsspeicher.`, 'MP4 Editor');
            throw new Error(`Speicherfehler: Datei zu groß (${sizeDisplay}). Browser können Dateien über ~2GB nicht verarbeiten. Bitte verwenden Sie Desktop-FFmpeg.`);
          }
          
          throw err;
        }
      } else {
        addGlobalLog('info', `Schreibe Video-Datei (${sizeDisplay}) in FFmpeg Dateisystem...`, 'MP4 Editor');
        
        try {
          await ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));
          addGlobalLog('success', 'Video in FFmpeg geladen', 'MP4 Editor');
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          
          // Retry with chunked reading if fetchFile fails
          if (errorMsg.includes('Code=-1') || errorMsg.includes('could not be read')) {
            addGlobalLog('warning', 'Standard-Lesemethode fehlgeschlagen, wechsle zu Chunk-Modus...', 'MP4 Editor');
            
            const fileData = await readFileInChunks(
              videoFile, 
              effectiveChunkSize,
              (chunkProgress) => {
                setReadingProgress(chunkProgress);
              }
            );
            
            await ffmpeg.writeFile(inputFileName, fileData);
            addGlobalLog('success', 'Video via Chunk-Reading geladen', 'MP4 Editor');
          } else {
            throw err;
          }
        }
      }

      setReadingProgress(null);

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
        args.push('-metadata', 'media_type=10');
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

      addGlobalLog('info', `Starte FFmpeg mit ${args.length} Argumenten...`, 'MP4 Editor');
      addGlobalLog('ffmpeg', `Befehl: ffmpeg ${args.join(' ')}`, 'MP4 Editor');
      await ffmpeg.exec(args);
      addGlobalLog('success', 'FFmpeg Verarbeitung abgeschlossen', 'MP4 Editor');

      // Read output file
      addGlobalLog('info', 'Lese Ausgabedatei...', 'MP4 Editor');
      const data = await ffmpeg.readFile(outputFileName);
      
      // Cleanup - aggressive for thrifty mode
      try { await ffmpeg.deleteFile(inputFileName); } catch {}
      try { await ffmpeg.deleteFile(outputFileName); } catch {}
      if (coverFile) {
        try { await ffmpeg.deleteFile(`cover.${coverFile.name.split('.').pop()?.toLowerCase() || 'jpg'}`); } catch {}
      }

      // Create blob properly
      addGlobalLog('info', `Data type: ${typeof data}, Is Uint8Array: ${data instanceof Uint8Array}`, 'MP4 Editor');
      
      let blob: Blob;
      if (data instanceof Uint8Array) {
        // Copy to a new ArrayBuffer to ensure it's a standard ArrayBuffer
        const buffer = new ArrayBuffer(data.byteLength);
        new Uint8Array(buffer).set(data);
        blob = new Blob([buffer], { type: 'video/mp4' });
      } else {
        const encoder = new TextEncoder();
        const encoded = encoder.encode(data as string);
        const buffer = new ArrayBuffer(encoded.byteLength);
        new Uint8Array(buffer).set(encoded);
        blob = new Blob([buffer], { type: 'video/mp4' });
      }
      
      addGlobalLog('info', `Output blob size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`, 'MP4 Editor');
      
      if (blob.size === 0) {
        addGlobalLog('error', 'Ausgabedatei ist leer - FFmpeg-Verarbeitung möglicherweise fehlgeschlagen', 'MP4 Editor');
        throw new Error('Ausgabedatei ist leer - FFmpeg-Verarbeitung fehlgeschlagen. Prüfen Sie die Konsole für FFmpeg-Logs.');
      }
      
      setProgress(100);
      addGlobalLog('success', `Metadaten erfolgreich eingebettet! Ausgabe: ${formatFileSize(blob.size)}`, 'MP4 Editor');
      
      return blob;
    } catch (err) {
      console.error('Metadaten-Bearbeitung fehlgeschlagen:', err);
      addGlobalLog('error', `Metadaten-Bearbeitung fehlgeschlagen: ${err}`, 'MP4 Editor');
      throw err;
    } finally {
      setProcessing(false);
      setReadingProgress(null);
    }
  }, []);

  return {
    load,
    loaded,
    loading,
    progress,
    processing,
    readingProgress,
    editMetadata,
  };
}
