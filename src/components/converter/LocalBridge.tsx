import { useState } from 'react';
import { 
  Download, 
  ExternalLink, 
  FolderOpen, 
  Play, 
  Wifi, 
  WifiOff, 
  Loader2,
  CheckCircle,
  XCircle,
  FileVideo,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useLocalBridge, LocalBridgeMetadata } from '@/hooks/useLocalBridge';
import { toast } from '@/hooks/use-toast';

export const LocalBridge = () => {
  const {
    connected,
    checking,
    filePath,
    status,
    processing,
    progress,
    error,
    checkConnection,
    selectFile,
    startConversion,
    clearFile,
    openModule,
  } = useLocalBridge();

  const [metadata, setMetadata] = useState<LocalBridgeMetadata>({
    title: '',
    author: '',
    show: '',
    season: '',
    episode: '',
    date: '',
    director: '',
    genre: '',
    description: '',
  });

  const handleMetadataChange = (field: keyof LocalBridgeMetadata, value: string) => {
    setMetadata(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectFile = async () => {
    const path = await selectFile();
    if (path) {
      // Extract filename for title suggestion
      const filename = path.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, '') || '';
      setMetadata(prev => ({ ...prev, title: prev.title || filename }));
      toast({
        title: 'Datei ausgewählt',
        description: filename,
      });
    }
  };

  const handleStartConversion = async () => {
    const result = await startConversion(metadata);
    if (result.success) {
      toast({
        title: 'Verarbeitung abgeschlossen',
        description: `Ausgabe: ${result.outputPath}`,
      });
    } else {
      toast({
        title: 'Fehler',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const handleClearFile = () => {
    clearFile();
    setMetadata({
      title: '',
      author: '',
      show: '',
      season: '',
      episode: '',
      date: '',
      director: '',
      genre: '',
      description: '',
    });
  };

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

          <p className="text-xs text-muted-foreground">
            Nach dem Download: Starte <code className="bg-muted px-1 rounded">ffmpegserver.exe</code> und lade diese Seite neu.
          </p>
        </div>
      )}

      {/* Connected State */}
      {connected && (
        <div className="space-y-6">
          {/* Status */}
          <div className="flex items-center gap-2 text-sm">
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : error ? (
              <XCircle className="h-4 w-4 text-destructive" />
            ) : filePath ? (
              <CheckCircle className="h-4 w-4 text-green-400" />
            ) : null}
            <span className={error ? 'text-destructive' : 'text-muted-foreground'}>
              {status}
            </span>
          </div>

          {/* File Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Button 
                variant="glass" 
                onClick={handleSelectFile}
                disabled={processing}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                Lokale Datei auswählen
              </Button>

              {filePath && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleClearFile}
                  disabled={processing}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            {filePath && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">Ausgewählte Datei:</p>
                <p className="text-sm font-mono break-all">{filePath}</p>
              </div>
            )}
          </div>

          {/* Metadata Fields */}
          {filePath && (
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Metadaten bearbeiten</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lb-title">Titel</Label>
                  <Input
                    id="lb-title"
                    value={metadata.title}
                    onChange={(e) => handleMetadataChange('title', e.target.value)}
                    placeholder="Titel der Datei"
                    disabled={processing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lb-author">Autor</Label>
                  <Input
                    id="lb-author"
                    value={metadata.author}
                    onChange={(e) => handleMetadataChange('author', e.target.value)}
                    placeholder="Autor/Künstler"
                    disabled={processing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lb-show">Serie/Show</Label>
                  <Input
                    id="lb-show"
                    value={metadata.show}
                    onChange={(e) => handleMetadataChange('show', e.target.value)}
                    placeholder="Name der Serie"
                    disabled={processing}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="lb-season">Staffel</Label>
                    <Input
                      id="lb-season"
                      value={metadata.season}
                      onChange={(e) => handleMetadataChange('season', e.target.value)}
                      placeholder="1"
                      disabled={processing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lb-episode">Episode</Label>
                    <Input
                      id="lb-episode"
                      value={metadata.episode}
                      onChange={(e) => handleMetadataChange('episode', e.target.value)}
                      placeholder="1"
                      disabled={processing}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lb-date">Datum</Label>
                  <Input
                    id="lb-date"
                    type="date"
                    value={metadata.date}
                    onChange={(e) => handleMetadataChange('date', e.target.value)}
                    disabled={processing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lb-genre">Genre</Label>
                  <Input
                    id="lb-genre"
                    value={metadata.genre}
                    onChange={(e) => handleMetadataChange('genre', e.target.value)}
                    placeholder="Genre"
                    disabled={processing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lb-director">Regisseur</Label>
                  <Input
                    id="lb-director"
                    value={metadata.director}
                    onChange={(e) => handleMetadataChange('director', e.target.value)}
                    placeholder="Regisseur"
                    disabled={processing}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lb-description">Beschreibung</Label>
                <Textarea
                  id="lb-description"
                  value={metadata.description}
                  onChange={(e) => handleMetadataChange('description', e.target.value)}
                  placeholder="Beschreibung der Datei..."
                  rows={3}
                  disabled={processing}
                />
              </div>

              {/* Progress Bar */}
              {processing && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    Verarbeite... {progress}%
                  </p>
                </div>
              )}

              {/* Start Button */}
              <Button
                onClick={handleStartConversion}
                disabled={processing || !filePath}
                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verarbeite...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Verarbeitung starten
                  </>
                )}
              </Button>
            </div>
          )}
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
