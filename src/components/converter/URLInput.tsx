import { useState } from 'react';
import { Link2, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { validateM3U8Url } from '@/lib/url-validator';

interface URLInputProps {
  onSubmit: (url: string) => void;
  disabled?: boolean;
}

export function URLInput({ onSubmit, disabled }: URLInputProps) {
  const [url, setUrl] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    setIsValidating(true);
    setValidationError(null);
    
    // Validate URL
    const validation = validateM3U8Url(url.trim());
    
    if (!validation.valid) {
      setValidationError(validation.error || 'Ungültige URL');
      setIsValidating(false);
      return;
    }
    
    // Brief validation delay for UX
    await new Promise(resolve => setTimeout(resolve, 200));
    onSubmit(validation.sanitizedUrl || url.trim());
    setUrl('');
    setIsValidating(false);
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    // Clear error when user types
    if (validationError) {
      setValidationError(null);
    }
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
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="Paste M3U8 URL here..."
            disabled={disabled || isValidating}
            className={`pl-10 bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 ${
              validationError ? 'border-destructive/50 focus:border-destructive' : ''
            }`}
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
      
      {/* Validation error message */}
      {validationError && (
        <div className="flex items-center gap-2 mt-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{validationError}</span>
        </div>
      )}
    </form>
  );
}
