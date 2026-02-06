import { useCallback } from 'react';
import { Upload, Link, Files } from 'lucide-react';

interface FileDropzoneProps {
  onFileDrop: (files: File[]) => void;
  onUrlSubmit: (url: string) => void;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
}

export function FileDropzone({ onFileDrop, onUrlSubmit, isDragging, setIsDragging }: FileDropzoneProps) {
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, [setIsDragging]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, [setIsDragging]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(f => 
      f.name.endsWith('.m3u8') || f.name.endsWith('.m3u') || f.name.endsWith('.ts')
    );
    
    if (validFiles.length > 0) {
      onFileDrop(validFiles);
    }
  }, [onFileDrop, setIsDragging]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFileDrop(files);
    }
    e.target.value = '';
  }, [onFileDrop]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300
        ${isDragging 
          ? 'border-primary bg-primary/10 scale-[1.02]' 
          : 'border-border/50 hover:border-primary/50 hover:bg-card/30'
        }
      `}
    >
      <div className="relative z-10 flex flex-col items-center justify-center p-8 md:p-12">
        <div className={`
          mb-4 rounded-full p-4 transition-all duration-300
          ${isDragging ? 'bg-primary/20 scale-110' : 'bg-secondary/50'}
        `}>
          <Upload className={`h-8 w-8 transition-colors ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
        
        <h3 className="mb-2 text-lg font-semibold text-foreground">
          Drop your M3U8 files here
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          or click to browse files (multiple selection supported)
        </p>
        
        <input
          type="file"
          accept=".m3u8,.m3u,.ts"
          multiple
          onChange={handleFileSelect}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Files className="h-3 w-3" />
            Unterstützt: .m3u8, .m3u, .ts Dateien
          </span>
        </div>
      </div>
      
      {isDragging && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
      )}
    </div>
  );
}
