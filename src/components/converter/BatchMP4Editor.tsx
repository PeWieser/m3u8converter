import { useState, useCallback } from 'react';
import { Upload, FileVideo, Download, Loader2, Trash2, Play, CheckCircle, AlertCircle, FolderUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { useFFmpegEditor } from '@/hooks/useFFmpegEditor';
import type { ConversionMetadata } from '@/types/converter';
import JSZip from 'jszip';

interface BatchFile {
  id: string;
  file: File;
  metadata: ConversionMetadata;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  outputBlob?: Blob;
  error?: string;
}

export function BatchMP4Editor() {
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  
  const { load, loaded, loading: ffmpegLoading, editMetadata } = useFFmpegEditor();

  const handleFilesSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const mp4Files = selectedFiles.filter(f => f.type.includes('video/mp4') || f.name.endsWith('.mp4'));
    
    if (mp4Files.length === 0) {
      toast({
        title: 'Keine MP4-Dateien',
        description: 'Bitte nur MP4-Dateien auswählen',
        variant: 'destructive',
      });
      return;
    }

    const newFiles: BatchFile[] = mp4Files.map(file => ({
      id: crypto.randomUUID(),
      file,
      metadata: {
        title: file.name.replace(/\.mp4$/i, ''),
        author: '',
      },
      status: 'pending',
      progress: 0,
    }));

    setFiles(prev => [...prev, ...newFiles]);
    toast({
      title: `${mp4Files.length} Dateien hinzugefügt`,
      description: 'Dateien zur Batch-Warteschlange hinzugefügt',
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    const mp4Files = droppedFiles.filter(f => f.type.includes('video/mp4') || f.name.endsWith('.mp4'));
    
    if (mp4Files.length === 0) {
      toast({
        title: 'Keine MP4-Dateien',
        description: 'Bitte nur MP4-Dateien ablegen',
        variant: 'destructive',
      });
      return;
    }

    const newFiles: BatchFile[] = mp4Files.map(file => ({
      id: crypto.randomUUID(),
      file,
      metadata: {
        title: file.name.replace(/\.mp4$/i, ''),
        author: '',
      },
      status: 'pending',
      progress: 0,
    }));

    setFiles(prev => [...prev, ...newFiles]);
    toast({
      title: `${mp4Files.length} Dateien hinzugefügt`,
      description: 'Dateien zur Batch-Warteschlange hinzugefügt',
    });
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
    setSelectedIds(new Set());
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAllCompleted = useCallback(() => {
    const completedIds = files.filter(f => f.status === 'completed' && f.outputBlob).map(f => f.id);
    setSelectedIds(new Set(completedIds));
  }, [files]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const processBatch = useCallback(async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsProcessingBatch(true);

    try {
      if (!loaded) {
        toast({
          title: 'FFmpeg laden...',
          description: 'Bitte warten...',
        });
        await load();
      }

      for (const batchFile of pendingFiles) {
        // Update status to processing
        setFiles(prev => prev.map(f => 
          f.id === batchFile.id ? { ...f, status: 'processing' as const, progress: 0 } : f
        ));

        try {
          const blob = await editMetadata(
            batchFile.file, 
            batchFile.metadata, 
            undefined, // No cover for batch
            (progress) => {
              setFiles(prev => prev.map(f => 
                f.id === batchFile.id ? { ...f, progress } : f
              ));
            }
          );

          setFiles(prev => prev.map(f => 
            f.id === batchFile.id ? { 
              ...f, 
              status: 'completed' as const, 
              progress: 100, 
              outputBlob: blob 
            } : f
          ));
        } catch (error) {
          setFiles(prev => prev.map(f => 
            f.id === batchFile.id ? { 
              ...f, 
              status: 'error' as const, 
              error: error instanceof Error ? error.message : 'Unbekannter Fehler'
            } : f
          ));
        }
      }

      const completedCount = files.filter(f => f.status === 'completed').length + 
        pendingFiles.filter(f => !files.find(bf => bf.id === f.id && bf.status === 'error')).length;
      
      toast({
        title: 'Batch-Verarbeitung abgeschlossen',
        description: `${completedCount} Dateien erfolgreich verarbeitet`,
      });
    } finally {
      setIsProcessingBatch(false);
    }
  }, [files, loaded, load, editMetadata]);

  const downloadSelected = useCallback(async () => {
    const selectedFiles = files.filter(f => selectedIds.has(f.id) && f.outputBlob);
    
    if (selectedFiles.length === 0) {
      toast({
        title: 'Keine Dateien ausgewählt',
        description: 'Bitte wählen Sie mindestens eine Datei aus',
        variant: 'destructive',
      });
      return;
    }

    if (selectedFiles.length === 1) {
      // Single file download
      const file = selectedFiles[0];
      if (file.outputBlob) {
        const url = URL.createObjectURL(file.outputBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${file.metadata.title || file.file.name}.mp4`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } else {
      // ZIP download
      toast({
        title: 'ZIP wird erstellt...',
        description: 'Bitte warten...',
      });

      const zip = new JSZip();
      
      for (const file of selectedFiles) {
        if (file.outputBlob) {
          const filename = `${file.metadata.title || file.file.name}.mp4`;
          zip.file(filename, file.outputBlob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'batch-edited-files.zip';
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Download gestartet',
        description: `${selectedFiles.length} Dateien als ZIP`,
      });
    }
  }, [files, selectedIds]);

  const downloadAll = useCallback(async () => {
    const completedFiles = files.filter(f => f.status === 'completed' && f.outputBlob);
    
    if (completedFiles.length === 0) return;

    if (completedFiles.length === 1) {
      const file = completedFiles[0];
      if (file.outputBlob) {
        const url = URL.createObjectURL(file.outputBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${file.metadata.title || file.file.name}.mp4`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } else {
      toast({
        title: 'ZIP wird erstellt...',
        description: 'Bitte warten...',
      });

      const zip = new JSZip();
      
      for (const file of completedFiles) {
        if (file.outputBlob) {
          const filename = `${file.metadata.title || file.file.name}.mp4`;
          zip.file(filename, file.outputBlob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'all-edited-files.zip';
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Download gestartet',
        description: `${completedFiles.length} Dateien als ZIP`,
      });
    }
  }, [files]);

  const pendingFiles = files.filter(f => f.status === 'pending');
  const processingFiles = files.filter(f => f.status === 'processing');
  const completedFiles = files.filter(f => f.status === 'completed' && f.outputBlob);
  const errorFiles = files.filter(f => f.status === 'error');

  const allSelected = completedFiles.length > 0 && completedFiles.every(f => selectedIds.has(f.id));

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FolderUp className="h-5 w-5 text-primary" />
          Batch-Bearbeitung - Mehrere MP4-Dateien
        </h3>
        
        <label 
          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border/50 rounded-lg cursor-pointer hover:bg-secondary/30 transition-colors"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
          <span className="text-sm text-muted-foreground">Mehrere MP4-Dateien hierher ziehen oder klicken</span>
          <span className="text-xs text-muted-foreground mt-1">(Nur Metadaten, ohne Cover)</span>
          <input
            type="file"
            accept="video/mp4,.mp4"
            multiple
            onChange={handleFilesSelect}
            className="hidden"
          />
        </label>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="glass rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Dateien ({files.length})
            </h3>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearAll}
                disabled={isProcessingBatch}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Alle löschen
              </Button>
              {pendingFiles.length > 0 && (
                <Button 
                  size="sm"
                  onClick={processBatch}
                  disabled={isProcessingBatch}
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
                >
                  {isProcessingBatch ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verarbeite...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Alle verarbeiten ({pendingFiles.length})
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* File Items */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {files.map((file) => (
              <div 
                key={file.id} 
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  file.status === 'completed' ? 'bg-green-500/10' : 
                  file.status === 'error' ? 'bg-destructive/10' : 
                  file.status === 'processing' ? 'bg-primary/10' : 
                  'bg-secondary/30'
                }`}
              >
                {file.status === 'completed' && (
                  <Checkbox
                    checked={selectedIds.has(file.id)}
                    onCheckedChange={() => toggleSelection(file.id)}
                  />
                )}
                
                <div className={`
                  flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
                  ${file.status === 'completed' ? 'bg-green-500/20' : 
                    file.status === 'error' ? 'bg-destructive/20' : 
                    file.status === 'processing' ? 'bg-primary/20' :
                    'bg-secondary/50'}
                `}>
                  {file.status === 'processing' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : file.status === 'completed' ? (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  ) : file.status === 'error' ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <FileVideo className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.file.size / 1024 / 1024).toFixed(2)} MB
                    {file.status === 'processing' && ` • ${file.progress}%`}
                    {file.status === 'error' && ` • ${file.error}`}
                  </p>
                  {file.status === 'processing' && (
                    <Progress value={file.progress} className="h-1 mt-1" />
                  )}
                </div>
                
                {file.status === 'pending' && !isProcessingBatch && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(file.id)}
                    className="flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Download Controls */}
          {completedFiles.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border/30">
              <div className="flex items-center gap-3">
                <Checkbox 
                  checked={allSelected}
                  onCheckedChange={() => allSelected ? deselectAll() : selectAllCompleted()}
                  id="select-all-batch"
                />
                <label htmlFor="select-all-batch" className="text-sm cursor-pointer">
                  {allSelected ? 'Alle abwählen' : 'Alle auswählen'}
                </label>
                {selectedIds.size > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({selectedIds.size} ausgewählt)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <Button 
                    size="sm" 
                    variant="secondary"
                    onClick={downloadSelected}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Ausgewählte herunterladen
                  </Button>
                )}
                <Button 
                  size="sm" 
                  onClick={downloadAll}
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Alle herunterladen ({completedFiles.length})
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>Ausstehend: {pendingFiles.length}</span>
          <span>In Bearbeitung: {processingFiles.length}</span>
          <span className="text-green-400">Fertig: {completedFiles.length}</span>
          {errorFiles.length > 0 && (
            <span className="text-destructive">Fehler: {errorFiles.length}</span>
          )}
        </div>
      )}
    </div>
  );
}