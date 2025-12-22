import { useState, useEffect, useRef } from 'react';
import { FileText, User, Image, ChevronDown, ChevronUp, Loader2, Film, Tv } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ConversionMetadata } from '@/types/converter';
import { useTmdbSearch, type TmdbResult, type TmdbDetails, type TmdbSeason, type TmdbEpisode } from '@/hooks/useTmdbSearch';

interface MetadataEditorProps {
  metadata: ConversionMetadata;
  onChange: (metadata: Partial<ConversionMetadata>) => void;
  disabled?: boolean;
  defaultExpanded?: boolean;
  onTmdbSelect?: (tmdbId: number, type: 'movie' | 'tv') => void;
  onSeasonEpisodeChange?: (season: number, episode: number) => void;
}

export function MetadataEditor({ 
  metadata, 
  onChange, 
  disabled = false, 
  defaultExpanded = false,
  onTmdbSelect,
  onSeasonEpisodeChange,
}: MetadataEditorProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedTmdb, setSelectedTmdb] = useState<TmdbDetails | null>(null);
  const [seasons, setSeasons] = useState<TmdbSeason[]>([]);
  const [episodes, setEpisodes] = useState<TmdbEpisode[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const { results, loading, search, clearResults, fetchDetails, fetchSeasonEpisodes } = useTmdbSearch();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTitleChange = (value: string) => {
    onChange({ title: value });
    if (!disabled) {
      search(value);
      setShowDropdown(true);
    }
  };

  const handleSelectResult = async (result: TmdbResult) => {
    setShowDropdown(false);
    clearResults();
    
    // Fetch detailed info
    const details = await fetchDetails(result.id, result.type);
    
    if (details) {
      setSelectedTmdb(details);
      
      onChange({
        title: details.title,
        author: details.director || details.creators?.join(', ') || '',
        thumbnail: details.poster || '',
      });

      onTmdbSelect?.(details.id, details.type);

      // If it's a TV show, load seasons
      if (details.type === 'tv' && details.seasons) {
        setSeasons(details.seasons);
        setSelectedSeason(null);
        setSelectedEpisode(null);
        setEpisodes([]);
      } else {
        setSeasons([]);
        setEpisodes([]);
      }
    } else {
      onChange({
        title: result.title,
        thumbnail: result.poster || '',
      });
    }
  };

  const handleSeasonChange = async (seasonNumber: string) => {
    const season = parseInt(seasonNumber, 10);
    setSelectedSeason(season);
    setSelectedEpisode(null);
    setEpisodes([]);
    
    if (selectedTmdb && selectedTmdb.type === 'tv') {
      setLoadingEpisodes(true);
      const eps = await fetchSeasonEpisodes(selectedTmdb.id, season);
      setEpisodes(eps);
      setLoadingEpisodes(false);
    }
  };

  const handleEpisodeChange = (episodeNumber: string) => {
    const episode = parseInt(episodeNumber, 10);
    setSelectedEpisode(episode);
    
    const ep = episodes.find(e => e.episodeNumber === episode);
    if (ep && selectedSeason !== null) {
      // Update title to include episode info
      const episodeTitle = `${selectedTmdb?.title} - S${String(selectedSeason).padStart(2, '0')}E${String(episode).padStart(2, '0')} - ${ep.name}`;
      onChange({ title: episodeTitle });
      onSeasonEpisodeChange?.(selectedSeason, episode);
    }
  };

  return (
    <div className="glass rounded-xl overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <FileText className="h-4 w-4 text-primary" />
          Metadata
          {disabled && <span className="text-xs text-muted-foreground">(editable)</span>}
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/30">
          <div className="pt-4 space-y-2 relative" ref={dropdownRef}>
            <Label htmlFor="title" className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" />
              Title
              {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            </Label>
            <Input
              id="title"
              value={metadata.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              onFocus={() => !disabled && results.length > 0 && setShowDropdown(true)}
              placeholder="Video title (search TMDB)"
              className="bg-secondary/50 border-border/50"
              autoComplete="off"
            />
            
            {/* TMDB Results Dropdown */}
            {showDropdown && results.length > 0 && !disabled && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {results.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelectResult(result)}
                    className="w-full flex items-center gap-3 p-2 hover:bg-secondary/50 transition-colors text-left"
                  >
                    {result.poster ? (
                      <img
                        src={result.poster}
                        alt={result.title}
                        className="w-10 h-14 object-cover rounded flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-10 h-14 bg-secondary/50 rounded flex items-center justify-center flex-shrink-0">
                        {result.type === 'tv' ? (
                          <Tv className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <Film className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{result.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {result.year && <span>{result.year}</span>}
                        {result.year && result.type && <span> • </span>}
                        {result.type && (
                          <span className="capitalize">
                            {result.type === 'tv' ? 'Serie' : 'Film'}
                          </span>
                        )}
                      </p>
                      {result.overview && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {result.overview}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Season/Episode Selection for TV Shows */}
          {seasons.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Tv className="h-3 w-3" />
                  Staffel
                </Label>
                <Select value={selectedSeason?.toString() || ''} onValueChange={handleSeasonChange}>
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue placeholder="Staffel wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {seasons.map((season) => (
                      <SelectItem key={season.seasonNumber} value={season.seasonNumber.toString()}>
                        {season.name} ({season.episodeCount} Episoden)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Film className="h-3 w-3" />
                  Episode
                  {loadingEpisodes && <Loader2 className="h-3 w-3 animate-spin" />}
                </Label>
                <Select 
                  value={selectedEpisode?.toString() || ''} 
                  onValueChange={handleEpisodeChange}
                  disabled={!selectedSeason || loadingEpisodes}
                >
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue placeholder="Episode wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {episodes.map((episode) => (
                      <SelectItem key={episode.episodeNumber} value={episode.episodeNumber.toString()}>
                        E{String(episode.episodeNumber).padStart(2, '0')}: {episode.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="author" className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              Author / Director
            </Label>
            <Input
              id="author"
              value={metadata.author}
              onChange={(e) => onChange({ author: e.target.value })}
              placeholder="Director or creator name"
              className="bg-secondary/50 border-border/50"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="thumbnail" className="flex items-center gap-2 text-xs text-muted-foreground">
              <Image className="h-3 w-3" />
              Thumbnail URL
            </Label>
            <Input
              id="thumbnail"
              value={metadata.thumbnail || ''}
              onChange={(e) => onChange({ thumbnail: e.target.value })}
              placeholder="https://..."
              className="bg-secondary/50 border-border/50"
            />
          </div>
          
          {metadata.thumbnail && (
            <div className="aspect-video rounded-lg overflow-hidden bg-secondary/30">
              <img
                src={metadata.thumbnail}
                alt="Thumbnail preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
