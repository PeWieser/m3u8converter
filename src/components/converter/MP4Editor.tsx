import { useState, useCallback } from 'react';
import { Upload, FileVideo, Image, Download, Loader2, Trash2, Save, Film, Tv, User, Calendar, Tag, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { useFFmpegEditor } from '@/hooks/useFFmpegEditor';
import { useTmdbSearch, type TmdbResult } from '@/hooks/useTmdbSearch';
import type { ConversionMetadata } from '@/types/converter';

export function MP4Editor() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
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
  
  const { load, loaded, loading: ffmpegLoading, progress, processing, editMetadata } = useFFmpegEditor();
  const { results, loading: tmdbLoading, search, clearResults, fetchDetails, fetchSeasonEpisodes } = useTmdbSearch();

  const [seasons, setSeasons] = useState<any[]>([]);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [selectedTmdb, setSelectedTmdb] = useState<any>(null);

  const handleVideoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.includes('video/mp4') && !file.name.endsWith('.mp4')) {
        toast({
          title: 'Ungültiges Format',
          description: 'Bitte nur MP4-Dateien hochladen',
          variant: 'destructive',
        });
        return;
      }
      setVideoFile(file);
      setMetadata(prev => ({
        ...prev,
        title: file.name.replace(/\.mp4$/i, ''),
      }));
      setOutputBlob(null);
    }
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

      // Download poster as cover
      if (details.poster) {
        try {
          const response = await fetch(details.poster);
          const blob = await response.blob();
          const file = new File([blob], 'cover.jpg', { type: 'image/jpeg' });
          setCoverFile(file);
          setCoverPreview(details.poster);
        } catch (e) {
          console.warn('Could not download poster:', e);
        }
      }
    }
  }, [fetchDetails, clearResults]);

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
        title: `${selectedTmdb?.title} - S${prev.season?.padStart(2, '0')}E${episodeNumber.padStart(2, '0')} - ${ep.name}`,
        description: ep.overview || prev.description,
      }));
    }
  }, [episodes, selectedTmdb]);

  const handleProcess = useCallback(async () => {
    if (!videoFile) return;

    try {
      if (!loaded) {
        toast({
          title: 'FFmpeg laden...',
          description: 'Bitte warten...',
        });
        await load();
      }

      toast({
        title: 'Verarbeitung gestartet',
        description: 'Metadaten werden eingebettet...',
      });

      const blob = await editMetadata(videoFile, metadata, coverFile || undefined);
      setOutputBlob(blob);

      toast({
        title: 'Fertig!',
        description: 'Die Datei wurde erfolgreich bearbeitet.',
      });
    } catch (error) {
      toast({
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
        variant: 'destructive',
      });
    }
  }, [videoFile, metadata, coverFile, loaded, load, editMetadata]);

  const handleDownload = useCallback(() => {
    if (!outputBlob) return;
    
    const url = URL.createObjectURL(outputBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metadata.title || 'output'}.mp4`;
    a.click();
    URL.revokeObjectURL(url);
  }, [outputBlob, metadata.title]);

  const handleReset = useCallback(() => {
    setVideoFile(null);
    setCoverFile(null);
    setCoverPreview(null);
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

  return (
    <div className="space-y-6">
      {/* Video Upload */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileVideo className="h-5 w-5 text-primary" />
          MP4-Datei auswählen
        </h3>
        
        {!videoFile ? (
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border/50 rounded-lg cursor-pointer hover:bg-secondary/30 transition-colors">
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">MP4-Datei hierher ziehen oder klicken</span>
            <input
              type="file"
              accept="video/mp4,.mp4"
              onChange={handleVideoSelect}
              className="hidden"
            />
          </label>
        ) : (
          <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
            <div className="flex items-center gap-3">
              <FileVideo className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">{videoFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(videoFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setVideoFile(null)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {videoFile && (
        <>
          {/* Cover Image */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Image className="h-5 w-5 text-primary" />
              Cover-Bild (optional)
            </h3>
            
            <div className="flex gap-4">
              <label className="flex flex-col items-center justify-center w-32 h-44 border-2 border-dashed border-border/50 rounded-lg cursor-pointer hover:bg-secondary/30 transition-colors flex-shrink-0">
                {coverPreview ? (
                  <img src={coverPreview} alt="Cover" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground text-center">Cover hochladen</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverSelect}
                  className="hidden"
                />
              </label>
              
              {coverPreview && (
                <Button variant="ghost" size="sm" onClick={() => { setCoverFile(null); setCoverPreview(null); }}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Entfernen
                </Button>
              )}
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

          {/* Progress */}
          {processing && (
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
              disabled={processing || !videoFile}
              className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verarbeite...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Metadaten einbetten
                </>
              )}
            </Button>

            {outputBlob && (
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
