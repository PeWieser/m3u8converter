import { Check, ChevronDown, Monitor, Tv, Smartphone } from 'lucide-react';
import type { M3U8Variant } from '@/types/converter';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface QualitySelectorProps {
  variants: M3U8Variant[];
  selected?: M3U8Variant;
  onSelect: (variant: M3U8Variant) => void;
}

function getQualityIcon(resolution?: { width: number; height: number }) {
  if (!resolution) return <Monitor className="h-4 w-4" />;
  if (resolution.height >= 1080) return <Tv className="h-4 w-4" />;
  if (resolution.height >= 720) return <Monitor className="h-4 w-4" />;
  return <Smartphone className="h-4 w-4" />;
}

function formatBandwidth(bandwidth: number): string {
  if (bandwidth >= 1000000) {
    return `${(bandwidth / 1000000).toFixed(1)} Mbps`;
  }
  return `${Math.round(bandwidth / 1000)} kbps`;
}

export function QualitySelector({ variants, selected, onSelect }: QualitySelectorProps) {
  if (variants.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between bg-secondary/50 border-border/50">
          <span className="flex items-center gap-2">
            {selected ? (
              <>
                {getQualityIcon(selected.resolution)}
                <span>{selected.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({formatBandwidth(selected.bandwidth)})
                </span>
              </>
            ) : (
              'Select quality'
            )}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 bg-popover/95 backdrop-blur-xl border-border/50">
        {variants.map((variant, idx) => (
          <DropdownMenuItem
            key={idx}
            onClick={() => onSelect(variant)}
            className="flex items-center justify-between gap-2 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              {getQualityIcon(variant.resolution)}
              <span>{variant.name}</span>
              <span className="text-xs text-muted-foreground">
                {formatBandwidth(variant.bandwidth)}
              </span>
            </div>
            {selected?.uri === variant.uri && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
