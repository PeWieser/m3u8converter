import type { M3U8Playlist, M3U8Segment, M3U8Variant } from '@/types/converter';

export async function parseM3U8(content: string, baseUrl?: string): Promise<M3U8Playlist> {
  const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
  
  if (!lines[0].includes('#EXTM3U')) {
    throw new Error('Invalid M3U8 file: Missing #EXTM3U header');
  }

  // Check if this is a master playlist
  const isMaster = lines.some(line => line.startsWith('#EXT-X-STREAM-INF'));

  if (isMaster) {
    return parseMasterPlaylist(lines, baseUrl);
  } else {
    return parseMediaPlaylist(lines, baseUrl);
  }
}

function parseMasterPlaylist(lines: string[], baseUrl?: string): M3U8Playlist {
  const variants: M3U8Variant[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const attributes = parseAttributes(line.substring(18));
      const uri = lines[i + 1];
      
      if (uri && !uri.startsWith('#')) {
        const bandwidth = parseInt(attributes.BANDWIDTH || '0', 10);
        const resolution = attributes.RESOLUTION 
          ? parseResolution(attributes.RESOLUTION)
          : undefined;
        
        variants.push({
          uri: resolveUrl(uri, baseUrl),
          bandwidth,
          resolution,
          name: resolution 
            ? `${resolution.height}p` 
            : `${Math.round(bandwidth / 1000)}kbps`,
        });
      }
    }
  }

  // Sort by bandwidth (highest first)
  variants.sort((a, b) => b.bandwidth - a.bandwidth);

  return { type: 'master', variants };
}

function parseMediaPlaylist(lines: string[], baseUrl?: string): M3U8Playlist {
  const segments: M3U8Segment[] = [];
  let totalDuration = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('#EXTINF:')) {
      const match = line.match(/#EXTINF:([\d.]+)/);
      if (match) {
        const duration = parseFloat(match[1]);
        const uri = lines[i + 1];
        
        if (uri && !uri.startsWith('#')) {
          segments.push({
            uri: resolveUrl(uri, baseUrl),
            duration,
          });
          totalDuration += duration;
        }
      }
    }
  }

  return { type: 'media', segments, totalDuration };
}

function parseAttributes(str: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([A-Z-]+)=("([^"]*)"|([^,]*))/g;
  let match;
  
  while ((match = regex.exec(str)) !== null) {
    attrs[match[1]] = match[3] || match[4];
  }
  
  return attrs;
}

function parseResolution(str: string): { width: number; height: number } | undefined {
  const match = str.match(/(\d+)x(\d+)/);
  if (match) {
    return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
  }
  return undefined;
}

function resolveUrl(url: string, baseUrl?: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  if (!baseUrl) return url;
  
  const base = new URL(baseUrl);
  if (url.startsWith('/')) {
    return `${base.origin}${url}`;
  }
  
  const basePath = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
  return `${base.origin}${basePath}${url}`;
}

export function getBaseUrl(url: string): string {
  const idx = url.lastIndexOf('/');
  return idx > 0 ? url.substring(0, idx + 1) : url;
}
