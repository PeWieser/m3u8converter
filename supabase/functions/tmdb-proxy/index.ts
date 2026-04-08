import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Validation constants
const MAX_QUERY_LENGTH = 200;
const MIN_QUERY_LENGTH = 2;
const MAX_ID_VALUE = 999999999;
const MAX_SEASON_NUMBER = 100;

// Simple in-memory rate limiting (per IP, resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60; // 60 requests per minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  entry.count++;
  return true;
}

function validateNumericId(value: any): number | null {
  if (value === undefined || value === null) return null;
  const num = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (isNaN(num) || num <= 0 || num > MAX_ID_VALUE) return null;
  return num;
}

function validateSeasonNumber(value: any): number | null {
  if (value === undefined || value === null) return null;
  const num = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (isNaN(num) || num < 0 || num > MAX_SEASON_NUMBER) return null;
  return num;
}

function sanitizeQuery(query: string): string {
  // Remove potentially dangerous characters and limit length
  return query
    .replace(/[<>'";\\/]/g, '')
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    
    // Check rate limit
    if (!checkRateLimit(clientIP)) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY');
    if (!TMDB_API_KEY) {
      console.error('TMDB_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'TMDB API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, query, id, type, seasonNumber, imageUrl, language } = body;
    
    // Determine language for TMDB API calls (default: de-DE)
    const tmdbLanguage = language && typeof language === 'string' ? language : 'de-DE';

    // Validate action parameter
    if (!action || typeof action !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid action parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validActions = ['search', 'movie-details', 'tv-details', 'season-episodes', 'season-images', 'proxy-image'];
    if (!validActions.includes(action)) {
      console.warn(`Invalid action attempted: ${action}`);
      return new Response(
        JSON.stringify({ error: 'Unknown action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle image proxy action separately (returns base64 encoded image)
    if (action === 'proxy-image') {
      if (!imageUrl || typeof imageUrl !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Missing imageUrl parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Only allow TMDB image URLs
      if (!imageUrl.startsWith('https://image.tmdb.org/')) {
        return new Response(
          JSON.stringify({ error: 'Only TMDB image URLs are allowed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      try {
        console.log('Fetching image from:', imageUrl);
        const imgResponse = await fetch(imageUrl);
        if (!imgResponse.ok) {
          console.error('Failed to fetch image:', imgResponse.status);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch image' }),
            { status: imgResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const imageData = await imgResponse.arrayBuffer();
        const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
        
        // Convert to base64 using chunks to avoid stack overflow for large images
        const uint8Array = new Uint8Array(imageData);
        const CHUNK_SIZE = 32768; // 32KB chunks
        let base64 = '';
        
        for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
          const chunk = uint8Array.slice(i, Math.min(i + CHUNK_SIZE, uint8Array.length));
          base64 += String.fromCharCode(...chunk);
        }
        base64 = btoa(base64);
        
        console.log('Image fetched successfully, size:', imageData.byteLength, 'bytes, type:', contentType);
        
        return new Response(
          JSON.stringify({ 
            data: base64, 
            contentType: contentType,
            size: imageData.byteLength 
          }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            }
          }
        );
      } catch (error) {
        console.error('Image proxy error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to proxy image: ' + (error instanceof Error ? error.message : 'Unknown error') }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let url: string;

    switch (action) {
      case 'search': {
        if (!query || typeof query !== 'string') {
          return new Response(
            JSON.stringify({ results: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const sanitizedQuery = sanitizeQuery(query);
        
        if (sanitizedQuery.length < MIN_QUERY_LENGTH) {
          return new Response(
            JSON.stringify({ results: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (sanitizedQuery.length > MAX_QUERY_LENGTH) {
          return new Response(
            JSON.stringify({ error: `Query must be ${MIN_QUERY_LENGTH}-${MAX_QUERY_LENGTH} characters` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        url = `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(sanitizedQuery)}&language=${tmdbLanguage}&page=1`;
        break;
      }

      case 'movie-details': {
        const validId = validateNumericId(id);
        if (validId === null) {
          return new Response(
            JSON.stringify({ error: 'Invalid or missing id parameter' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        url = `${TMDB_BASE_URL}/movie/${validId}?api_key=${TMDB_API_KEY}&language=${tmdbLanguage}&append_to_response=credits`;
        break;
      }

      case 'tv-details': {
        const validId = validateNumericId(id);
        if (validId === null) {
          return new Response(
            JSON.stringify({ error: 'Invalid or missing id parameter' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        url = `${TMDB_BASE_URL}/tv/${validId}?api_key=${TMDB_API_KEY}&language=de-DE&append_to_response=credits`;
        break;
      }

      case 'season-episodes': {
        const validId = validateNumericId(id);
        const validSeason = validateSeasonNumber(seasonNumber);
        
        if (validId === null) {
          return new Response(
            JSON.stringify({ error: 'Invalid or missing id parameter' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (validSeason === null) {
          return new Response(
            JSON.stringify({ error: 'Invalid or missing seasonNumber parameter' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        url = `${TMDB_BASE_URL}/tv/${validId}/season/${validSeason}?api_key=${TMDB_API_KEY}&language=de-DE`;
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`TMDB Proxy: ${action} request from ${clientIP}`);

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error('TMDB API error:', response.status, data);
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
