/**
 * Video Format Utilities
 * Handles detection and capabilities for various video formats
 */

// All FFmpeg-supported video formats
export const SUPPORTED_VIDEO_EXTENSIONS = [
  // Common formats
  'mp4', 'm4v', 'mov', 'avi', 'mkv', 'webm', 'ts', 'mts', 'm2ts',
  // Older/legacy formats
  'wmv', 'flv', 'f4v', 'ogv', 'ogm', '3gp', '3g2',
  // Professional formats
  'mxf', 'mpg', 'mpeg', 'm2v', 'vob',
  // Raw formats
  'yuv', 'y4m', 'rawvideo',
  // Other
  'rm', 'rmvb', 'asf', 'divx', 'xvid'
];

export const SUPPORTED_VIDEO_MIMETYPES = [
  'video/mp4',
  'video/x-m4v',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
  'video/mp2t',
  'video/x-ms-wmv',
  'video/x-flv',
  'video/ogg',
  'video/3gpp',
  'video/3gpp2',
  'video/mpeg',
  'video/x-ms-asf'
];

export interface VideoFormatInfo {
  extension: string;
  canEmbedCover: boolean;
  canEmbedMetadata: boolean;
  supportsChapters: boolean;
  outputFormat: string;
  notes?: string;
}

// Format capabilities mapping
export const FORMAT_CAPABILITIES: Record<string, VideoFormatInfo> = {
  mp4: {
    extension: 'mp4',
    canEmbedCover: true,
    canEmbedMetadata: true,
    supportsChapters: true,
    outputFormat: 'mp4',
  },
  m4v: {
    extension: 'm4v',
    canEmbedCover: true,
    canEmbedMetadata: true,
    supportsChapters: true,
    outputFormat: 'mp4',
  },
  mov: {
    extension: 'mov',
    canEmbedCover: true,
    canEmbedMetadata: true,
    supportsChapters: true,
    outputFormat: 'mp4',
  },
  mkv: {
    extension: 'mkv',
    canEmbedCover: true,
    canEmbedMetadata: true,
    supportsChapters: true,
    outputFormat: 'mkv',
    notes: 'MKV unterstützt Attachments für Cover, anders als MP4',
  },
  webm: {
    extension: 'webm',
    canEmbedCover: false,
    canEmbedMetadata: true,
    supportsChapters: true,
    outputFormat: 'webm',
    notes: 'WebM unterstützt keine eingebetteten Cover-Bilder',
  },
  avi: {
    extension: 'avi',
    canEmbedCover: false,
    canEmbedMetadata: true,
    supportsChapters: false,
    outputFormat: 'mp4',
    notes: 'AVI wird zu MP4 konvertiert für bessere Metadaten-Unterstützung',
  },
  ts: {
    extension: 'ts',
    canEmbedCover: false,
    canEmbedMetadata: false,
    supportsChapters: false,
    outputFormat: 'mp4',
    notes: 'MPEG-TS wird zu MP4 konvertiert',
  },
  mts: {
    extension: 'mts',
    canEmbedCover: false,
    canEmbedMetadata: false,
    supportsChapters: false,
    outputFormat: 'mp4',
    notes: 'AVCHD wird zu MP4 konvertiert',
  },
  m2ts: {
    extension: 'm2ts',
    canEmbedCover: false,
    canEmbedMetadata: false,
    supportsChapters: false,
    outputFormat: 'mp4',
    notes: 'Blu-ray TS wird zu MP4 konvertiert',
  },
  wmv: {
    extension: 'wmv',
    canEmbedCover: false,
    canEmbedMetadata: true,
    supportsChapters: false,
    outputFormat: 'mp4',
    notes: 'WMV wird zu MP4 konvertiert',
  },
  flv: {
    extension: 'flv',
    canEmbedCover: false,
    canEmbedMetadata: true,
    supportsChapters: false,
    outputFormat: 'mp4',
    notes: 'FLV wird zu MP4 konvertiert',
  },
  ogv: {
    extension: 'ogv',
    canEmbedCover: false,
    canEmbedMetadata: true,
    supportsChapters: false,
    outputFormat: 'mp4',
    notes: 'OGG Video wird zu MP4 konvertiert',
  },
  '3gp': {
    extension: '3gp',
    canEmbedCover: false,
    canEmbedMetadata: true,
    supportsChapters: false,
    outputFormat: 'mp4',
    notes: '3GP wird zu MP4 konvertiert',
  },
  mpg: {
    extension: 'mpg',
    canEmbedCover: false,
    canEmbedMetadata: false,
    supportsChapters: false,
    outputFormat: 'mp4',
    notes: 'MPEG wird zu MP4 konvertiert',
  },
  mpeg: {
    extension: 'mpeg',
    canEmbedCover: false,
    canEmbedMetadata: false,
    supportsChapters: false,
    outputFormat: 'mp4',
    notes: 'MPEG wird zu MP4 konvertiert',
  },
  vob: {
    extension: 'vob',
    canEmbedCover: false,
    canEmbedMetadata: false,
    supportsChapters: false,
    outputFormat: 'mp4',
    notes: 'DVD VOB wird zu MP4 konvertiert',
  },
};

// Default capabilities for unknown formats
const DEFAULT_CAPABILITIES: VideoFormatInfo = {
  extension: 'unknown',
  canEmbedCover: false,
  canEmbedMetadata: false,
  supportsChapters: false,
  outputFormat: 'mp4',
  notes: 'Unbekanntes Format - wird zu MP4 konvertiert',
};

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

/**
 * Check if a file is a supported video format
 */
export function isSupportedVideoFormat(file: File): boolean {
  const ext = getFileExtension(file.name);
  const mimeMatch = SUPPORTED_VIDEO_MIMETYPES.some(mime => file.type.includes(mime.split('/')[1]));
  return SUPPORTED_VIDEO_EXTENSIONS.includes(ext) || mimeMatch || file.type.startsWith('video/');
}

/**
 * Get format capabilities for a file
 */
export function getFormatCapabilities(file: File): VideoFormatInfo {
  const ext = getFileExtension(file.name);
  return FORMAT_CAPABILITIES[ext] || { ...DEFAULT_CAPABILITIES, extension: ext };
}

/**
 * Get accept string for file input
 */
export function getVideoAcceptString(): string {
  const extensions = SUPPORTED_VIDEO_EXTENSIONS.map(ext => `.${ext}`).join(',');
  const mimes = SUPPORTED_VIDEO_MIMETYPES.join(',');
  return `${mimes},${extensions}`;
}

/**
 * Get a user-friendly format name
 */
export function getFormatDisplayName(file: File): string {
  const ext = getFileExtension(file.name).toUpperCase();
  return ext || 'Video';
}

/**
 * Get warnings/notes for format limitations
 */
export function getFormatWarnings(file: File): string[] {
  const warnings: string[] = [];
  const capabilities = getFormatCapabilities(file);
  
  if (!capabilities.canEmbedCover) {
    warnings.push('Cover-Bilder können bei diesem Format nicht eingebettet werden');
  }
  
  if (!capabilities.canEmbedMetadata) {
    warnings.push('Metadaten werden beim Konvertieren zu MP4 übernommen');
  }
  
  if (capabilities.notes) {
    warnings.push(capabilities.notes);
  }
  
  return warnings;
}
