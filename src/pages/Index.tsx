import { useState, useCallback } from 'react';
import { FileVideo, Zap, Shield, Sparkles, Download, LayoutGrid, LayoutList, CheckSquare, Edit } from 'lucide-react';
import { FileDropzone } from '@/components/converter/FileDropzone';
import { URLInput } from '@/components/converter/URLInput';
import { ConversionQueueItem } from '@/components/converter/ConversionQueueItem';
import { ConversionHistory } from '@/components/converter/ConversionHistory';
import { MP4Editor } from '@/components/converter/MP4Editor';
import { BatchMP4Editor } from '@/components/converter/BatchMP4Editor';
import { LocalBridge } from '@/components/converter/LocalBridge';
import { OptimizerSettings } from '@/components/converter/OptimizerSettings';
import { GlobalLogWindow, useGlobalLogs } from '@/components/converter/GlobalLogWindow';
import { useConversionQueue } from '@/hooks/useConversionQueue';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import JSZip from 'jszip';

type ViewMode = 'list' | 'grid';

const Index = () => {
  const [mainTab, setMainTab] = useState<'converter' | 'editor'>('converter');
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { logs, clearLogs } = useGlobalLogs();
  const {
    jobs,
    history,
    addJob,
    removeJob,
    setMetadata,
    setAudioOnly,
    startConversion,
    clearHistory,
    ffmpegLoading,
    loadFFmpeg,
    optimizer,
  } = useConversionQueue();

  const handleFileDrop = useCallback(async (files: File[]) => {
    for (const file of files) {
      try {
        const content = await file.text();
        addJob(file.name, content, 'file');
      } catch (error) {
        toast({
          title: 'Error reading file',
          description: `Could not read ${file.name}`,
          variant: 'destructive',
        });
      }
    }
    if (files.length > 0) {
      toast({
        title: files.length === 1 ? 'File added' : 'Files added',
        description: `${files.length} file(s) added to the queue`,
      });
    }
  }, [addJob]);

  const handleUrlSubmit = useCallback((url: string) => {
    const name = url.split('/').pop() || 'stream.m3u8';
    addJob(name, url, 'url');
    toast({
      title: 'URL added',
      description: 'Stream has been added to the queue',
    });
  }, [addJob]);

  const handleStartConversion = useCallback(async (id: string) => {
    if (!ffmpegLoading) {
      try {
        toast({
          title: 'Loading FFmpeg',
          description: 'Preparing the converter engine...',
        });
        await loadFFmpeg();
        toast({
          title: 'FFmpeg ready',
          description: 'Starting conversion...',
        });
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to load FFmpeg. Please refresh and try again.',
          variant: 'destructive',
        });
        return;
      }
    }
    startConversion(id);
  }, [ffmpegLoading, loadFFmpeg, startConversion]);

  const pendingJobs = jobs.filter(j => j.status === 'pending');
  const activeJobs = jobs.filter(j => ['parsing', 'downloading', 'converting'].includes(j.status));
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const errorJobs = jobs.filter(j => j.status === 'error');

  const downloadableJobs = completedJobs.filter(j => j.outputBlob);

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

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(downloadableJobs.map(j => j.id)));
  }, [downloadableJobs]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const downloadSelected = useCallback(async () => {
    const selectedJobs = downloadableJobs.filter(j => selectedIds.has(j.id));
    
    if (selectedJobs.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select at least one file to download',
        variant: 'destructive',
      });
      return;
    }

    if (selectedJobs.length === 1) {
      // Single file - direct download
      const job = selectedJobs[0];
      if (job.outputBlob) {
        const url = URL.createObjectURL(job.outputBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${job.metadata.title || job.name}.${job.audioOnly ? 'mp3' : 'mp4'}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } else {
      // Multiple files - create ZIP
      toast({
        title: 'Creating ZIP',
        description: 'Preparing your download...',
      });

      const zip = new JSZip();
      
      for (const job of selectedJobs) {
        if (job.outputBlob) {
          const filename = `${job.metadata.title || job.name}.${job.audioOnly ? 'mp3' : 'mp4'}`;
          zip.file(filename, job.outputBlob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'converted-files.zip';
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Download started',
        description: `${selectedJobs.length} files packaged as ZIP`,
      });
    }
  }, [downloadableJobs, selectedIds]);

  const downloadAll = useCallback(async () => {
    if (downloadableJobs.length === 0) return;

    if (downloadableJobs.length === 1) {
      const job = downloadableJobs[0];
      if (job.outputBlob) {
        const url = URL.createObjectURL(job.outputBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${job.metadata.title || job.name}.${job.audioOnly ? 'mp3' : 'mp4'}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } else {
      toast({
        title: 'Creating ZIP',
        description: 'Preparing your download...',
      });

      const zip = new JSZip();
      
      for (const job of downloadableJobs) {
        if (job.outputBlob) {
          const filename = `${job.metadata.title || job.name}.${job.audioOnly ? 'mp3' : 'mp4'}`;
          zip.file(filename, job.outputBlob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'all-converted-files.zip';
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Download started',
        description: `${downloadableJobs.length} files packaged as ZIP`,
      });
    }
  }, [downloadableJobs]);

  const allSelectedItems = downloadableJobs.length > 0 && downloadableJobs.every(j => selectedIds.has(j.id));
  const someSelectedItems = selectedIds.size > 0;

  return (
    <div className="min-h-screen">
      {/* Zurück Button zu mankind.lol */}
      <div style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 50 }}>
        <a 
          href="https://mankind.lol" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            textDecoration: 'none', 
            color: '#64748b', 
            fontSize: '0.875rem',
            fontWeight: '500' 
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#F97316'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Zurück
        </a>
      </div>
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        
        <div className="container relative mx-auto px-4 py-12 md:py-20">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm text-primary">WebAssembly Powered</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
              <span className="gradient-text">M3U8 to MP4</span>
              <br />
              <span className="text-foreground">Converter</span>
            </h1>
            
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Convert HLS streams to MP4 or MP3 directly in your browser. 
              No uploads, no servers — everything stays private on your device.
            </p>

            {/* Feature badges */}
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="h-4 w-4 text-primary" />
                <span>100% Private</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Zap className="h-4 w-4 text-primary" />
                <span>Client-side Processing</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileVideo className="h-4 w-4 text-primary" />
                <span>MP4 & MP3 Output</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 pb-16">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Main Tabs: Converter vs Editor */}
          <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'converter' | 'editor')}>
            <TabsList className="glass border-none mb-6">
              <TabsTrigger value="converter" className="data-[state=active]:bg-primary/20 gap-2">
                <FileVideo className="h-4 w-4" />
                M3U8 Converter
              </TabsTrigger>
              <TabsTrigger value="editor" className="data-[state=active]:bg-primary/20 gap-2">
                <Edit className="h-4 w-4" />
                Video Converter
              </TabsTrigger>
            </TabsList>

            <TabsContent value="converter" className="mt-0 space-y-8">
              {/* Input Section */}
              <div className="space-y-4">
                <FileDropzone
                  onFileDrop={handleFileDrop}
                  onUrlSubmit={handleUrlSubmit}
                  isDragging={isDragging}
                  setIsDragging={setIsDragging}
                />
                
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-px bg-border/50" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
                  <div className="flex-1 h-px bg-border/50" />
                </div>
                
                <URLInput onSubmit={handleUrlSubmit} />
                
                {/* Download Optimizer Settings */}
                <OptimizerSettings
                  enabled={optimizer.settings.enabled}
                  concurrency={optimizer.settings.concurrency}
                  minConcurrency={optimizer.MIN_CONCURRENCY}
                  maxConcurrency={optimizer.MAX_CONCURRENCY}
                  stats={optimizer.stats}
                  onEnabledChange={optimizer.setEnabled}
                  onConcurrencyChange={optimizer.setConcurrency}
                />
              </div>

              {/* Queue Tabs */}
              {jobs.length > 0 && (
                <Tabs defaultValue="queue" className="w-full">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <TabsList className="glass border-none">
                      <TabsTrigger value="queue" className="data-[state=active]:bg-primary/20">
                        Queue ({pendingJobs.length + activeJobs.length})
                      </TabsTrigger>
                      <TabsTrigger value="completed" className="data-[state=active]:bg-primary/20">
                        Completed ({completedJobs.length + errorJobs.length})
                      </TabsTrigger>
                    </TabsList>

                    {/* View Toggle */}
                    <div className="flex items-center gap-1 glass rounded-lg p-1">
                      <Button
                        variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setViewMode('list')}
                      >
                        <LayoutList className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setViewMode('grid')}
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <TabsContent value="queue" className="mt-0">
                    {activeJobs.length === 0 && pendingJobs.length === 0 ? (
                      <div className="glass rounded-xl p-8 text-center">
                        <p className="text-muted-foreground">No items in queue</p>
                      </div>
                    ) : (
                      <div className={viewMode === 'grid' 
                        ? 'grid grid-cols-1 md:grid-cols-2 gap-4' 
                        : 'space-y-4'
                      }>
                        {activeJobs.map(job => (
                          <ConversionQueueItem
                            key={job.id}
                            job={job}
                            onStart={() => handleStartConversion(job.id)}
                            onRemove={() => removeJob(job.id)}
                            onMetadataChange={(meta) => setMetadata(job.id, meta)}
                            onAudioOnlyChange={(audioOnly) => setAudioOnly(job.id, audioOnly)}
                            viewMode={viewMode}
                          />
                        ))}
                        {pendingJobs.map(job => (
                          <ConversionQueueItem
                            key={job.id}
                            job={job}
                            onStart={() => handleStartConversion(job.id)}
                            onRemove={() => removeJob(job.id)}
                            onMetadataChange={(meta) => setMetadata(job.id, meta)}
                            onAudioOnlyChange={(audioOnly) => setAudioOnly(job.id, audioOnly)}
                            viewMode={viewMode}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="completed" className="mt-0 space-y-4">
                    {/* Batch download controls */}
                    {downloadableJobs.length > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-3 p-3 glass rounded-lg">
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={allSelectedItems}
                            onCheckedChange={() => allSelectedItems ? deselectAll() : selectAll()}
                            id="select-all"
                          />
                          <label htmlFor="select-all" className="text-sm cursor-pointer">
                            {allSelectedItems ? 'Deselect all' : 'Select all'}
                          </label>
                          {someSelectedItems && (
                            <span className="text-xs text-muted-foreground">
                              ({selectedIds.size} selected)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {someSelectedItems && (
                            <Button 
                              size="sm" 
                              variant="secondary"
                              onClick={downloadSelected}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download Selected
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            onClick={downloadAll}
                            className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download All
                          </Button>
                        </div>
                      </div>
                    )}

                    {completedJobs.length === 0 && errorJobs.length === 0 ? (
                      <div className="glass rounded-xl p-8 text-center">
                        <p className="text-muted-foreground">No completed conversions</p>
                      </div>
                    ) : (
                      <div className={viewMode === 'grid' 
                        ? 'grid grid-cols-1 md:grid-cols-2 gap-4' 
                        : 'space-y-4'
                      }>
                        {[...completedJobs, ...errorJobs].map(job => (
                          <ConversionQueueItem
                            key={job.id}
                            job={job}
                            onStart={() => {}}
                            onRemove={() => removeJob(job.id)}
                            onMetadataChange={(meta) => setMetadata(job.id, meta)}
                            onAudioOnlyChange={(audioOnly) => setAudioOnly(job.id, audioOnly)}
                            viewMode={viewMode}
                            isSelected={selectedIds.has(job.id)}
                            onSelectionChange={() => toggleSelection(job.id)}
                            showCheckbox={job.status === 'completed' && !!job.outputBlob}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}

              {/* History Section */}
              <ConversionHistory history={history} onClear={clearHistory} />
            </TabsContent>

            <TabsContent value="editor" className="mt-0 space-y-6">
              <LocalBridge />
              <MP4Editor />
              <BatchMP4Editor />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-8 pb-20">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Built with FFmpeg.wasm • All processing happens in your browser
          </p>
        </div>
      </footer>

      {/* Global Log Window */}
      <GlobalLogWindow logs={logs} onClear={clearLogs} />
    </div>
  );
};

export default Index;
