import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export interface TmdbResult {
  id: number;
  title: string;
  year?: string;
  type: 'movie' | 'tv';
  poster?: string;
  overview?: string;
}

export interface TmdbDetails {
  id: number;
  title: string;
  originalTitle?: string;
  year?: string;
  poster?: string;
  backdrop?: string;
  overview?: string;
  genres?: string[];
  director?: string;
  creators?: string[];
  runtime?: number;
  rating?: number;
  type: 'movie' | 'tv';
  numberOfSeasons?: number;
  seasons?: TmdbSeason[];
}

export interface TmdbSeason {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate?: string;
  poster?: string;
}

export interface TmdbEpisode {
  episodeNumber: number;
  name: string;
  overview?: string;
  airDate?: string;
  still?: string;
}

export function useTmdbSearch() {
  const [results, setResults] = useState<TmdbResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const search = useCallback(async (query: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('tmdb-proxy', {
          body: { action: 'search', query }
        });
        
        if (error) {
          throw new Error('TMDB API request failed');
        }
        
        // Filter for movies and TV shows only
        const items = (data.results || [])
          .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
          .slice(0, 8);
        
        const mappedResults: TmdbResult[] = items.map((item: any) => ({
          id: item.id,
          title: item.title || item.name || '',
          year: (item.release_date || item.first_air_date || '').split('-')[0],
          type: item.media_type as 'movie' | 'tv',
          poster: item.poster_path 
            ? `${TMDB_IMAGE_BASE}/w92${item.poster_path}` 
            : undefined,
          overview: item.overview,
        }));
        
        setResults(mappedResults);
      } catch (error) {
        console.error('TMDB search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
  }, []);

  // Fetch image through our proxy to avoid CORS issues
  const fetchImageAsBlob = useCallback(async (imageUrl: string): Promise<Blob | null> => {
    if (!imageUrl) return null;
    
    try {
      const { data, error } = await supabase.functions.invoke('tmdb-proxy', {
        body: { action: 'proxy-image', imageUrl }
      });
      
      if (error) {
        console.warn('Failed to proxy image:', error);
        return null;
      }
      
      // The response is already a blob if successful
      return data;
    } catch (error) {
      console.error('Image fetch error:', error);
      return null;
    }
  }, []);

  const fetchDetails = useCallback(async (id: number, type: 'movie' | 'tv'): Promise<TmdbDetails | null> => {
    try {
      const action = type === 'movie' ? 'movie-details' : 'tv-details';
      
      const { data: details, error } = await supabase.functions.invoke('tmdb-proxy', {
        body: { action, id }
      });
      
      if (error || !details) {
        throw new Error('TMDB API request failed');
      }
      
      // Extract director or creators from credits
      let director: string | undefined;
      let creators: string[] | undefined;
      
      if (details.credits) {
        if (type === 'movie') {
          const directorEntry = details.credits.crew?.find((c: any) => c.job === 'Director');
          director = directorEntry?.name;
        } else {
          creators = details.created_by?.map((c: any) => c.name) || [];
        }
      }

      // Extract seasons for TV shows
      let seasons: TmdbSeason[] | undefined;
      if (type === 'tv' && details.seasons) {
        seasons = details.seasons
          .filter((s: any) => s.season_number > 0) // Exclude specials (season 0)
          .map((s: any) => ({
            seasonNumber: s.season_number,
            name: s.name,
            episodeCount: s.episode_count,
            airDate: s.air_date,
            poster: s.poster_path ? `${TMDB_IMAGE_BASE}/w185${s.poster_path}` : undefined,
          }));
      }
      
      return {
        id: details.id,
        title: details.title || details.name || '',
        originalTitle: details.original_title || details.original_name,
        year: (details.release_date || details.first_air_date || '').split('-')[0],
        poster: details.poster_path 
          ? `${TMDB_IMAGE_BASE}/w500${details.poster_path}` 
          : undefined,
        backdrop: details.backdrop_path 
          ? `${TMDB_IMAGE_BASE}/w1280${details.backdrop_path}` 
          : undefined,
        overview: details.overview,
        genres: details.genres?.map((g: any) => g.name) || [],
        director,
        creators,
        runtime: details.runtime || details.episode_run_time?.[0],
        rating: details.vote_average,
        type,
        numberOfSeasons: details.number_of_seasons,
        seasons,
      };
    } catch (error) {
      console.error('TMDB details error:', error);
      return null;
    }
  }, []);

  const fetchSeasonEpisodes = useCallback(async (tvId: number, seasonNumber: number): Promise<TmdbEpisode[]> => {
    try {
      const { data, error } = await supabase.functions.invoke('tmdb-proxy', {
        body: { action: 'season-episodes', id: tvId, seasonNumber }
      });
      
      if (error || !data) {
        throw new Error('TMDB API request failed');
      }
      
      return (data.episodes || []).map((ep: any) => ({
        episodeNumber: ep.episode_number,
        name: ep.name,
        overview: ep.overview,
        airDate: ep.air_date,
        still: ep.still_path ? `${TMDB_IMAGE_BASE}/w300${ep.still_path}` : undefined,
      }));
    } catch (error) {
      console.error('TMDB episodes error:', error);
      return [];
    }
  }, []);

  return {
    results,
    loading,
    search,
    clearResults,
    fetchDetails,
    fetchSeasonEpisodes,
    fetchImageAsBlob,
  };
}
