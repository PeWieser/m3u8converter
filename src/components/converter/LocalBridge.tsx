import { useState } from 'react';
import { 
  Download, 
  ExternalLink, 
  Play, 
  Wifi, 
  WifiOff, 
  Loader2,
  CheckCircle,
  XCircle,
  FileVideo,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useLocalBridge } from '@/hooks/useLocalBridge';
import { toast } from '@/hooks/use-toast';

export const LocalBridge = () => {
  const {
    connected,
    checking,
    status,
    processing,
    progress,
    progressMessage,
    error,
    checkConnection,
    openModule,
  } = useLocalBridge();

  // Download URL for the EXE
  const downloadUrl = 'https://github.com/PeWieser/m3u8converter/raw/main/ffmpegserver.exe';

  return (
    <div className="glass rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileVideo className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">PC-Modul (Lokale Verarbeitung)</h3>
            <p className="text-sm text-muted-foreground">
              Verarbeite große Dateien ohne Browser-Limitierung
            </p>
          </div>
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-2">
          {checking ? (
            <Badge variant="secondary" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Prüfe...
            </Badge>
          ) : connected ? (
            <Badge className="gap-1 bg-green-500/20 text-green-400 border-green-500/30">
              <Wifi className="h-3 w-3" />
              Verbunden
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1 bg-amber-500/20 text-amber-400 border-amber-500/30">
              <WifiOff className="h-3 w-3" />
              Nicht verbunden
            </Badge>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={async () => { await checkConnection(); }}
            disabled={checking}
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Not Connected State */}
      {!connected && !checking && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-4">
          <div className="flex items-start gap-3">
            <WifiOff className="h-5 w-5 text-amber-400 mt-0.5" />
            <div>
              <p className="font-medium text-amber-200">PC-Modul nicht erkannt</p>
              <p className="text-sm text-muted-foreground mt-1">
                Lade das PC-Modul herunter und starte es, um große Dateien lokal zu verarbeiten.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="gradient">
              <a href={downloadUrl} download="ffmpegserver.exe">
                <Download className="h-4 w-4 mr-2" />
                PC-Modul herunterladen
              </a>
            </Button>
            <Button variant="glass" onClick={() => openModule()}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Modul starten
            </Button>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>Wichtig:</strong> Nach dem Download die Datei <code className="bg-muted px-1 rounded">ffmpegserver.exe</code> einmalig mit <span className="text-amber-400 font-medium">Administratorrechten</span> starten (Rechtsklick → "Als Administrator ausführen").
            </p>
            <p>
              Danach kann das Modul normal gestartet werden.
            </p>
          </div>
        </div>
      )}

      {/* Connected State */}
      {connected && (
        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2 text-sm">
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : error ? (
              <XCircle className="h-4 w-4 text-destructive" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-400" />
            )}
            <span className={error ? 'text-destructive' : 'text-muted-foreground'}>
              {status}
            </span>
          </div>

          {/* Progress Bar */}
          {processing && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {progressMessage || `Verarbeite... ${progress}%`}
              </p>
            </div>
          )}

          {/* Info */}
          <div className="rounded-lg bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-medium">
              ✓ PC-Modul ist bereit
            </p>
            <p className="text-xs text-muted-foreground">
              Die Dateiauswahl und Metadaten-Eingabe erfolgt über den MP4-Editor oben. 
              Bei großen Dateien (&gt;1.5 GB) wird automatisch das PC-Modul verwendet.
            </p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
};
