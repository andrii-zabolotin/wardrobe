import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRenders, toggleSaveRender, deleteRender } from '../api/gallery';
import { getGarments } from '../api/garments';
import { getOutfits } from '../api/outfits';
import { useNotifications } from '../ws/NotificationContext';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Trash2, Loader2, Bookmark, BookmarkCheck, Download } from 'lucide-react';
import { RenderPreviewModal } from '../components/RenderPreviewModal';
import type { Render } from '../api/gallery';

export default function Gallery() {
  const queryClient = useQueryClient();
  const { lastEvent } = useNotifications();
  const [selectedRender, setSelectedRender] = useState<Render | null>(null);

  const { data: renders, isLoading } = useQuery({ queryKey: ['renders'], queryFn: () => getRenders() });
  const { data: garments = [] } = useQuery({ queryKey: ['garments', 'all'], queryFn: () => getGarments('all') });
  const { data: outfits = [] } = useQuery({ queryKey: ['outfits'], queryFn: getOutfits });

  if (lastEvent?.type === 'render_done' || lastEvent?.type === 'render_failed') {
    queryClient.invalidateQueries({ queryKey: ['renders'] });
  }

  const toggleSaveMutation = useMutation({
    mutationFn: toggleSaveRender,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['renders'] })
  });

  const delMutation = useMutation({
    mutationFn: deleteRender,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['renders'] });
      if (selectedRender) setSelectedRender(null);
    }
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      if (!renders) return;
      const promises = renders.map(r => deleteRender(r.id));
      await Promise.all(promises);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['renders'] })
  });

  const handleClearAll = () => {
    if (!renders || renders.length === 0) return;
    if (confirm('Are you sure you want to delete all renders? This action cannot be undone.')) {
      clearAllMutation.mutate();
    }
  };

  const handleDownload = async (url: string, id: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `render-${id}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Renders & Gallery</h2>
          <p className="text-muted-foreground">Your try-on history and saved looks.</p>
        </div>
        {renders && renders.length > 0 && (
          <Button 
            variant="destructive" 
            onClick={handleClearAll}
            disabled={clearAllMutation.isPending}
            className="rounded-xl h-11 px-6 shadow-sm font-medium"
          >
            {clearAllMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Clear Gallery
          </Button>
        )}
      </div>

      <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
        {isLoading ? (
          <div className="col-span-full flex justify-center p-12 w-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : renders?.length === 0 ? (
          <div className="col-span-full text-center p-12 border border-dashed rounded-lg text-muted-foreground w-full">
            No renders yet. Create an outfit and try it on!
          </div>
        ) : renders?.map(render => (
          <Card 
            key={render.id} 
            className="overflow-hidden break-inside-avoid relative group border-2 border-border/40 rounded-2xl shadow-sm bg-card transition-all duration-200 cursor-pointer"
            onClick={() => render.status === 'done' && setSelectedRender(render)}
          >
            {render.status === 'dev_mock' ? (
              <div className="relative aspect-[3/4] bg-neutral-900 border border-neutral-800 flex flex-col items-center justify-center p-6 text-center text-neutral-400">
                <span className="font-mono text-sm mb-2 text-red-500/70 font-semibold tracking-wider">DEV MODE</span>
                <span className="text-xs opacity-80">Mock Render<br/>(check logs)</span>
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button 
                    variant="destructive" 
                    size="icon" 
                    className="rounded-full h-12 w-12"
                    onClick={(e) => { e.stopPropagation(); delMutation.mutate(render.id); }}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            ) : render.status === 'done' && render.result_url ? (
              <>
                <img src={render.result_url} alt="Render" className="w-full object-cover block" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <Button 
                    variant={render.is_saved ? 'default' : 'secondary'} 
                    size="icon" 
                    className="rounded-full h-12 w-12"
                    onClick={(e) => { e.stopPropagation(); toggleSaveMutation.mutate(render.id); }}
                    title={render.is_saved ? "Remove from Saved" : "Save Look"}
                  >
                    {render.is_saved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="rounded-full h-12 w-12"
                    onClick={(e) => { e.stopPropagation(); handleDownload(render.result_url!, render.id); }}
                    title="Download Render"
                  >
                    <Download className="h-5 w-5" />
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="icon" 
                    className="rounded-full h-12 w-12"
                    onClick={(e) => { e.stopPropagation(); delMutation.mutate(render.id); }}
                    title="Delete Render"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
                {render.is_saved && (
                  <div className="absolute top-3 left-3 bg-primary text-primary-foreground p-1.5 rounded-full shadow-md">
                    <BookmarkCheck className="h-4 w-4" />
                  </div>
                )}
              </>
            ) : (
              <div className="relative aspect-[3/4] bg-muted/40 flex items-center justify-center p-6 text-center">
                {render.status === 'processing' || render.status === 'pending' ? (
                  <div className="flex flex-col items-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Generating Photorealistic Render...</span>
                    <span className="text-xs mt-2 opacity-70">This takes about 10-20 seconds with Gemini 3.1</span>
                  </div>
                ) : (
                  <div className="text-destructive font-medium flex flex-col items-center">
                    <span className="bg-destructive/10 px-3 py-1 rounded-full mb-2">Failed</span>
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); delMutation.mutate(render.id); }}>Remove</Button>
                  </div>
                )}
                {(render.status === 'processing' || render.status === 'pending') && (
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      className="rounded-full h-12 w-12"
                      onClick={(e) => { e.stopPropagation(); delMutation.mutate(render.id); }}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      {selectedRender && (
        <RenderPreviewModal
          render={selectedRender}
          open={!!selectedRender}
          onClose={() => setSelectedRender(null)}
          garments={garments}
          outfits={outfits}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}
