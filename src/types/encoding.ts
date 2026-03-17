/**
 * Video/Audio Encoding Settings
 */

export interface EncodingSettings {
  enabled: boolean; // false = metadata-only, true = convert
  
  // Video
  videoCodec: string;
  framerate: string;
  resolution: string;
  customWidth?: number;
  customHeight?: number;
  aspectRatio: string;
  videoBitrate: string;
  h264Profile: string;
  h264Level: string;
  gopSize: string;
  bFrames: string;
  
  // Audio
  audioCodec: string;
  sampleRate: string;
  audioChannels: string;
  audioBitrate: string;
}

export const DEFAULT_ENCODING: EncodingSettings = {
  enabled: false,
  videoCodec: 'libx264',
  framerate: 'original',
  resolution: 'original',
  aspectRatio: 'original',
  videoBitrate: 'auto',
  h264Profile: 'high',
  h264Level: '4.1',
  gopSize: 'auto',
  bFrames: 'auto',
  audioCodec: 'aac',
  sampleRate: 'original',
  audioChannels: 'original',
  audioBitrate: '192k',
};

export const VIDEO_CODECS = [
  { value: 'libx264', label: 'H.264 (AVC)' },
  { value: 'libx265', label: 'H.265 (HEVC)' },
  { value: 'libvpx-vp9', label: 'VP9' },
  { value: 'copy', label: 'Kopieren (kein Re-Encoding)' },
];

export const FRAMERATES = [
  { value: 'original', label: 'Original beibehalten' },
  { value: '23.976', label: '23.976 fps (Film)' },
  { value: '24', label: '24 fps' },
  { value: '25', label: '25 fps (PAL)' },
  { value: '29.97', label: '29.97 fps (NTSC)' },
  { value: '30', label: '30 fps' },
  { value: '50', label: '50 fps' },
  { value: '60', label: '60 fps' },
];

export const RESOLUTIONS = [
  { value: 'original', label: 'Original beibehalten' },
  { value: '7680x4320', label: '8K (7680×4320)' },
  { value: '3840x2160', label: '4K UHD (3840×2160)' },
  { value: '2560x1440', label: '2K QHD (2560×1440)' },
  { value: '1920x1080', label: 'Full HD (1920×1080)' },
  { value: '1280x720', label: 'HD (1280×720)' },
  { value: '854x480', label: 'SD (854×480)' },
  { value: '640x360', label: '360p (640×360)' },
  { value: 'custom', label: 'Benutzerdefiniert' },
];

export const ASPECT_RATIOS = [
  { value: 'original', label: 'Original beibehalten' },
  { value: '16:9', label: '16:9 (Breitbild)' },
  { value: '4:3', label: '4:3 (Standard)' },
  { value: '21:9', label: '21:9 (Ultra-Breitbild)' },
  { value: '1:1', label: '1:1 (Quadratisch)' },
  { value: '9:16', label: '9:16 (Vertikal)' },
];

export const VIDEO_BITRATES = [
  { value: 'auto', label: 'Automatisch' },
  { value: '500k', label: '500 kbps (niedrig)' },
  { value: '1000k', label: '1 Mbps' },
  { value: '2000k', label: '2 Mbps' },
  { value: '5000k', label: '5 Mbps' },
  { value: '8000k', label: '8 Mbps (HD)' },
  { value: '10000k', label: '10 Mbps' },
  { value: '15000k', label: '15 Mbps (Full HD)' },
  { value: '20000k', label: '20 Mbps' },
  { value: '50000k', label: '50 Mbps (4K)' },
];

export const H264_PROFILES = [
  { value: 'baseline', label: 'Baseline (max. Kompatibilität)' },
  { value: 'main', label: 'Main' },
  { value: 'high', label: 'High (beste Qualität)' },
];

export const H264_LEVELS = [
  { value: '3.0', label: '3.0 (SD)' },
  { value: '3.1', label: '3.1 (720p)' },
  { value: '4.0', label: '4.0 (1080p)' },
  { value: '4.1', label: '4.1 (1080p, empfohlen)' },
  { value: '4.2', label: '4.2' },
  { value: '5.0', label: '5.0 (4K)' },
  { value: '5.1', label: '5.1 (4K, hohe Bitrate)' },
  { value: '5.2', label: '5.2' },
];

export const GOP_SIZES = [
  { value: 'auto', label: 'Automatisch' },
  { value: '12', label: '12 (kurz, hohe Qualität)' },
  { value: '24', label: '24' },
  { value: '30', label: '30' },
  { value: '48', label: '48' },
  { value: '60', label: '60' },
  { value: '120', label: '120' },
  { value: '250', label: '250 (lang, kleine Datei)' },
];

export const B_FRAMES = [
  { value: 'auto', label: 'Automatisch' },
  { value: '0', label: '0 (keine)' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3 (empfohlen)' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6 (max. Kompression)' },
];

export const AUDIO_CODECS = [
  { value: 'aac', label: 'AAC' },
  { value: 'libmp3lame', label: 'MP3' },
  { value: 'libopus', label: 'Opus' },
  { value: 'flac', label: 'FLAC (verlustfrei)' },
  { value: 'copy', label: 'Kopieren (kein Re-Encoding)' },
];

export const SAMPLE_RATES = [
  { value: 'original', label: 'Original beibehalten' },
  { value: '22050', label: '22.050 Hz' },
  { value: '44100', label: '44.100 Hz (CD)' },
  { value: '48000', label: '48.000 Hz (Standard)' },
  { value: '96000', label: '96.000 Hz (Hi-Res)' },
];

export const AUDIO_CHANNELS = [
  { value: 'original', label: 'Original beibehalten' },
  { value: '1', label: 'Mono' },
  { value: '2', label: 'Stereo' },
  { value: '6', label: '5.1 Surround' },
];

export const AUDIO_BITRATES = [
  { value: 'auto', label: 'Automatisch' },
  { value: '64k', label: '64 kbps' },
  { value: '96k', label: '96 kbps' },
  { value: '128k', label: '128 kbps' },
  { value: '192k', label: '192 kbps (empfohlen)' },
  { value: '256k', label: '256 kbps' },
  { value: '320k', label: '320 kbps (max)' },
];

const STORAGE_KEY = 'encoding-settings';

export function loadEncodingSettings(): EncodingSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_ENCODING, ...JSON.parse(stored) };
    }
  } catch {}
  return { ...DEFAULT_ENCODING };
}

export function saveEncodingSettings(settings: EncodingSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

/**
 * Build FFmpeg args from encoding settings
 */
export function buildEncodingArgs(settings: EncodingSettings): string[] {
  const args: string[] = [];

  if (!settings.enabled) {
    // Metadata-only: stream copy
    args.push('-c', 'copy');
    return args;
  }

  // Video codec
  if (settings.videoCodec === 'copy') {
    args.push('-c:v', 'copy');
  } else {
    args.push('-c:v', settings.videoCodec);

    // H264/H265 specific
    if (settings.videoCodec === 'libx264' || settings.videoCodec === 'libx265') {
      args.push('-profile:v', settings.h264Profile);
      if (settings.videoCodec === 'libx264') {
        args.push('-level:v', settings.h264Level);
      }
    }

    // Framerate
    if (settings.framerate !== 'original') {
      args.push('-r', settings.framerate);
    }

    // Resolution
    if (settings.resolution === 'custom' && settings.customWidth && settings.customHeight) {
      args.push('-vf', `scale=${settings.customWidth}:${settings.customHeight}`);
    } else if (settings.resolution !== 'original') {
      const [w, h] = settings.resolution.split('x');
      args.push('-vf', `scale=${w}:${h}`);
    }

    // Aspect ratio
    if (settings.aspectRatio !== 'original') {
      args.push('-aspect', settings.aspectRatio);
    }

    // Video bitrate
    if (settings.videoBitrate !== 'auto') {
      args.push('-b:v', settings.videoBitrate);
    }

    // GOP
    if (settings.gopSize !== 'auto') {
      args.push('-g', settings.gopSize);
    }

    // B-frames
    if (settings.bFrames !== 'auto') {
      args.push('-bf', settings.bFrames);
    }
  }

  // Audio codec
  if (settings.audioCodec === 'copy') {
    args.push('-c:a', 'copy');
  } else {
    args.push('-c:a', settings.audioCodec);

    // Sample rate
    if (settings.sampleRate !== 'original') {
      args.push('-ar', settings.sampleRate);
    }

    // Channels
    if (settings.audioChannels !== 'original') {
      args.push('-ac', settings.audioChannels);
    }

    // Audio bitrate
    if (settings.audioBitrate !== 'auto') {
      args.push('-b:a', settings.audioBitrate);
    }
  }

  return args;
}
