import { useState, useEffect } from 'react';
import { Settings, HardDrive, AlertTriangle, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MemorySettings as MemorySettingsType } from '@/lib/chunked-file-reader';

interface MemorySettingsProps {
  settings: MemorySettingsType;
  onChange: (settings: MemorySettingsType) => void;
  fileSize?: number;
  warning?: string | null;
}

export function MemorySettings({ settings, onChange, fileSize, warning }: MemorySettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Auto-open if there's a warning
  useEffect(() => {
    if (warning) {
      setIsOpen(true);
    }
  }, [warning]);

  const handleChunkSizeChange = (value: number[]) => {
    onChange({ ...settings, chunkSizeMB: value[0] });
  };

  const handleThriftyModeChange = (checked: boolean) => {
    onChange({ ...settings, thriftyMode: checked });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="glass rounded-xl overflow-hidden">
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full flex items-center justify-between p-4 hover:bg-secondary/30"
          >
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Speicher-Einstellungen</span>
              {settings.thriftyMode && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                  Sparsam
                </span>
              )}
            </div>
            <Settings className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4 border-t border-border/50">
            {/* Warning message */}
            {warning && (
              <div className="flex gap-3 p-3 mt-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-600 dark:text-amber-400">{warning}</p>
              </div>
            )}
            
            {/* Chunk Size Slider */}
            <div className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Chunk-Größe</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Größere Chunks sind schneller, verbrauchen aber mehr RAM. Kleinere Chunks sind stabiler bei großen Dateien.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span className="text-sm font-mono bg-secondary/50 px-2 py-0.5 rounded">
                  {settings.chunkSizeMB} MB
                </span>
              </div>
              
              <Slider
                value={[settings.chunkSizeMB]}
                onValueChange={handleChunkSizeChange}
                min={16}
                max={256}
                step={16}
                className="w-full"
              />
              
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>16 MB (sicherer)</span>
                <span>256 MB (schneller)</span>
              </div>
            </div>
            
            {/* Thrifty Mode Toggle */}
            <div className="flex items-center justify-between py-3 border-t border-border/50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Sparsamer Modus</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Reduziert die Chunk-Größe automatisch und gibt Speicher aggressiver frei. Empfohlen für Dateien über 1.5GB.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-xs text-muted-foreground">
                  Für große Dateien (&gt;1.5GB) empfohlen
                </p>
              </div>
              <Switch
                checked={settings.thriftyMode}
                onCheckedChange={handleThriftyModeChange}
              />
            </div>
            
            {/* Current file info */}
            {fileSize !== undefined && fileSize > 0 && (
              <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                Aktuelle Datei: {(fileSize / 1024 / 1024).toFixed(2)} MB
                {fileSize > 1024 * 1024 * 1024 && (
                  <span className="text-primary ml-2">
                    ({(fileSize / 1024 / 1024 / 1024).toFixed(2)} GB)
                  </span>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
