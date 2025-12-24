import { useState } from 'react';
import { Zap, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface OptimizerSettingsProps {
  enabled: boolean;
  concurrency: number;
  minConcurrency: number;
  maxConcurrency: number;
  stats?: {
    currentSpeed: number;
    averageSpeed: number;
    adjustments: number;
    optimalConcurrency: number;
  };
  onEnabledChange: (enabled: boolean) => void;
  onConcurrencyChange: (concurrency: number) => void;
}

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond >= 1024 * 1024) {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  } else if (bytesPerSecond >= 1024) {
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  }
  return `${bytesPerSecond.toFixed(0)} B/s`;
}

export function OptimizerSettings({
  enabled,
  concurrency,
  minConcurrency,
  maxConcurrency,
  stats,
  onEnabledChange,
  onConcurrencyChange,
}: OptimizerSettingsProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${enabled ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
            <Zap className="h-4 w-4" />
          </div>
          <div className="text-left">
            <h4 className="font-medium text-sm">Download Optimizer</h4>
            <p className="text-xs text-muted-foreground">
              {enabled ? 'Automatische Optimierung aktiv' : 'Klicken zum Konfigurieren'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded">
            {concurrency} Verbindungen
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="p-4 pt-0 space-y-4 border-t border-border/30">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Auto-Tuning</Label>
              <p className="text-xs text-muted-foreground">
                Passt Verbindungen automatisch an deine Bandbreite an
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={onEnabledChange}
            />
          </div>

          {/* Manual Concurrency Slider (when disabled) */}
          {!enabled && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm">Parallele Downloads</Label>
                <span className="text-sm font-mono text-primary">{concurrency}</span>
              </div>
              <Slider
                value={[concurrency]}
                onValueChange={(values) => onConcurrencyChange(values[0])}
                min={minConcurrency}
                max={maxConcurrency}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{minConcurrency} (langsam)</span>
                <span>{maxConcurrency} (schnell)</span>
              </div>
            </div>
          )}

          {/* Stats (when enabled and has data) */}
          {enabled && stats && stats.averageSpeed > 0 && (
            <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Settings className="h-3 w-3" />
                <span>Optimizer Statistiken</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Aktuelle Geschw.:</span>
                  <span className="ml-2 font-mono">{formatSpeed(stats.currentSpeed)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Durchschnitt:</span>
                  <span className="ml-2 font-mono">{formatSpeed(stats.averageSpeed)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Anpassungen:</span>
                  <span className="ml-2 font-mono">{stats.adjustments}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Optimal:</span>
                  <span className="ml-2 font-mono">{stats.optimalConcurrency} Verb.</span>
                </div>
              </div>
            </div>
          )}

          {/* Info Text */}
          <p className="text-xs text-muted-foreground leading-relaxed">
            Der Optimizer nutzt einen Hill-Climbing-Algorithmus, um die Anzahl paralleler Downloads 
            dynamisch an deine Netzwerkbandbreite anzupassen. Die Einstellungen werden in Cookies gespeichert.
          </p>
        </div>
      )}
    </div>
  );
}
