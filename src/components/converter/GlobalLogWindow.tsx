import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Terminal, Trash2, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error' | 'ffmpeg';
  message: string;
  source?: string;
}

interface GlobalLogWindowProps {
  logs: LogEntry[];
  onClear: () => void;
}

export function GlobalLogWindow({ logs, onClear }: GlobalLogWindowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isExpanded]);

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-400';
      case 'warning':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      case 'ffmpeg':
        return 'text-blue-400';
      default:
        return 'text-muted-foreground';
    }
  };

  const formatTime = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${ms}`;
  };

  const exportLogs = () => {
    const content = logs.map(log => 
      `[${formatTime(log.timestamp)}] [${log.type.toUpperCase()}]${log.source ? ` [${log.source}]` : ''} ${log.message}`
    ).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsMinimized(false)}
          className="glass shadow-lg gap-2"
          size="sm"
        >
          <Terminal className="h-4 w-4" />
          Logs ({logs.length})
        </Button>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 border-t border-border/50",
        isExpanded ? "h-80" : "h-12"
      )}
    >
      {/* Background with blur */}
      <div className="absolute inset-0 bg-background/95 backdrop-blur-xl" />
      
      {/* Header */}
      <div 
        className="relative h-12 px-4 flex items-center justify-between cursor-pointer hover:bg-secondary/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Terminal className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">System Logs</span>
          <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
            {logs.length} entries
          </span>
          {logs.length > 0 && logs[logs.length - 1] && (
            <span className={cn("text-xs truncate max-w-md", getLogColor(logs[logs.length - 1].type))}>
              {logs[logs.length - 1].message}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              exportLogs();
            }}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(true);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      
      {/* Log Content */}
      {isExpanded && (
        <div className="relative h-[calc(100%-3rem)]">
          <ScrollArea className="h-full">
            <div ref={scrollRef} className="p-4 font-mono text-xs space-y-1">
              {logs.length === 0 ? (
                <div className="text-muted-foreground text-center py-8">
                  No logs yet. Start a conversion or edit to see detailed progress.
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex gap-2 hover:bg-secondary/20 rounded px-1">
                    <span className="text-muted-foreground shrink-0">
                      [{formatTime(log.timestamp)}]
                    </span>
                    {log.source && (
                      <span className="text-primary/70 shrink-0">
                        [{log.source}]
                      </span>
                    )}
                    <span className={cn("break-all", getLogColor(log.type))}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

// Global log store
let globalLogs: LogEntry[] = [];
let listeners: ((logs: LogEntry[]) => void)[] = [];

export function addGlobalLog(type: LogEntry['type'], message: string, source?: string) {
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    type,
    message,
    source,
  };
  
  globalLogs = [...globalLogs, entry];
  
  // Keep max 1000 logs
  if (globalLogs.length > 1000) {
    globalLogs = globalLogs.slice(-1000);
  }
  
  listeners.forEach(listener => listener(globalLogs));
}

export function clearGlobalLogs() {
  globalLogs = [];
  listeners.forEach(listener => listener(globalLogs));
}

export function useGlobalLogs() {
  const [logs, setLogs] = useState<LogEntry[]>(globalLogs);
  
  useEffect(() => {
    const listener = (newLogs: LogEntry[]) => setLogs([...newLogs]);
    listeners.push(listener);
    
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }, []);
  
  return { logs, addLog: addGlobalLog, clearLogs: clearGlobalLogs };
}
