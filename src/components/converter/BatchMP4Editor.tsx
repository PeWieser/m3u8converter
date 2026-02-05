import { useState, useCallback, useEffect } from 'react';
import { Upload, FileVideo, Image, Download, Loader2, Trash2, Play, CheckCircle, AlertCircle, FolderUp, Film, Tv, Search, ChevronDown, ChevronUp, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { useFFmpegEditor } from '@/hooks/useFFmpegEditor';
import { useTmdbSearch, type TmdbResult } from '@/hooks/useTmdbSearch';
import type { ConversionMetadata } from '@/types/converter';
import { supabase } from '@/integrations/supabase/client';
import JSZip from 'jszip';

interface BatchFile {
  id: string;
  file: File;
  metadata: ConversionMetadata;
  coverFile?: File;
  coverPreview?: string;
  coverUrl?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  outputBlob?: Blob;
  error?: string;
  expanded?: boolean;
  seasons?: any[];
  episodes?: any[];
  selectedTmdb?: any;
}

export function BatchMP4Editor() {
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  
  const { load, loaded, loading: ffmpegLoading, editMetadata } = useFFmpegEditor();
  const tmdbHook = useTmdbSearch();

  // Fetch cover image from URL
  const fetchCoverFromUrl = useCallback(async (url: string): Promise<File | null> => {
    if (!url) return null;
    
    try {
      if (url.includes('image.tmdb.org')) {
        const { data, error } = await supabase.functions.invoke('tmdb-proxy', {
          body: { action: 'proxy-image', imageUrl: url }
        });
        
        if (error || !data || data.error) {
          console.warn('Failed to proxy TMDB image:', error || data?.error);
          return null;
        }
        
        const base64 = data.data;
        const contentType = data.contentType || 'image/jpeg';
        
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const ext = contentType.includes('png') ? 'png' : 'jpg';
        const blob = new Blob([bytes], { type: contentType });
        return new File([blob], `cover.${ext}`, { type: contentType });
      } else {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch image');
        const blob = await response.blob();
        const ext = blob.type.includes('png') ? 'png' : 'jpg';
        return new File([blob], `cover.${ext}`, { type: blob.type || 'image/jpeg' });
      }
    } catch (error) {
      console.error('Failed to fetch cover:', error);
      return null;
    }
  }, []);

  const handleFilesSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const mp4Files = selectedFiles.filter(f => f.type.includes('video/mp4') || f.name.endsWith('.mp4'));
    
    if (mp4Files.length === 0) {
      toast({
        title: 'Keine MP4-Dateien',
        description: 'Bitte nur MP4-Dateien auswählen',
        variant: 'destructive',
      });
      return;
    }

    const newFiles: BatchFile[] = mp4Files.map(file => ({
      id: crypto.randomUUID(),
      file,
      metadata: {
        title: file.name.replace(/\.mp4$/i, ''),
        author: '',
      },
      status: 'pending',
      progress: 0,
      expanded: true, // Expand first to show TMDB search
    }));

    setFiles(prev => [...prev, ...newFiles]);
    toast({
      title: `${mp4Files.length} Dateien hinzugefügt`,
      description: 'Dateien zur Batch-Warteschlange hinzugefügt',
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    const mp4Files = droppedFiles.filter(f => f.type.includes('video/mp4') || f.name.endsWith('.mp4'));
    
    if (mp4Files.length === 0) {
      toast({
        title: 'Keine MP4-Dateien',
        description: 'Bitte nur MP4-Dateien ablegen',
        variant: 'destructive',
      });
      return;
    }

    const newFiles: BatchFile[] = mp4Files.map(file => ({
      id: crypto.randomUUID(),
      file,
      metadata: {
        title: file.name.replace(/\.mp4$/i, ''),
        author: '',
      },
      status: 'pending',
      progress: 0,
      expanded: true,
    }));

    setFiles(prev => [...prev, ...newFiles]);
    toast({
      title: `${mp4Files.length} Dateien hinzugefügt`,
      description: 'Dateien zur Batch-Warteschlange hinzugefügt',
    });
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
    setSelectedIds(new Set());
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAllCompleted = useCallback(() => {
    const completedIds = files.filter(f => f.status === 'completed' && f.outputBlob).map(f => f.id);
    setSelectedIds(new Set(completedIds));
  }, [files]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, expanded: !f.expanded } : f
    ));
  }, []);

  const updateFileMetadata = useCallback((id: string, updates: Partial<ConversionMetadata>) => {
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, metadata: { ...f.metadata, ...updates } } : f
    ));
  }, []);

  const handleTmdbSearch = useCallback(async (fileId: string, query: string) => {
    if (query.length < 2) return;
    
    await tmdbHook.search(query);
  }, [tmdbHook]);

  const handleSelectTmdbResult = useCallback(async (fileId: string, result: TmdbResult) => {
    const details = await tmdbHook.fetchDetails(result.id, result.type);
    
    if (details) {
      // Fetch cover
      let coverFile: File | undefined;
      let coverPreview: string | undefined;
      let coverUrl: string | undefined;
      
      if (details.poster) {
        const file = await fetchCoverFromUrl(details.poster);
        if (file) {
          coverFile = file;
          coverPreview = details.poster;
          coverUrl = details.poster;
        }
      }
      
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          metadata: {
            ...f.metadata,
            title: details.title,
            show: details.type === 'tv' ? details.title : '',
            director: details.director || '',
            author: details.director || details.creators?.join(', ') || '',
            date: details.year?.toString() || '',
            genre: details.genres?.join(', ') || '',
            description: details.overview || '',
            thumbnail: details.poster || '',
          },
          coverFile,
          coverPreview,
          coverUrl,
          selectedTmdb: details,
          seasons: details.type === 'tv' ? details.seasons : [],
          episodes: [],
        } : f
      ));
    }
    
    tmdbHook.clearResults();
  }, [tmdbHook, fetchCoverFromUrl]);

  const handleSeasonChange = useCallback(async (fileId: string, seasonNumber: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file?.selectedTmdb) return;
    
    const eps = await tmdbHook.fetchSeasonEpisodes(file.selectedTmdb.id, parseInt(seasonNumber, 10));
    
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { 
        ...f, 
        metadata: { ...f.metadata, season: seasonNumber },
        episodes: eps,
      } : f
    ));
  }, [files, tmdbHook]);

  const handleEpisodeChange = useCallback((fileId: string, episodeNumber: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file?.episodes) return;
    
    const ep = file.episodes.find((e: any) => e.episodeNumber === parseInt(episodeNumber, 10));
    if (ep) {
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          metadata: { 
            ...f.metadata, 
            episode: episodeNumber,
            title: ep.name,
            description: ep.overview || f.metadata.description,
          }
        } : f
      ));
    }
  }, [files]);

  const handleCoverUrlChange = useCallback(async (fileId: string, url: string) => {
    if (!url) {
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, coverFile: undefined, coverPreview: undefined, coverUrl: '' } : f
      ));
      return;
    }
    
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, coverUrl: url, coverPreview: url } : f
    ));
    
    const file = await fetchCoverFromUrl(url);
    if (file) {
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, coverFile: file } : f
      ));
    }
  }, [fetchCoverFromUrl]);

  const handleCoverFileSelect = useCallback((fileId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.includes('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, coverFile: file, coverPreview: reader.result as string } : f
        ));
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const processBatch = useCallback(async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsProcessingBatch(true);

    try {
      if (!loaded) {
        toast({
          title: 'FFmpeg laden...',
          description: 'Bitte warten...',
        });
        await load();
      }

      for (const batchFile of pendingFiles) {
        setFiles(prev => prev.map(f => 
          f.id === batchFile.id ? { ...f, status: 'processing' as const, progress: 0 } : f
        ));

        try {
          const blob = await editMetadata(
            batchFile.file, 
            batchFile.metadata, 
            batchFile.coverFile,
            (progress) => {
              setFiles(prev => prev.map(f => 
                f.id === batchFile.id ? { ...f, progress } : f
              ));
            }
          );

          setFiles(prev => prev.map(f => 
            f.id === batchFile.id ? { 
              ...f, 
              status: 'completed' as const, 
              progress: 100, 
              outputBlob: blob 
            } : f
          ));
        } catch (error) {
          setFiles(prev => prev.map(f => 
            f.id === batchFile.id ? { 
              ...f, 
              status: 'error' as const, 
              error: error instanceof Error ? error.message : 'Unbekannter Fehler'
            } : f
          ));
        }
      }

      toast({
        title: 'Batch-Verarbeitung abgeschlossen',
      });
    } finally {
      setIsProcessingBatch(false);
    }
  }, [files, loaded, load, editMetadata]);

  const getFilename = useCallback((file: BatchFile) => {
    const meta = file.metadata;
    if (meta.show && meta.season && meta.episode) {
      const seasonPadded = meta.season.padStart(2, '0');
      const episodePadded = meta.episode.padStart(2, '0');
      return `${meta.show} - S${seasonPadded}E${episodePadded} - ${meta.title}`;
    }
    return meta.title || file.file.name.replace(/\.mp4$/i, '');
  }, []);

  const downloadSelected = useCallback(async () => {
    const selectedFiles = files.filter(f => selectedIds.has(f.id) && f.outputBlob);
    
    if (selectedFiles.length === 0) {
      toast({
        title: 'Keine Dateien ausgewählt',
        description: 'Bitte wählen Sie mindestens eine Datei aus',
        variant: 'destructive',
      });
      return;
    }

    if (selectedFiles.length === 1) {
      const file = selectedFiles[0];
      if (file.outputBlob) {
        const url = URL.createObjectURL(file.outputBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${getFilename(file)}.mp4`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } else {
      toast({
        title: 'ZIP wird erstellt...',
        description: 'Bitte warten...',
      });

      const zip = new JSZip();
      
      for (const file of selectedFiles) {
        if (file.outputBlob) {
          const filename = `${getFilename(file)}.mp4`;
          zip.file(filename, file.outputBlob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'batch-edited-files.zip';
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Download gestartet',
        description: `${selectedFiles.length} Dateien als ZIP`,
      });
    }
  }, [files, selectedIds, getFilename]);

  const downloadAll = useCallback(async () => {
    const completedFiles = files.filter(f => f.status === 'completed' && f.outputBlob);
    
    if (completedFiles.length === 0) return;

    if (completedFiles.length === 1) {
      const file = completedFiles[0];
      if (file.outputBlob) {
        const url = URL.createObjectURL(file.outputBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${getFilename(file)}.mp4`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } else {
      toast({
        title: 'ZIP wird erstellt...',
        description: 'Bitte warten...',
      });

      const zip = new JSZip();
      
      for (const file of completedFiles) {
        if (file.outputBlob) {
          const filename = `${getFilename(file)}.mp4`;
          zip.file(filename, file.outputBlob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'all-edited-files.zip';
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Download gestartet',
        description: `${completedFiles.length} Dateien als ZIP`,
      });
    }
  }, [files, getFilename]);

  const pendingFiles = files.filter(f => f.status === 'pending');
  const processingFiles = files.filter(f => f.status === 'processing');
  const completedFiles = files.filter(f => f.status === 'completed' && f.outputBlob);
  const errorFiles = files.filter(f => f.status === 'error');

  const allSelected = completedFiles.length > 0 && completedFiles.every(f => selectedIds.has(f.id));

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FolderUp className="h-5 w-5 text-primary" />
          Batch-Bearbeitung - Mehrere MP4-Dateien
        </h3>
        
        <label 
          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border/50 rounded-lg cursor-pointer hover:bg-secondary/30 transition-colors"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
          <span className="text-sm text-muted-foreground">Mehrere MP4-Dateien hierher ziehen oder klicken</span>
          <span className="text-xs text-muted-foreground mt-1">(Mit TMDB-Suche und Cover-Support)</span>
          <input
            type="file"
            accept="video/mp4,.mp4"
            multiple
            onChange={handleFilesSelect}
            className="hidden"
          />
        </label>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="glass rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Dateien ({files.length})
            </h3>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearAll}
                disabled={isProcessingBatch}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Alle löschen
              </Button>
              {pendingFiles.length > 0 && (
                <Button 
                  size="sm"
                  onClick={processBatch}
                  disabled={isProcessingBatch}
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
                >
                  {isProcessingBatch ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verarbeite...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Alle verarbeiten ({pendingFiles.length})
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* File Items - List View */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {files.map((file) => (
              <div 
                key={file.id} 
                className={`rounded-lg border transition-colors ${
                  file.status === 'completed' ? 'border-green-500/30 bg-green-500/5' : 
                  file.status === 'error' ? 'border-destructive/30 bg-destructive/5' : 
                  file.status === 'processing' ? 'border-primary/30 bg-primary/5' : 
                  'border-border/30 bg-secondary/20'
                }`}
              >
                {/* Header Row */}
                <div 
                  className="flex items-center gap-3 p-3 cursor-pointer"
                  onClick={() => file.status === 'pending' && toggleExpand(file.id)}
                >
                  {file.status === 'completed' && (
                    <Checkbox
                      checked={selectedIds.has(file.id)}
                      onCheckedChange={() => toggleSelection(file.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  
                  {/* Cover Preview */}
                  <div className="w-12 h-16 rounded overflow-hidden flex-shrink-0 bg-secondary/50 flex items-center justify-center">
                    {file.coverPreview ? (
                      <img src={file.coverPreview} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <Image className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  
                  <div className={`
                    flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
                    ${file.status === 'completed' ? 'bg-green-500/20' : 
                      file.status === 'error' ? 'bg-destructive/20' : 
                      file.status === 'processing' ? 'bg-primary/20' :
                      'bg-secondary/50'}
                  `}>
                    {file.status === 'processing' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : file.status === 'completed' ? (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    ) : file.status === 'error' ? (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <FileVideo className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {file.metadata.show && file.metadata.season && file.metadata.episode 
                        ? `${file.metadata.show} - S${file.metadata.season.padStart(2,'0')}E${file.metadata.episode.padStart(2,'0')} - ${file.metadata.title}`
                        : file.metadata.title || file.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {file.file.name} • {(file.file.size / 1024 / 1024).toFixed(2)} MB
                      {file.status === 'processing' && ` • ${file.progress}%`}
                      {file.status === 'error' && ` • ${file.error}`}
                    </p>
                    {file.status === 'processing' && (
                      <Progress value={file.progress} className="h-1 mt-1" />
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {file.status === 'pending' && !isProcessingBatch && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); toggleExpand(file.id); }}
                          className="flex-shrink-0"
                        >
                          {file.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                          className="flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Expanded Content */}
                {file.expanded && file.status === 'pending' && (
                  <div className="p-4 pt-0 space-y-4 border-t border-border/20 mt-2">
                    {/* TMDB Search */}
                    <div className="space-y-2 relative">
                      <Label className="text-xs text-muted-foreground flex items-center gap-2">
                        <Search className="h-3 w-3" />
                        TMDB-Suche
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          value={file.metadata.title}
                          onChange={(e) => {
                            updateFileMetadata(file.id, { title: e.target.value });
                            handleTmdbSearch(file.id, e.target.value);
                          }}
                          placeholder="Titel eingeben..."
                          className="bg-secondary/50 border-border/50"
                        />
                      </div>
                      
                      {/* TMDB Results Dropdown */}
                      {tmdbHook.results.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {tmdbHook.results.map((result) => (
                            <button
                              key={`${result.type}-${result.id}`}
                              onClick={() => handleSelectTmdbResult(file.id, result)}
                              className="w-full flex items-center gap-3 p-2 hover:bg-secondary/50 transition-colors text-left"
                            >
                              {result.poster ? (
                                <img src={result.poster} alt={result.title} className="w-8 h-12 object-cover rounded" />
                              ) : (
                                <div className="w-8 h-12 bg-secondary/50 rounded flex items-center justify-center">
                                  {result.type === 'tv' ? <Tv className="h-4 w-4" /> : <Film className="h-4 w-4" />}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{result.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {result.year} • {result.type === 'tv' ? 'Serie' : 'Film'}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Season/Episode Selection for TV */}
                    {file.seasons && file.seasons.length > 0 && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Staffel</Label>
                          <select
                            value={file.metadata.season || ''}
                            onChange={(e) => handleSeasonChange(file.id, e.target.value)}
                            className="w-full h-9 rounded-md border border-border/50 bg-secondary/50 px-3 text-sm"
                          >
                            <option value="">Staffel wählen</option>
                            {file.seasons.map((s: any) => (
                              <option key={s.seasonNumber} value={s.seasonNumber.toString()}>
                                {s.name} ({s.episodeCount} Ep.)
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Episode</Label>
                          <select
                            value={file.metadata.episode || ''}
                            onChange={(e) => handleEpisodeChange(file.id, e.target.value)}
                            className="w-full h-9 rounded-md border border-border/50 bg-secondary/50 px-3 text-sm"
                            disabled={!file.metadata.season}
                          >
                            <option value="">Episode wählen</option>
                            {(file.episodes || []).map((ep: any) => (
                              <option key={ep.episodeNumber} value={ep.episodeNumber.toString()}>
                                E{String(ep.episodeNumber).padStart(2, '0')}: {ep.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Cover URL */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-2">
                        <Link className="h-3 w-3" />
                        Cover-URL (optional)
                      </Label>
                      <Input
                        value={file.coverUrl || ''}
                        onChange={(e) => handleCoverUrlChange(file.id, e.target.value)}
                        placeholder="https://..."
                        className="bg-secondary/50 border-border/50"
                      />
                    </div>

                    {/* Cover File Upload */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Oder Cover-Datei hochladen</Label>
                      <label className="flex items-center justify-center w-full h-12 border border-dashed border-border/50 rounded-lg cursor-pointer hover:bg-secondary/30 transition-colors">
                        <Upload className="h-4 w-4 text-muted-foreground mr-2" />
                        <span className="text-xs text-muted-foreground">Cover-Bild wählen</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleCoverFileSelect(file.id, e)}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Additional Metadata */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Jahr</Label>
                        <Input
                          value={file.metadata.date || ''}
                          onChange={(e) => updateFileMetadata(file.id, { date: e.target.value })}
                          placeholder="z.B. 2024"
                          className="bg-secondary/50 border-border/50 h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Genre</Label>
                        <Input
                          value={file.metadata.genre || ''}
                          onChange={(e) => updateFileMetadata(file.id, { genre: e.target.value })}
                          placeholder="z.B. Drama"
                          className="bg-secondary/50 border-border/50 h-9"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Download Controls */}
          {completedFiles.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border/30">
              <div className="flex items-center gap-3">
                <Checkbox 
                  checked={allSelected}
                  onCheckedChange={() => allSelected ? deselectAll() : selectAllCompleted()}
                  id="select-all-batch"
                />
                <label htmlFor="select-all-batch" className="text-sm cursor-pointer">
                  {allSelected ? 'Alle abwählen' : 'Alle auswählen'}
                </label>
                {selectedIds.size > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({selectedIds.size} ausgewählt)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <Button 
                    size="sm" 
                    variant="secondary"
                    onClick={downloadSelected}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Ausgewählte herunterladen
                  </Button>
                )}
                <Button 
                  size="sm" 
                  onClick={downloadAll}
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Alle herunterladen ({completedFiles.length})
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>Ausstehend: {pendingFiles.length}</span>
          <span>In Bearbeitung: {processingFiles.length}</span>
          <span className="text-green-400">Fertig: {completedFiles.length}</span>
          {errorFiles.length > 0 && (
            <span className="text-destructive">Fehler: {errorFiles.length}</span>
          )}
        </div>
      )}
    </div>
  );
}