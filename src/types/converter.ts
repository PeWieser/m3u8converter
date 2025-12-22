export interface M3U8Segment {
  uri: string;
  duration: number;
  title?: string;
}

export interface M3U8Playlist {
  type: 'master' | 'media';
  segments?: M3U8Segment[];
  variants?: M3U8Variant[];
  totalDuration?: number;
}

export interface M3U8Variant {
  uri: string;
  bandwidth: number;
  resolution?: { width: number; height: number };
  name?: string;
}

export interface ConversionJob {
  id: string;
  name: string;
  source: string;
  sourceType: 'file' | 'url';
  status: 'pending' | 'parsing' | 'downloading' | 'converting' | 'completed' | 'error';
  progress: number;
  logs: string[];
  estimatedSize?: number;
  outputUrl?: string;
  outputBlob?: Blob;
  selectedVariant?: M3U8Variant;
  metadata: ConversionMetadata;
  audioOnly: boolean;
  startTime?: number;
  endTime?: number;
  error?: string;
  // Download stats
  downloadSpeed?: number; // bytes per second
  downloadedBytes?: number;
  totalBytes?: number;
  remainingTime?: number; // seconds
  // Video quality from M3U8
  videoQuality?: string;
  // TMDB data for TV series
  tmdbId?: number;
  tmdbType?: 'movie' | 'tv';
  selectedSeason?: number;
  selectedEpisode?: number;
}

export interface ConversionMetadata {
  title: string;
  author: string;
  thumbnail?: string;
}

export interface ConversionHistory {
  id: string;
  name: string;
  source: string;
  outputFormat: 'mp4' | 'mp3';
  size: number;
  duration: number;
  completedAt: string;
  metadata: ConversionMetadata;
}
