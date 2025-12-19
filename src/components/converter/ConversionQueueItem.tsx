import { Play, Trash2, Music, Video, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { ConversionJob } from '@/types/converter';
import { ProgressBar } from './ProgressBar';
import { MetadataEditor } from './MetadataEditor';
import { VideoPreview } from './VideoPreview';

interface ConversionQueueItemProps {
  job: ConversionJob;
  onStart: () => void;
  onRemove: () => void;
  onMetadataChange: (metadata: Partial<ConversionJob['metadata']>) => void;
  onAudioOnlyChange: (audioOnly: boolean) => void;
}

export function ConversionQueueItem({
  job,
  onStart,
  onRemove,
  onMetadataChange,
  onAudioOnlyChange,
}: ConversionQueueItemProps) {
  const isProcessing = ['parsing', 'downloading', 'converting'].includes(job.status);
  const isCompleted = job.status === 'completed';
  const isError = job.status === 'error';
  const isPending = job.status === 'pending';

  return (
    <div className="glass-hover rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/30">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`
            flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
            ${isCompleted ? 'bg-green-500/20' : isError ? 'bg-destructive/20' : 'bg-secondary/50'}
          `}>
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : isCompleted ? (
              <CheckCircle className="h-5 w-5 text-green-400" />
            ) : isError ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : job.audioOnly ? (
              <Music className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Video className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          
          <div className="min-w-0">
            <h4 className="font-medium text-sm truncate">{job.name}</h4>
            <p className="text-xs text-muted-foreground truncate">
              {job.sourceType === 'url' ? job.source : 'Local file'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isPending && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Pending controls */}
        {isPending && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id={`audio-${job.id}`}
                  checked={job.audioOnly}
                  onCheckedChange={onAudioOnlyChange}
                />
                <Label htmlFor={`audio-${job.id}`} className="text-sm cursor-pointer">
                  Audio only (MP3)
                </Label>
              </div>
            </div>
            
            <MetadataEditor
              metadata={job.metadata}
              onChange={onMetadataChange}
            />
            
            <Button
              onClick={onStart}
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Conversion
            </Button>
          </>
        )}

        {/* Processing progress */}
        {(isProcessing || isCompleted || isError) && (
          <ProgressBar
            progress={job.progress}
            status={job.status}
            logs={job.logs}
            estimatedSize={job.estimatedSize}
          />
        )}

        {/* Error message */}
        {isError && job.error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">{job.error}</p>
          </div>
        )}

        {/* Completed preview */}
        {isCompleted && job.outputUrl && (
          <VideoPreview
            url={job.outputUrl}
            blob={job.outputBlob}
            filename={`${job.metadata.title || job.name}.${job.audioOnly ? 'mp3' : 'mp4'}`}
            isAudio={job.audioOnly}
          />
        )}
      </div>
    </div>
  );
}
