import { useCallback, useRef, useState } from 'react';
import { 
  Upload, 
  FileVideo, 
  Trash2, 
  Monitor, 
  Globe, 
  AlertTriangle,
  CheckCircle,
  Download,
  ExternalLink,
  Wifi,
  WifiOff,
  Loader2,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  getVideoAcceptString, 
  isSupportedVideoFormat,
  getFormatCapabilities,
  getFormatWarnings,
  getFormatDisplayName
} from '@/lib/video-format-utils';
import { 
  getProcessingRecommendation, 
  formatFileSize,
  getThresholds,
  type ProcessingRecommendation 
} from '@/lib/processing-mode';
import { useLocalBridge } from '@/hooks/useLocalBridge';

interface SmartFilePickerProps {
  onFileSelect: (file: File, recommendation: ProcessingRecommendation) => void;
  onLocalFileSelect: (path: string) => void;
  onClear: () => void;
  selectedFile: File | null;
  selectedLocalPath: string | null;
  disabled?: boolean;
}

const DOWNLOAD_URL = 'https://github.com/PeWieser/m3u8converter/raw/main/ffmpegserver.exe';

export function SmartFilePicker({
  onFileSelect,
  onLocalFileSelect,
  onClear,
  selectedFile,
  selectedLocalPath,
  disabled = false,
}: SmartFilePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const {
    connected: bridgeConnected,
    checking: bridgeChecking,
    selectFile: selectLocalFile,
    checkConnection,
    openModule,
  } = useLocalBridge();

  const thresholds = getThresholds();

  // Handle browser file selection
  const handleBrowserFileSelect = useCallback((file: File) => {
    if (!isSupportedVideoFormat(file)) {
      return;
    }
    
    const recommendation = getProcessingRecommendation(file.size, bridgeConnected);
    onFileSelect(file, recommendation);
  }, [bridgeConnected, onFileSelect]);

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleBrowserFileSelect(file);
    }
    e.target.value = '';
  }, [handleBrowserFileSelect]);

  // Handle local file selection
  const handleLocalFileSelect = useCallback(async () => {
    const path = await selectLocalFile();
    if (path) {
      onLocalFileSelect(path);
    }
  }, [selectLocalFile, onLocalFileSelect]);

  // Drag handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && isSupportedVideoFormat(file)) {
      handleBrowserFileSelect(file);
    }
  }, [handleBrowserFileSelect]);

  // Get current selection info
  const hasSelection = selectedFile || selectedLocalPath;
  const currentFileName = selectedFile?.name || selectedLocalPath?.split(/[/\\]/).pop() || '';
  const currentFileSize = selectedFile?.size;
  const currentRecommendation = selectedFile 
    ? getProcessingRecommendation(selectedFile.size, bridgeConnected)
    : null;
  const formatWarnings = selectedFile ? getFormatWarnings(selectedFile) : [];

  return (
    <div className="space-y-4">
      {/* File Selection Area */}
      {!hasSelection ? (
        <div className="space-y-4">
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative overflow-hidden rounded-xl border-2 border-dashed transition-all duration-300
              ${isDragging 
                ? 'border-primary bg-primary/10 scale-[1.01]' 
                : 'border-border/50 hover:border-primary/50 hover:bg-card/30'
              }
              ${disabled ? 'opacity-50 pointer-events-none' : ''}
            `}
          >
            <div className="flex flex-col items-center justify-center p-8">
              <div className={`
                mb-4 rounded-full p-4 transition-all duration-300
                ${isDragging ? 'bg-primary/20 scale-110' : 'bg-secondary/50'}
              `}>
                <Upload className={`h-8 w-8 transition-colors ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              
              <h3 className="mb-2 text-lg font-semibold">
                Video-Datei auswählen
              </h3>
              <p className="mb-4 text-sm text-muted-foreground text-center">
                Ziehe eine Datei hierher oder wähle eine der Optionen unten
              </p>
              
              {/* Selection Buttons */}
              <div className="flex flex-wrap gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled}
                >
                  <Globe className="h-4 w-4 mr-2" />
                  Browser-Datei
                </Button>
                
                {bridgeConnected ? (
                  <Button
                    variant="outline"
                    onClick={handleLocalFileSelect}
                    disabled={disabled}
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    Lokale Datei (PC)
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => openModule()}
                    disabled={disabled}
                    className="gap-2"
                  >
                    <WifiOff className="h-4 w-4" />
                    PC-Modul starten
                  </Button>
                )}
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept={getVideoAcceptString()}
                onChange={handleFileInputChange}
                className="hidden"
              />
              
              <p className="mt-4 text-xs text-muted-foreground">
                Unterstützt: MP4, MKV, TS, AVI, MOV, WebM und viele mehr
              </p>
            </div>
          </div>

          {/* Bridge Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
            <div className="flex items-center gap-2 text-sm">
              {bridgeChecking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Prüfe PC-Modul...</span>
                </>
              ) : bridgeConnected ? (
                <>
                  <Wifi className="h-4 w-4 text-green-400" />
                  <span className="text-green-400">PC-Modul verbunden</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">PC-Modul nicht verbunden</span>
                </>
              )}
            </div>
            
            {!bridgeConnected && !bridgeChecking && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={checkConnection}>
                  Prüfen
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <a href={DOWNLOAD_URL} download="ffmpegserver.exe">
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </a>
                </Button>
              </div>
            )}
          </div>

          {/* Info about thresholds */}
          <div className="text-xs text-muted-foreground flex items-start gap-2 px-1">
            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>
              Dateien über {thresholds.localRecommendedGB}GB werden automatisch für lokale Verarbeitung empfohlen. 
              Über {thresholds.browserHardLimitGB}GB ist lokale Verarbeitung erforderlich.
            </span>
          </div>
        </div>
      ) : (
        /* Selected File Display */
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
            <div className="flex items-center gap-3 min-w-0">
              <FileVideo className="h-8 w-8 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-medium truncate">{currentFileName}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {currentFileSize && (
                    <span>{formatFileSize(currentFileSize)}</span>
                  )}
                  {selectedFile && (
                    <Badge variant="outline" className="text-xs">
                      {getFormatDisplayName(selectedFile)}
                    </Badge>
                  )}
                  {selectedLocalPath && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Monitor className="h-3 w-3" />
                      Lokal
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClear}
              disabled={disabled}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Recommendation Alert */}
          {currentRecommendation?.warning && (
            <Alert className="border-amber-500/30 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <AlertDescription className="text-amber-200">
                {currentRecommendation.warning}
                {currentRecommendation.showBridgePrompt && !bridgeConnected && (
                  <div className="mt-2 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openModule()}>
                      <ExternalLink className="h-3 w-3 mr-1" />
                      PC-Modul starten
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={DOWNLOAD_URL} download="ffmpegserver.exe">
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </a>
                    </Button>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Cannot process in browser */}
          {currentRecommendation && !currentRecommendation.canProcessInBrowser && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Diese Datei kann nicht im Browser verarbeitet werden (über 2GB). 
                {bridgeConnected 
                  ? 'Die Verarbeitung erfolgt über das PC-Modul.'
                  : 'Bitte starte das PC-Modul für die Verarbeitung.'}
              </AlertDescription>
            </Alert>
          )}

          {/* Format Warnings */}
          {formatWarnings.length > 0 && (
            <div className="text-xs text-muted-foreground space-y-1 px-1">
              {formatWarnings.map((warning, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}

          {/* Processing Mode Badge */}
          {currentRecommendation && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Verarbeitung:</span>
              {currentRecommendation.mode === 'local' || selectedLocalPath ? (
                <Badge className="gap-1 bg-primary/20 text-primary border-primary/30">
                  <Monitor className="h-3 w-3" />
                  Lokal (PC-Modul)
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <Globe className="h-3 w-3" />
                  Browser
                </Badge>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
