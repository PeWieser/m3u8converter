import { useState, useCallback, useRef } from 'react';

export interface ImdbResult {
  id: string;
  title: string;
  year?: string;
  type?: string;
  poster?: string;
}

export function useImdbSearch() {
  const [results, setResults] = useState<ImdbResult[]>([]);
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
        const response = await fetch(`https://imdbapi.dev/search?query=${encodeURIComponent(query)}`);
        if (!response.ok) {
          throw new Error('IMDB API request failed');
        }
        const data = await response.json();
        
        // Handle the API response structure
        const items = data.results || data || [];
        const mappedResults: ImdbResult[] = items.slice(0, 8).map((item: any) => ({
          id: item.imdb_id || item.id || '',
          title: item.title || item.name || '',
          year: item.year || item.release_year || '',
          type: item.type || item.media_type || 'movie',
          poster: item.poster || item.image || item.poster_path || '',
        }));
        
        setResults(mappedResults);
      } catch (error) {
        console.error('IMDB search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
  }, []);

  const fetchDetails = useCallback(async (imdbId: string) => {
    try {
      const response = await fetch(`https://imdbapi.dev/title/${imdbId}`);
      if (!response.ok) {
        throw new Error('IMDB API request failed');
      }
      return await response.json();
    } catch (error) {
      console.error('IMDB details error:', error);
      return null;
    }
  }, []);

  return {
    results,
    loading,
    search,
    clearResults,
    fetchDetails,
  };
}
