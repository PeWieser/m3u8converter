import { useState, useCallback } from 'react';
import { FileVideo, Zap, Shield, Sparkles } from 'lucide-react';
import { FileDropzone } from '@/components/converter/FileDropzone';
import { URLInput } from '@/components/converter/URLInput';
import { ConversionQueueItem } from '@/components/converter/ConversionQueueItem';
import { ConversionHistory } from '@/components/converter/ConversionHistory';
import { useConversionQueue } from '@/hooks/useConversionQueue';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';

const Index = () => {
  const [isDragging, setIsDragging] = useState(false);
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
  } = useConversionQueue();

  const handleFileDrop = useCallback(async (file: File) => {
    try {
      const content = await file.text();
      addJob(file.name, content, 'file');
      toast({
        title: 'File added',
        description: `${file.name} has been added to the queue`,
      });
    } catch (error) {
      toast({
        title: 'Error reading file',
        description: 'Could not read the M3U8 file',
        variant: 'destructive',
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
  const completedJobs = jobs.filter(j => j.status === 'completed' || j.status === 'error');

  return (
    <div className="min-h-screen">
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
          </div>

          {/* Queue Tabs */}
          {jobs.length > 0 && (
            <Tabs defaultValue="queue" className="w-full">
              <TabsList className="w-full glass border-none">
                <TabsTrigger value="queue" className="flex-1 data-[state=active]:bg-primary/20">
                  Queue ({pendingJobs.length + activeJobs.length})
                </TabsTrigger>
                <TabsTrigger value="completed" className="flex-1 data-[state=active]:bg-primary/20">
                  Completed ({completedJobs.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="queue" className="mt-4 space-y-4">
                {activeJobs.length === 0 && pendingJobs.length === 0 ? (
                  <div className="glass rounded-xl p-8 text-center">
                    <p className="text-muted-foreground">No items in queue</p>
                  </div>
                ) : (
                  <>
                    {activeJobs.map(job => (
                      <ConversionQueueItem
                        key={job.id}
                        job={job}
                        onStart={() => handleStartConversion(job.id)}
                        onRemove={() => removeJob(job.id)}
                        onMetadataChange={(meta) => setMetadata(job.id, meta)}
                        onAudioOnlyChange={(audioOnly) => setAudioOnly(job.id, audioOnly)}
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
                      />
                    ))}
                  </>
                )}
              </TabsContent>
              
              <TabsContent value="completed" className="mt-4 space-y-4">
                {completedJobs.length === 0 ? (
                  <div className="glass rounded-xl p-8 text-center">
                    <p className="text-muted-foreground">No completed conversions</p>
                  </div>
                ) : (
                  completedJobs.map(job => (
                    <ConversionQueueItem
                      key={job.id}
                      job={job}
                      onStart={() => {}}
                      onRemove={() => removeJob(job.id)}
                      onMetadataChange={(meta) => setMetadata(job.id, meta)}
                      onAudioOnlyChange={(audioOnly) => setAudioOnly(job.id, audioOnly)}
                    />
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}

          {/* History Section */}
          <ConversionHistory history={history} onClear={clearHistory} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Built with FFmpeg.wasm • All processing happens in your browser
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
