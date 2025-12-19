import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ProgressBarProps {
  progress: number;
  status: string;
  logs: string[];
  estimatedSize?: number;
}

export function ProgressBar({ progress, status, logs, estimatedSize }: ProgressBarProps) {
  const statusLabel = useMemo(() => {
    switch (status) {
      case 'pending': return 'Waiting...';
      case 'parsing': return 'Parsing playlist...';
      case 'downloading': return 'Downloading segments...';
      case 'converting': return 'Converting...';
      case 'completed': return 'Completed!';
      case 'error': return 'Error';
      default: return status;
    }
  }, [status]);

  const statusColor = useMemo(() => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'error': return 'text-destructive';
      default: return 'text-foreground';
    }
  }, [status]);

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className={statusColor}>{statusLabel}</span>
          <span className="text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        
        <div className="relative h-2 overflow-hidden rounded-full bg-secondary/50">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
          {progress > 0 && progress < 100 && (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary/50 to-accent/50 animate-pulse"
              style={{ width: `${progress}%` }}
            />
          )}
        </div>
        
        {estimatedSize && (
          <p className="text-xs text-muted-foreground">
            Estimated size: ~{(estimatedSize / 1024 / 1024).toFixed(1)} MB
          </p>
        )}
      </div>

      {/* Logs */}
      {logs.length > 0 && (
        <div className="glass rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border/30">
            <span className="text-xs font-medium text-muted-foreground">Conversion Log</span>
          </div>
          <ScrollArea className="h-32">
            <div className="p-3 font-mono text-xs space-y-1 scrollbar-thin">
              {logs.map((log, idx) => (
                <div
                  key={idx}
                  className={`${
                    log.includes('Error') 
                      ? 'text-destructive' 
                      : log.includes('complete') || log.includes('Complete')
                        ? 'text-green-400'
                        : 'text-muted-foreground'
                  }`}
                >
                  {log}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
