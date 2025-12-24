import { useState, useCallback, useRef } from 'react';
import type { ConversionJob, ConversionHistory, M3U8Variant } from '@/types/converter';
import { useFFmpeg } from './useFFmpeg';
import { useDownloadOptimizer } from './useDownloadOptimizer';

const HISTORY_KEY = 'm3u8_converter_history';

function loadHistory(): ConversionHistory[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: ConversionHistory[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
}

export function useConversionQueue() {
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  const [history, setHistory] = useState<ConversionHistory[]>(loadHistory);
  const { load, loaded, loading, convert } = useFFmpeg();
  const optimizer = useDownloadOptimizer();
  const processingRef = useRef(false);

  const addJob = useCallback((
    name: string,
    source: string,
    sourceType: 'file' | 'url',
    audioOnly: boolean = false
  ): string => {
    const id = crypto.randomUUID();
    const newJob: ConversionJob = {
      id,
      name,
      source,
      sourceType,
      status: 'pending',
      progress: 0,
      logs: [],
      metadata: {
        title: name.replace(/\.(m3u8|m3u)$/i, ''),
        author: '',
      },
      audioOnly,
    };
    
    setJobs(prev => [...prev, newJob]);
    return id;
  }, []);

  const updateJob = useCallback((id: string, updates: Partial<ConversionJob>) => {
    setJobs(prev => prev.map(job => 
      job.id === id ? { ...job, ...updates } : job
    ));
  }, []);

  const removeJob = useCallback((id: string) => {
    setJobs(prev => prev.filter(job => job.id !== id));
  }, []);

  const setVariant = useCallback((id: string, variant: M3U8Variant) => {
    updateJob(id, { selectedVariant: variant });
  }, [updateJob]);

  const setMetadata = useCallback((id: string, metadata: Partial<ConversionJob['metadata']>) => {
    setJobs(prev => prev.map(job => 
      job.id === id ? { ...job, metadata: { ...job.metadata, ...metadata } } : job
    ));
  }, []);

  const setAudioOnly = useCallback((id: string, audioOnly: boolean) => {
    updateJob(id, { audioOnly });
  }, [updateJob]);

  const processJob = useCallback(async (job: ConversionJob) => {
    if (!loaded) {
      await load();
    }

    // Reset optimizer for new download
    optimizer.reset();
    
    updateJob(job.id, { status: 'downloading', startTime: Date.now() });

    try {
      const blob = await convert(
        job,
        (progress, logs) => updateJob(job.id, { progress, logs }),
        (size) => updateJob(job.id, { estimatedSize: size }),
        (stats) => updateJob(job.id, { downloadSpeed: stats.speed, remainingTime: stats.remainingTime }),
        (quality) => updateJob(job.id, { videoQuality: quality }),
        optimizer.settings.concurrency,
        optimizer.settings.enabled ? optimizer.optimize : undefined
      );

      const outputUrl = URL.createObjectURL(blob);
      const endTime = Date.now();
      
      updateJob(job.id, {
        status: 'completed',
        progress: 100,
        outputUrl,
        outputBlob: blob,
        endTime,
      });

      // Add to history
      const historyEntry: ConversionHistory = {
        id: job.id,
        name: job.metadata.title || job.name,
        source: job.sourceType === 'url' ? job.source : 'Local file',
        outputFormat: job.audioOnly ? 'mp3' : 'mp4',
        size: blob.size,
        duration: endTime - (job.startTime || endTime),
        completedAt: new Date().toISOString(),
        metadata: job.metadata,
      };

      setHistory(prev => {
        const updated = [historyEntry, ...prev];
        saveHistory(updated);
        return updated;
      });

    } catch (error) {
      updateJob(job.id, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [loaded, load, convert, updateJob, optimizer]);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    const pendingJobs = jobs.filter(j => j.status === 'pending');
    
    for (const job of pendingJobs) {
      await processJob(job);
    }

    processingRef.current = false;
  }, [jobs, processJob]);

  const startConversion = useCallback(async (id: string) => {
    const job = jobs.find(j => j.id === id);
    if (job && job.status === 'pending') {
      await processJob(job);
    }
  }, [jobs, processJob]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }, []);

  return {
    jobs,
    history,
    addJob,
    updateJob,
    removeJob,
    setVariant,
    setMetadata,
    setAudioOnly,
    startConversion,
    processQueue,
    clearHistory,
    ffmpegLoaded: loaded,
    ffmpegLoading: loading,
    loadFFmpeg: load,
    // Optimizer
    optimizer: {
      settings: optimizer.settings,
      stats: optimizer.stats,
      setEnabled: optimizer.setEnabled,
      setConcurrency: optimizer.setConcurrency,
      MIN_CONCURRENCY: optimizer.MIN_CONCURRENCY,
      MAX_CONCURRENCY: optimizer.MAX_CONCURRENCY,
    },
  };
}
