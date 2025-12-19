import { useState } from 'react';
import { Link2, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface URLInputProps {
  onSubmit: (url: string) => void;
  disabled?: boolean;
}

export function URLInput({ onSubmit, disabled }: URLInputProps) {
  const [url, setUrl] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    setIsValidating(true);
    // Brief validation delay for UX
    await new Promise(resolve => setTimeout(resolve, 300));
    onSubmit(url.trim());
    setUrl('');
    setIsValidating(false);
  };

  const isValidUrl = url.trim().length > 0 && (
    url.includes('.m3u8') || 
    url.includes('.m3u') ||
    url.includes('m3u8') ||
    url.startsWith('http')
  );

  return (
    <form onSubmit={handleSubmit} className="glass rounded-xl p-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste M3U8 URL here..."
            disabled={disabled || isValidating}
            className="pl-10 bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-primary/20"
          />
        </div>
        <Button
          type="submit"
          disabled={!isValidUrl || disabled || isValidating}
          className="group relative overflow-hidden bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
        >
          {isValidating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <span>Add to Queue</span>
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
