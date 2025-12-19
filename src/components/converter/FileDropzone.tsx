import { useCallback } from 'react';
import { Upload, Link } from 'lucide-react';

interface FileDropzoneProps {
  onFileDrop: (file: File) => void;
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
    const m3u8File = files.find(f => 
      f.name.endsWith('.m3u8') || f.name.endsWith('.m3u')
    );
    
    if (m3u8File) {
      onFileDrop(m3u8File);
    }
  }, [onFileDrop, setIsDragging]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileDrop(file);
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
          Drop your M3U8 file here
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          or click to browse files
        </p>
        
        <input
          type="file"
          accept=".m3u8,.m3u"
          onChange={handleFileSelect}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Link className="h-3 w-3" />
            Supports .m3u8 and .m3u files
          </span>
        </div>
      </div>
      
      {isDragging && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
      )}
    </div>
  );
}
