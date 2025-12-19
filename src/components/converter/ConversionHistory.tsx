import { Clock, Download, FileVideo, FileAudio, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ConversionHistory as HistoryType } from '@/types/converter';

interface ConversionHistoryProps {
  history: HistoryType[];
  onClear: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  
  return date.toLocaleDateString();
}

export function ConversionHistory({ history, onClear }: ConversionHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <Clock className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        <h3 className="text-sm font-medium mb-1">No conversion history</h3>
        <p className="text-xs text-muted-foreground">
          Your completed conversions will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border/30">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Conversion History
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Clear
        </Button>
      </div>
      
      <ScrollArea className="h-64">
        <div className="divide-y divide-border/30">
          {history.map((item) => (
            <div key={item.id} className="p-4 hover:bg-secondary/20 transition-colors">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center">
                  {item.outputFormat === 'mp3' ? (
                    <FileAudio className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <FileVideo className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium truncate">{item.name}</h4>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{formatFileSize(item.size)}</span>
                    <span>•</span>
                    <span>{item.outputFormat.toUpperCase()}</span>
                    <span>•</span>
                    <span>{formatDate(item.completedAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
