import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY');
    if (!TMDB_API_KEY) {
      console.error('TMDB_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'TMDB API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, query, id, type, seasonNumber } = await req.json();

    // Validate input
    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Missing action parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let url: string;

    switch (action) {
      case 'search':
        if (!query || query.trim().length < 2) {
          return new Response(
            JSON.stringify({ results: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        url = `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=de-DE&page=1`;
        break;

      case 'movie-details':
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'Missing id parameter' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        url = `${TMDB_BASE_URL}/movie/${id}?api_key=${TMDB_API_KEY}&language=de-DE&append_to_response=credits`;
        break;

      case 'tv-details':
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'Missing id parameter' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        url = `${TMDB_BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}&language=de-DE&append_to_response=credits`;
        break;

      case 'season-episodes':
        if (!id || seasonNumber === undefined) {
          return new Response(
            JSON.stringify({ error: 'Missing id or seasonNumber parameter' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        url = `${TMDB_BASE_URL}/tv/${id}/season/${seasonNumber}?api_key=${TMDB_API_KEY}&language=de-DE`;
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`TMDB Proxy: ${action} request`);

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error('TMDB API error:', data);
      return new Response(
        JSON.stringify({ error: 'TMDB API error', details: data }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('TMDB Proxy error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
