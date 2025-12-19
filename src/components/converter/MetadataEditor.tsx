import { useState } from 'react';
import { FileText, User, Image, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ConversionMetadata } from '@/types/converter';

interface MetadataEditorProps {
  metadata: ConversionMetadata;
  onChange: (metadata: Partial<ConversionMetadata>) => void;
}

export function MetadataEditor({ metadata, onChange }: MetadataEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="glass rounded-xl overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <FileText className="h-4 w-4 text-primary" />
          Metadata
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/30">
          <div className="pt-4 space-y-2">
            <Label htmlFor="title" className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" />
              Title
            </Label>
            <Input
              id="title"
              value={metadata.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Video title"
              className="bg-secondary/50 border-border/50"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="author" className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              Author
            </Label>
            <Input
              id="author"
              value={metadata.author}
              onChange={(e) => onChange({ author: e.target.value })}
              placeholder="Author name"
              className="bg-secondary/50 border-border/50"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="thumbnail" className="flex items-center gap-2 text-xs text-muted-foreground">
              <Image className="h-3 w-3" />
              Thumbnail URL
            </Label>
            <Input
              id="thumbnail"
              value={metadata.thumbnail || ''}
              onChange={(e) => onChange({ thumbnail: e.target.value })}
              placeholder="https://..."
              className="bg-secondary/50 border-border/50"
            />
          </div>
          
          {metadata.thumbnail && (
            <div className="aspect-video rounded-lg overflow-hidden bg-secondary/30">
              <img
                src={metadata.thumbnail}
                alt="Thumbnail preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
