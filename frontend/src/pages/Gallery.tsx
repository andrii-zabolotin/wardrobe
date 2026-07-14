import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRenders, toggleSaveRender, deleteRender } from '../api/gallery';
import { useNotifications } from '../ws/NotificationContext';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Trash2, Loader2, Bookmark, BookmarkCheck } from 'lucide-react';

export default function Gallery() {
  const queryClient = useQueryClient();
  const { lastEvent } = useNotifications();

  const { data: renders, isLoading } = useQuery({ queryKey: ['renders'], queryFn: getRenders });

  if (lastEvent?.type === 'render_done' || lastEvent?.type === 'render_failed') {
    queryClient.invalidateQueries({ queryKey: ['renders'] });
  }

  const toggleSaveMutation = useMutation({
    mutationFn: toggleSaveRender,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['renders'] })
  });

  const delMutation = useMutation({
    mutationFn: deleteRender,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['renders'] })
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Renders & Gallery</h2>
        <p className="text-muted-foreground">Your try-on history and saved looks.</p>
      </div>

      <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
        {isLoading ? (
          <div className="col-span-full flex justify-center p-12 w-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : renders?.length === 0 ? (
          <div className="col-span-full text-center p-12 border border-dashed rounded-lg text-muted-foreground w-full">
            No renders yet. Create an outfit and try it on!
          </div>
        ) : renders?.map(render => (
          <Card key={render.id} className="overflow-hidden break-inside-avoid relative group">
            {render.status === 'dev_mock' ? (
              <div className="aspect-[3/4] bg-neutral-900 border border-neutral-700 flex flex-col items-center justify-center p-6 text-center text-neutral-500">
                <span className="font-mono text-sm mb-2 text-red-500/70">DEV MODE</span>
                <span className="text-xs">Mock Render<br/>(check logs)</span>
              </div>
            ) : render.status === 'done' && render.result_url ? (
              <>
                <img src={render.result_url} alt="Render" className="w-full object-cover block" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <Button 
                    variant={render.is_saved ? 'default' : 'secondary'} 
                    size="icon" 
                    className="rounded-full h-12 w-12"
                    onClick={() => toggleSaveMutation.mutate(render.id)}
                  >
                    {render.is_saved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="icon" 
                    className="rounded-full h-12 w-12"
                    onClick={() => delMutation.mutate(render.id)}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
                {render.is_saved && (
                  <div className="absolute top-3 left-3 bg-primary text-primary-foreground p-1.5 rounded-full shadow-sm">
                    <BookmarkCheck className="h-4 w-4" />
                  </div>
                )}
              </>
            ) : (
              <div className="aspect-[3/4] bg-muted flex items-center justify-center p-6 text-center">
                {render.status === 'processing' || render.status === 'pending' ? (
                  <div className="flex flex-col items-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
                    <span className="text-sm font-medium">Generating Photorealistic Render...</span>
                    <span className="text-xs mt-2 opacity-70">This takes about 10-20 seconds with Gemini 3.1</span>
                  </div>
                ) : (
                  <div className="text-destructive font-medium flex flex-col items-center">
                    <span className="bg-destructive/10 px-3 py-1 rounded-full mb-2">Failed</span>
                    <Button variant="outline" size="sm" onClick={() => delMutation.mutate(render.id)}>Remove</Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
