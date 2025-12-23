/**
 * URL validation utilities for M3U8 streams
 * Prevents SSRF attacks by blocking private IP addresses and invalid protocols
 */

// Private IP ranges that should be blocked
const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^192\.168\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^169\.254\./, // Link-local
  /^0\./, // Invalid
  /^\[::1\]$/, // IPv6 localhost
  /^\[fe80:/i, // IPv6 link-local
  /^\[fc00:/i, // IPv6 private
  /^\[fd00:/i, // IPv6 private
];

// Cloud metadata endpoints that should be blocked
const BLOCKED_HOSTNAMES = [
  '169.254.169.254', // AWS/GCP metadata
  'metadata.google.internal',
  'metadata.google.com',
];

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
  sanitizedUrl?: string;
}

/**
 * Validates an M3U8 URL to prevent SSRF and other attacks
 */
export function validateM3U8Url(url: string): UrlValidationResult {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL ist erforderlich' };
  }

  const trimmedUrl = url.trim();

  if (trimmedUrl.length === 0) {
    return { valid: false, error: 'URL ist erforderlich' };
  }

  if (trimmedUrl.length > 2048) {
    return { valid: false, error: 'URL ist zu lang (max 2048 Zeichen)' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmedUrl);
  } catch {
    return { valid: false, error: 'Ungültiges URL-Format' };
  }

  // Only allow http/https protocols
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'Nur HTTP(S) URLs erlaubt' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block cloud metadata endpoints
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { valid: false, error: 'Diese URL ist nicht erlaubt' };
  }

  // Block private IP ranges
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, error: 'Private IP-Adressen sind nicht erlaubt' };
    }
  }

  // Block URLs with credentials
  if (parsed.username || parsed.password) {
    return { valid: false, error: 'URLs mit Anmeldedaten sind nicht erlaubt' };
  }

  // Verify .m3u8 or .m3u extension (optional - some CDNs don't use file extensions)
  const pathname = parsed.pathname.toLowerCase();
  const hasValidExtension = /\.(m3u8|m3u)$/i.test(pathname);
  const hasM3u8InPath = pathname.includes('m3u8') || pathname.includes('.m3u');
  const hasPlaylistIndicator = pathname.includes('playlist') || 
                                pathname.includes('manifest') ||
                                pathname.includes('master') ||
                                pathname.includes('index');

  // Warn but allow if no m3u8 indicator (some CDNs use query params or different paths)
  if (!hasValidExtension && !hasM3u8InPath && !hasPlaylistIndicator) {
    // Still allow but could warn the user
    console.warn('URL might not be a valid M3U8 stream:', trimmedUrl);
  }

  return { 
    valid: true, 
    sanitizedUrl: parsed.href 
  };
}

/**
 * Validates a segment URL from an M3U8 playlist
 * More permissive than full URL validation since segments come from parsed playlists
 */
export function validateSegmentUrl(url: string, baseUrl?: string): UrlValidationResult {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'Segment-URL ist ungültig' };
  }

  let fullUrl: string;
  try {
    // Handle relative URLs
    if (url.startsWith('http://') || url.startsWith('https://')) {
      fullUrl = url;
    } else if (baseUrl) {
      fullUrl = new URL(url, baseUrl).href;
    } else {
      return { valid: false, error: 'Relative URL ohne Basis-URL' };
    }
  } catch {
    return { valid: false, error: 'Ungültiges URL-Format' };
  }

  let parsed: URL;
  try {
    parsed = new URL(fullUrl);
  } catch {
    return { valid: false, error: 'Ungültiges URL-Format' };
  }

  // Only allow http/https
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'Nur HTTP(S) URLs erlaubt' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block cloud metadata endpoints
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { valid: false, error: 'Diese URL ist nicht erlaubt' };
  }

  // Block private IP ranges
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, error: 'Private IP-Adressen sind nicht erlaubt' };
    }
  }

  return { 
    valid: true, 
    sanitizedUrl: parsed.href 
  };
}
