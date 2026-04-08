import { useState, useCallback, useEffect } from 'react';
import { Image, Download, Loader2, Trash2, Save, Film, Tv, User, Calendar, Tag, FileText, Link, Upload, Monitor, Globe, FileVideo, AlertTriangle, Languages, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useFFmpegEditor } from '@/hooks/useFFmpegEditor';
import { useTmdbSearch, TMDB_LANGUAGES, type TmdbResult } from '@/hooks/useTmdbSearch';
import type { ConversionMetadata } from '@/types/converter';
import { supabase } from '@/integrations/supabase/client';
import { MemorySettings } from './MemorySettings';
import { SmartFilePicker } from './SmartFilePicker';
import { EncodingSettings } from './EncodingSettings';
import { useLocalBridge, type LocalBridgeMetadata } from '@/hooks/useLocalBridge';
import { 
  loadMemorySettings, 
  saveMemorySettings, 
  getMemoryWarning,
  exceedsBrowserLimit,
  formatFileSize,
  type MemorySettings as MemorySettingsType 
} from '@/lib/chunked-file-reader';
import { 
  getFormatCapabilities,
  type VideoFormatInfo 
} from '@/lib/video-format-utils';
import { 
  getProcessingRecommendation,
  type ProcessingRecommendation 
} from '@/lib/processing-mode';
import {
  type EncodingSettings as EncodingSettingsType,
  loadEncodingSettings,
  saveEncodingSettings,
  buildEncodingArgs,
} from '@/types/encoding';

export function MP4Editor() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [localFilePath, setLocalFilePath] = useState<string | null>(null);
  const [processingMode, setProcessingMode] = useState<'browser' | 'local'>('browser');
  const [recommendation, setRecommendation] = useState<ProcessingRecommendation | null>(null);
  const [formatInfo, setFormatInfo] = useState<VideoFormatInfo | null>(null);
  
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [coverSource, setCoverSource] = useState<'file' | 'url'>('file');
  const [metadata, setMetadata] = useState<ConversionMetadata>({
    title: '',
    author: '',
    show: '',
    season: '',
    episode: '',
    date: '',
    director: '',
    genre: '',
    description: '',
  });
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [showTmdbDropdown, setShowTmdbDropdown] = useState(false);
  const [memorySettings, setMemorySettings] = useState<MemorySettingsType>(loadMemorySettings);
  const [memoryWarning, setMemoryWarning] = useState<string | null>(null);
  const [overwriteOriginal, setOverwriteOriginal] = useState(false);
  const [outputFolder, setOutputFolder] = useState(() => localStorage.getItem('outputFolder') || 'converted');
  const [encodingSettings, setEncodingSettings] = useState<EncodingSettingsType>(loadEncodingSettings);
  
  const { load, loaded, loading: ffmpegLoading, progress, processing, readingProgress, editMetadata } = useFFmpegEditor();
  const { results, loading: tmdbLoading, search, clearResults, fetchDetails, fetchSeasonEpisodes } = useTmdbSearch();
  const localBridge = useLocalBridge();

  const [seasons, setSeasons] = useState<any[]>([]);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [selectedTmdb, setSelectedTmdb] = useState<any>(null);

  // Update memory warning when file changes
  useEffect(() => {
    if (videoFile) {
      setMemoryWarning(getMemoryWarning(videoFile));
    } else {
      setMemoryWarning(null);
    }
  }, [videoFile]);

  // Save memory settings when changed
  const handleMemorySettingsChange = useCallback((newSettings: MemorySettingsType) => {
    setMemorySettings(newSettings);
    saveMemorySettings(newSettings);
  }, []);

  // Save encoding settings when changed
  const handleEncodingSettingsChange = useCallback((newSettings: EncodingSettingsType) => {
    setEncodingSettings(newSettings);
    saveEncodingSettings(newSettings);
  }, []);

  // Fetch cover image from URL (handles CORS via proxy for TMDB)
  const fetchCoverFromUrl = useCallback(async (url: string): Promise<File | null> => {
    if (!url) return null;
    
    try {
      // Check if it's a TMDB URL - use proxy
      if (url.includes('image.tmdb.org')) {
        console.log('Fetching TMDB image via proxy:', url);
        const { data, error } = await supabase.functions.invoke('tmdb-proxy', {
          body: { action: 'proxy-image', imageUrl: url }
        });
        
        if (error || !data) {
          console.warn('Failed to proxy TMDB image:', error);
          return null;
        }
        
        // Data is now base64 encoded JSON response
        if (data.error) {
          console.warn('Proxy returned error:', data.error);
          return null;
        }
        
        // Decode base64 to binary
        const base64 = data.data;
        const contentType = data.contentType || 'image/jpeg';
        
        console.log('Received image, size:', data.size, 'bytes, type:', contentType);
        
        // Convert base64 to Uint8Array
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Create file with proper extension based on content type
        const ext = contentType.includes('png') ? 'png' : 'jpg';
        const blob = new Blob([bytes], { type: contentType });
        return new File([blob], `cover.${ext}`, { type: contentType });
      } else {
        // Direct fetch for other URLs
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

  // Handle browser file selection from SmartFilePicker
  const handleBrowserFileSelect = useCallback((file: File, rec: ProcessingRecommendation) => {
    setVideoFile(file);
    setLocalFilePath(null);
    setRecommendation(rec);
    setFormatInfo(getFormatCapabilities(file));
    setProcessingMode(rec.mode === 'local' && localBridge.connected ? 'local' : 'browser');
    
    const baseTitle = file.name.replace(/\.[^/.]+$/, '');
    setMetadata(prev => ({
      ...prev,
      title: baseTitle,
    }));
    setOutputBlob(null);
    
    // Automatisch TMDB-Suche starten basierend auf Dateinamen
    if (baseTitle.length >= 2) {
      search(baseTitle);
      setShowTmdbDropdown(true);
    }
  }, [search, localBridge.connected]);

  // Handle local file selection from SmartFilePicker
  const handleLocalFileSelect = useCallback((path: string) => {
    setVideoFile(null);
    setLocalFilePath(path);
    setProcessingMode('local');
    setRecommendation({
      mode: 'local',
      reason: 'Lokale Datei via PC-Modul',
      canProcessInBrowser: false,
      requiresLocalBridge: true,
      showBridgePrompt: false,
    });
    setFormatInfo(null);
    
    const baseTitle = path.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, '') || '';
    setMetadata(prev => ({
      ...prev,
      title: baseTitle,
    }));
    setOutputBlob(null);
    
    // Automatisch TMDB-Suche starten basierend auf Dateinamen
    if (baseTitle.length >= 2) {
      search(baseTitle);
      setShowTmdbDropdown(true);
    }
    
    toast({
      title: 'Lokale Datei ausgewählt',
      description: baseTitle,
    });
  }, [search]);

  // Clear file selection
  const handleClearFile = useCallback(() => {
    setVideoFile(null);
    setLocalFilePath(null);
    setRecommendation(null);
    setFormatInfo(null);
    setProcessingMode('browser');
  }, []);

  const handleCoverSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.includes('image/')) {
        toast({
          title: 'Ungültiges Format',
          description: 'Bitte nur Bilddateien hochladen',
          variant: 'destructive',
        });
        return;
      }
      setCoverFile(file);
      const reader = new FileReader();
      reader.onload = () => setCoverPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }, []);

  const handleTitleChange = useCallback((value: string) => {
    setMetadata(prev => ({ ...prev, title: value }));
    search(value);
    setShowTmdbDropdown(true);
  }, [search]);

  const handleSelectTmdbResult = useCallback(async (result: TmdbResult) => {
    setShowTmdbDropdown(false);
    clearResults();
    
    const details = await fetchDetails(result.id, result.type);
    
    if (details) {
      setSelectedTmdb(details);
      setMetadata(prev => ({
        ...prev,
        title: details.title,
        show: details.type === 'tv' ? details.title : '',
        director: details.director || '',
        author: details.director || details.creators?.join(', ') || '',
        date: details.year?.toString() || '',
        genre: details.genres?.join(', ') || '',
        description: details.overview || '',
        thumbnail: details.poster || '',
      }));

      if (details.type === 'tv' && details.seasons) {
        setSeasons(details.seasons);
        setEpisodes([]);
      } else {
        setSeasons([]);
        setEpisodes([]);
      }

      // Download poster as cover via proxy
      if (details.poster) {
        const coverFileResult = await fetchCoverFromUrl(details.poster);
        if (coverFileResult) {
          setCoverFile(coverFileResult);
          setCoverPreview(details.poster);
          setCoverSource('url');
          setCoverUrl(details.poster);
        }
      }
    }
  }, [fetchDetails, clearResults, fetchCoverFromUrl]);

  const handleSeasonChange = useCallback(async (seasonNumber: string) => {
    setMetadata(prev => ({ ...prev, season: seasonNumber }));
    
    if (selectedTmdb && selectedTmdb.type === 'tv') {
      const eps = await fetchSeasonEpisodes(selectedTmdb.id, parseInt(seasonNumber, 10));
      setEpisodes(eps);
    }
  }, [selectedTmdb, fetchSeasonEpisodes]);

  const handleEpisodeChange = useCallback((episodeNumber: string) => {
    setMetadata(prev => ({ ...prev, episode: episodeNumber }));
    
    const ep = episodes.find(e => e.episodeNumber === parseInt(episodeNumber, 10));
    if (ep) {
      setMetadata(prev => ({
        ...prev,
        episode: episodeNumber,
        // Metadaten-Titel ist nur der Episodenname, Dateiname enthält volles Format
        title: ep.name,
        description: ep.overview || prev.description,
      }));
    }
  }, [episodes, selectedTmdb]);

  // Handle cover URL input
  const handleCoverUrlChange = useCallback(async (url: string) => {
    setCoverUrl(url);
    if (!url) {
      setCoverPreview(null);
      setCoverFile(null);
      return;
    }
    
    // Try to load preview
    setCoverPreview(url);
    
    // Fetch the actual file for embedding
    const file = await fetchCoverFromUrl(url);
    if (file) {
      setCoverFile(file);
      setCoverSource('url');
    }
  }, [fetchCoverFromUrl]);

  const handleProcess = useCallback(async () => {
    // Local processing via bridge
    if (processingMode === 'local' && localBridge.connected && localFilePath) {
      // Convert metadata to local bridge format
      const bridgeMetadata: LocalBridgeMetadata = {
        title: metadata.title,
        artist: metadata.author || metadata.director,
        show: metadata.show,
        season: metadata.season,
        episode: metadata.episode,
        year: metadata.date,
        genre: metadata.genre,
        description: metadata.description,
      };
      
      // Pass overwrite flag to local conversion
      const result = await localBridge.startConversion(
        localFilePath, 
        bridgeMetadata, 
        coverFile || undefined,
        overwriteOriginal,
        outputFolder
      );
      
      if (result.success) {
        toast({
          title: 'Verarbeitung gestartet',
          description: 'Die Datei wird verarbeitet. Fortschritt wird angezeigt.',
        });
      } else {
        toast({
          title: 'Fehler',
          description: result.error,
          variant: 'destructive',
        });
      }
      return;
    }

    // Browser processing
    if (!videoFile) return;

    // Block processing for files over 2GB
    if (exceedsBrowserLimit(videoFile)) {
      toast({
        title: 'Datei zu groß',
        description: `Dateien über 2GB können im Browser nicht verarbeitet werden. Bitte starte das PC-Modul.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      if (!loaded) {
        toast({
          title: 'FFmpeg laden...',
          description: 'Bitte warten...',
        });
        await load();
      }

      toast({
        title: encodingSettings.enabled ? 'Konvertierung gestartet' : 'Verarbeitung gestartet',
        description: encodingSettings.enabled ? 'Video wird konvertiert...' : 'Metadaten werden eingebettet...',
      });

      const encodingArgs = buildEncodingArgs(encodingSettings);
      const blob = await editMetadata(videoFile, metadata, coverFile || undefined, undefined, memorySettings, encodingArgs);
      setOutputBlob(blob);

      toast({
        title: 'Fertig!',
        description: encodingSettings.enabled ? 'Video wurde erfolgreich konvertiert.' : 'Die Datei wurde erfolgreich bearbeitet.',
      });
    } catch (error) {
      toast({
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
        variant: 'destructive',
      });
    }
  }, [videoFile, metadata, coverFile, loaded, load, editMetadata, memorySettings, processingMode, localBridge, localFilePath, overwriteOriginal]);

  const handleDownload = useCallback(() => {
    if (!outputBlob) return;
    
    // Dateiname: Für Serien "Show - S01E01 - Episodenname", für Filme nur Titel
    let filename = metadata.title || 'output';
    if (metadata.show && metadata.season && metadata.episode) {
      const seasonPadded = metadata.season.padStart(2, '0');
      const episodePadded = metadata.episode.padStart(2, '0');
      filename = `${metadata.show} - S${seasonPadded}E${episodePadded} - ${metadata.title}`;
    }
    
    const url = URL.createObjectURL(outputBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.mp4`;
    a.click();
    URL.revokeObjectURL(url);
  }, [outputBlob, metadata]);

  const handleReset = useCallback(() => {
    setVideoFile(null);
    setCoverFile(null);
    setCoverPreview(null);
    setCoverUrl('');
    setCoverSource('file');
    setOutputBlob(null);
    setMetadata({
      title: '',
      author: '',
      show: '',
      season: '',
      episode: '',
      date: '',
      director: '',
      genre: '',
      description: '',
    });
    setSeasons([]);
    setEpisodes([]);
    setSelectedTmdb(null);
  }, []);

  const hasFile = videoFile || localFilePath;

  return (
    <div className="space-y-6">
      {/* Video Upload with Smart File Picker */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileVideo className="h-5 w-5 text-primary" />
          Video-Datei auswählen
        </h3>
        
        <SmartFilePicker
          onFileSelect={handleBrowserFileSelect}
          onLocalFileSelect={handleLocalFileSelect}
          onClear={handleClearFile}
          selectedFile={videoFile}
          selectedLocalPath={localFilePath}
          disabled={processing || localBridge.processing}
        />
      </div>

      {hasFile && (
        <>
          {/* Memory Settings - only for browser files */}
          {videoFile && processingMode === 'browser' && (
            <MemorySettings
              settings={memorySettings}
              onChange={handleMemorySettingsChange}
              fileSize={videoFile.size}
              warning={memoryWarning}
            />
          )}

          {/* Encoding Settings */}
          {processingMode === 'browser' && (
            <EncodingSettings
              settings={encodingSettings}
              onChange={handleEncodingSettingsChange}
              disabled={processing || localBridge.processing}
            />
          )}

          {/* Reading Progress */}
          {readingProgress && (
            <div className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Datei wird gelesen...</span>
                <span className="text-sm text-muted-foreground">
                  Chunk {readingProgress.chunkIndex}/{readingProgress.totalChunks}
                </span>
              </div>
              <Progress value={readingProgress.percent} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {(readingProgress.bytesRead / 1024 / 1024).toFixed(0)} MB / {(readingProgress.totalBytes / 1024 / 1024).toFixed(0)} MB
              </p>
            </div>
          )}
          {/* Cover Image */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Image className="h-5 w-5 text-primary" />
              Cover-Bild (optional)
            </h3>
            
            {/* Source Toggle */}
            <div className="flex gap-2 mb-4">
              <Button
                variant={coverSource === 'file' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCoverSource('file')}
              >
                <Upload className="h-4 w-4 mr-2" />
                Datei
              </Button>
              <Button
                variant={coverSource === 'url' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCoverSource('url')}
              >
                <Link className="h-4 w-4 mr-2" />
                URL
              </Button>
            </div>
            
            <div className="flex gap-4">
              {/* Cover Preview */}
              <div className="w-32 h-44 border-2 border-dashed border-border/50 rounded-lg flex-shrink-0 overflow-hidden">
                {coverPreview ? (
                  <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <Image className="h-6 w-6 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground text-center">Kein Cover</span>
                  </div>
                )}
              </div>
              
              <div className="flex-1 space-y-3">
                {coverSource === 'file' ? (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Bild hochladen</Label>
                    <label className="flex items-center justify-center w-full h-20 border-2 border-dashed border-border/50 rounded-lg cursor-pointer hover:bg-secondary/30 transition-colors">
                      <div className="text-center">
                        <Upload className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                        <span className="text-xs text-muted-foreground">Klicken oder Datei hierher ziehen</span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCoverSelect}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Bild-URL</Label>
                    <Input
                      value={coverUrl}
                      onChange={(e) => handleCoverUrlChange(e.target.value)}
                      placeholder="https://..."
                      className="bg-secondary/50 border-border/50"
                    />
                  </div>
                )}
                
                {coverPreview && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => { 
                      setCoverFile(null); 
                      setCoverPreview(null); 
                      setCoverUrl(''); 
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Entfernen
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Metadata Editor */}
          <div className="glass rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Metadaten
            </h3>

            {/* Title with TMDB Search */}
            <div className="space-y-2 relative">
              <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                Titel (TMDB-Suche)
                {tmdbLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              </Label>
              <Input
                value={metadata.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Titel eingeben um TMDB zu durchsuchen..."
                className="bg-secondary/50 border-border/50"
              />
              
              {/* TMDB Dropdown */}
              {showTmdbDropdown && results.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {results.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSelectTmdbResult(result)}
                      className="w-full flex items-center gap-3 p-2 hover:bg-secondary/50 transition-colors text-left"
                    >
                      {result.poster ? (
                        <img src={result.poster} alt={result.title} className="w-10 h-14 object-cover rounded" />
                      ) : (
                        <div className="w-10 h-14 bg-secondary/50 rounded flex items-center justify-center">
                          {result.type === 'tv' ? <Tv className="h-5 w-5" /> : <Film className="h-5 w-5" />}
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

            {/* Show Name (for TV) */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Tv className="h-3 w-3" />
                Serienname
              </Label>
              <Input
                value={metadata.show || ''}
                onChange={(e) => setMetadata(prev => ({ ...prev, show: e.target.value }))}
                placeholder="Name der Serie"
                className="bg-secondary/50 border-border/50"
              />
            </div>

            {/* Season/Episode */}
            {seasons.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Staffel</Label>
                  <select
                    value={metadata.season || ''}
                    onChange={(e) => handleSeasonChange(e.target.value)}
                    className="w-full h-10 rounded-md border border-border/50 bg-secondary/50 px-3 text-sm"
                  >
                    <option value="">Staffel wählen</option>
                    {seasons.map((s) => (
                      <option key={s.seasonNumber} value={s.seasonNumber.toString()}>
                        {s.name} ({s.episodeCount} Ep.)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Episode</Label>
                  <select
                    value={metadata.episode || ''}
                    onChange={(e) => handleEpisodeChange(e.target.value)}
                    className="w-full h-10 rounded-md border border-border/50 bg-secondary/50 px-3 text-sm"
                    disabled={!metadata.season}
                  >
                    <option value="">Episode wählen</option>
                    {episodes.map((ep) => (
                      <option key={ep.episodeNumber} value={ep.episodeNumber.toString()}>
                        E{String(ep.episodeNumber).padStart(2, '0')}: {ep.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Staffel</Label>
                  <Input
                    value={metadata.season || ''}
                    onChange={(e) => setMetadata(prev => ({ ...prev, season: e.target.value }))}
                    placeholder="z.B. 1"
                    className="bg-secondary/50 border-border/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Episode</Label>
                  <Input
                    value={metadata.episode || ''}
                    onChange={(e) => setMetadata(prev => ({ ...prev, episode: e.target.value }))}
                    placeholder="z.B. 5"
                    className="bg-secondary/50 border-border/50"
                  />
                </div>
              </div>
            )}

            {/* Director/Author */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                Regisseur / Autor
              </Label>
              <Input
                value={metadata.director || metadata.author || ''}
                onChange={(e) => setMetadata(prev => ({ ...prev, director: e.target.value, author: e.target.value }))}
                placeholder="Name des Regisseurs"
                className="bg-secondary/50 border-border/50"
              />
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Jahr
              </Label>
              <Input
                value={metadata.date || ''}
                onChange={(e) => setMetadata(prev => ({ ...prev, date: e.target.value }))}
                placeholder="z.B. 2024"
                className="bg-secondary/50 border-border/50"
              />
            </div>

            {/* Genre */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Tag className="h-3 w-3" />
                Genre
              </Label>
              <Input
                value={metadata.genre || ''}
                onChange={(e) => setMetadata(prev => ({ ...prev, genre: e.target.value }))}
                placeholder="z.B. Action, Drama"
                className="bg-secondary/50 border-border/50"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Beschreibung</Label>
              <Textarea
                value={metadata.description || ''}
                onChange={(e) => setMetadata(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Kurze Beschreibung..."
                className="bg-secondary/50 border-border/50 min-h-[80px]"
              />
            </div>
          </div>

          {/* Overwrite Option - Only for local processing */}
          {processingMode === 'local' && localBridge.connected && (
            <div className="glass rounded-xl p-4 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overwriteOriginal}
                  onChange={(e) => setOverwriteOriginal(e.target.checked)}
                  className="h-4 w-4 rounded border-border bg-secondary accent-primary"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium">Original überschreiben</span>
                  <p className="text-xs text-muted-foreground">
                    {overwriteOriginal 
                      ? 'Die Originaldatei wird ersetzt' 
                      : `Die Datei wird im Unterordner /${outputFolder} gespeichert (wird erstellt falls nicht vorhanden)`}
                  </p>
                </div>
                {overwriteOriginal && (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                )}
              </label>

              {!overwriteOriginal && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-muted-foreground whitespace-nowrap">Ausgabeordner:</label>
                  <Input
                    value={outputFolder}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[<>:"|?*]/g, '');
                      setOutputFolder(val);
                      localStorage.setItem('outputFolder', val);
                    }}
                    placeholder="converted"
                    className="bg-secondary/50 border-border/50 h-8 text-sm"
                  />
                </div>
              )}
            </div>
          )}

          {/* Local Bridge Progress */}
          {localBridge.processing && processingMode === 'local' && (
            <div className="glass rounded-xl p-4 border border-primary/30">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm font-medium text-primary">
                  Verarbeitung läuft: {localBridge.progressMessage || localBridge.status}
                </span>
              </div>
              <Progress value={localBridge.progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1 text-center">
                {localBridge.progress}%
              </p>
            </div>
          )}

          {/* Local Bridge Success Message */}
          {!localBridge.processing && localBridge.progress === 100 && processingMode === 'local' && (
            <div className="glass rounded-xl p-4 border border-green-500/30 bg-green-500/10">
              <div className="flex items-center gap-3">
                <Save className="h-5 w-5 text-green-400" />
                <span className="text-sm font-medium text-green-400">
                  Verarbeitung abgeschlossen! Die Datei wurde erfolgreich gespeichert.
                </span>
              </div>
            </div>
          )}

          {/* Browser Progress */}
          {processing && processingMode === 'browser' && (
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm">Verarbeite... {progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleProcess}
              disabled={processing || localBridge.processing || !hasFile || (processingMode === 'local' && !localBridge.connected)}
              className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90"
            >
              {processing || localBridge.processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verarbeite...
                </>
              ) : (
                <>
                  {processingMode === 'local' ? (
                    <Monitor className="h-4 w-4 mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {encodingSettings.enabled && processingMode === 'browser' ? 'Konvertieren' : 'Metadaten einbetten'}
                  {processingMode === 'local' && ' (Lokal)'}
                </>
              )}
            </Button>

            {outputBlob && processingMode === 'browser' && (
              <Button onClick={handleDownload} variant="secondary">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            )}

            <Button onClick={handleReset} variant="outline">
              <Trash2 className="h-4 w-4 mr-2" />
              Zurücksetzen
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
