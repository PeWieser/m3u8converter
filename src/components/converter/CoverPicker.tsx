import { useState, useEffect } from 'react';
import { Image, Loader2, Globe } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTmdbSearch, TMDB_LANGUAGES, type TmdbSeasonImage } from '@/hooks/useTmdbSearch';

interface CoverOption {
  url: string;
  label: string;
  language?: string;
}

interface CoverPickerProps {
  tmdbId: number | null;
  tmdbType: 'movie' | 'tv' | null;
  seasons: { seasonNumber: number; name: string; poster?: string }[];
  mainPoster?: string;
  language: string;
  onSelect: (url: string) => void;
  disabled?: boolean;
}

const LANG_NAMES: Record<string, string> = {
  de: 'Deutsch', en: 'English', fr: 'Français', es: 'Español',
  it: 'Italiano', pt: 'Português', ja: '日本語', ko: '한국어',
  zh: '中文', ru: 'Русский', nl: 'Nederlands', pl: 'Polski',
  tr: 'Türkçe', sv: 'Svenska',
};

function getLangLabel(iso: string | undefined | null): string {
  if (!iso) return 'Textless';
  return LANG_NAMES[iso] || iso.toUpperCase();
}

export function CoverPicker({ tmdbId, tmdbType, seasons, mainPoster, language, onSelect, disabled }: CoverPickerProps) {
  const [open, setOpen] = useState(false);
  const [covers, setCovers] = useState<CoverOption[]>([]);
  const [loading, setLoading] = useState(false);
  const { fetchSeasonImages } = useTmdbSearch();

  useEffect(() => {
    if (!open || !tmdbId || tmdbType !== 'tv') return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      const allCovers: CoverOption[] = [];

      // Main poster
      if (mainPoster) {
        allCovers.push({ url: mainPoster, label: 'Hauptcover' });
      }

      // Fetch images for each season in parallel
      const promises = seasons.map(async (s) => {
        const images = await fetchSeasonImages(tmdbId, s.seasonNumber);
        return { season: s, images };
      });

      const results = await Promise.all(promises);

      for (const { season, images } of results) {
        // Add the default season poster first if not already in images
        if (season.poster) {
          const alreadyIncluded = images.some(img => season.poster?.includes(img.file_path));
          if (!alreadyIncluded) {
            allCovers.push({
              url: season.poster.replace('/w185', '/w500'),
              label: `S${season.seasonNumber}`,
            });
          }
        }

        for (const img of images) {
          allCovers.push({
            url: img.url,
            label: `S${season.seasonNumber}`,
            language: img.iso_639_1 || undefined,
          });
        }
      }

      if (!cancelled) {
        setCovers(allCovers);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, tmdbId, tmdbType, seasons, mainPoster, fetchSeasonImages]);

  if (!tmdbId || tmdbType !== 'tv' || seasons.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Image className="h-4 w-4 mr-2" />
          Alle Cover anzeigen
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <div className="p-3 border-b border-border">
          <h4 className="text-sm font-semibold">Verfügbare Cover</h4>
          <p className="text-xs text-muted-foreground">Klicke auf ein Cover um es auszuwählen</p>
        </div>
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Cover werden geladen...</span>
            </div>
          ) : covers.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
              Keine Cover gefunden
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 p-3">
              {covers.map((cover, i) => (
                <button
                  key={`${cover.url}-${i}`}
                  onClick={() => {
                    onSelect(cover.url);
                    setOpen(false);
                  }}
                  className="group relative rounded-lg overflow-hidden border border-border/50 hover:border-primary hover:ring-2 hover:ring-primary/30 transition-all"
                >
                  <img
                    src={cover.url}
                    alt={cover.label}
                    className="w-full aspect-[2/3] object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                    <p className="text-[10px] font-medium text-white leading-tight">{cover.label}</p>
                    {cover.language !== undefined && (
                      <p className="text-[9px] text-white/70 flex items-center gap-0.5">
                        <Globe className="h-2.5 w-2.5" />
                        {getLangLabel(cover.language)}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
