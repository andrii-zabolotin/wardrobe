import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGarments, detectGarments, deleteGarment } from '../api/garments';
import { useNotifications } from '../ws/NotificationContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Trash2, Loader2, UploadCloud } from 'lucide-react';
import type { Garment } from '../api/garments';
import { GarmentPreviewModal } from '../components/GarmentPreviewModal';

const CATEGORIES = ['all', 'top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'];

type DetectionState = {
  phase: 'idle' | 'uploading' | 'analyzing' | 'cropping' | 'saving' | 'done' | 'error';
  label?: string;
  imageIndex?: number;
  totalImages?: number;
  itemsAdded?: number;
  error?: string;
};

export default function Wardrobe() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('all');
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploadKey, setUploadKey] = useState(0);
  const [detectState, setDetectState] = useState<DetectionState>({ phase: 'idle' });
  const [totalAdded, setTotalAdded] = useState(0);
  const [selectedGarment, setSelectedGarment] = useState<Garment | null>(null);
  
  const { data: garments, isLoading } = useQuery({ 
    queryKey: ['garments', category], 
    queryFn: () => getGarments(category) 
  });
  
  const { lastEvent } = useNotifications();
  
  useEffect(() => {
    if (!lastEvent) return;
    
    if (lastEvent.type === 'detection_progress') {
      setDetectState({
        phase: lastEvent.data.step,
        label: lastEvent.data.label,
        imageIndex: lastEvent.data.image_index,
        totalImages: lastEvent.data.total_images
      });
    } else if (lastEvent.type === 'detection_done') {
      setTotalAdded(prev => prev + (lastEvent.data.garments_added || 0));
      const isLast = lastEvent.data.image_index === lastEvent.data.total_images;
      if (isLast || !lastEvent.data.total_images) {
        queryClient.invalidateQueries({ queryKey: ['garments'] });
        setDetectState(prev => ({
          phase: 'done',
          itemsAdded: prev.itemsAdded ? prev.itemsAdded + (lastEvent.data.garments_added || 0) : (lastEvent.data.garments_added || 0),
          imageIndex: lastEvent.data.image_index,
          totalImages: lastEvent.data.total_images
        }));
        
        // Auto-dismiss after 2 seconds
        setTimeout(() => {
          setDetectState({ phase: 'idle' });
          setTotalAdded(0);
        }, 2000);
      }
    } else if (lastEvent.type === 'detection_failed') {
      setDetectState({ phase: 'error', error: lastEvent.data.error || 'Detection failed' });
    }
  }, [lastEvent, queryClient]);

  const detectMutation = useMutation({
    mutationFn: (f: File[]) => detectGarments(f),
    onSuccess: () => {
      setFiles(null);
      setUploadKey(prev => prev + 1);
      setDetectState({ phase: 'analyzing', label: 'AI is analyzing garments…' });
    },
    onError: (err) => {
      setDetectState({ phase: 'error', error: err instanceof Error ? err.message : 'Upload failed' });
    }
  });

  const delMutation = useMutation({
    mutationFn: deleteGarment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['garments'] })
  });

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!files || files.length === 0) return;
    setTotalAdded(0);
    setDetectState({ phase: 'uploading', label: 'Uploading photos…' });
    detectMutation.mutate(Array.from(files));
  };

  const isBusy = detectMutation.isPending || (detectState.phase !== 'idle' && detectState.phase !== 'error' && detectState.phase !== 'done');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Wardrobe</h2>
        <p className="text-muted-foreground">Manage your clothes and accessories.</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleUpload} className="flex gap-4 items-end">
            <div className="space-y-2 flex-1 max-w-md">
              <label className="text-sm font-medium">Add New Photos (Bulk upload supported)</label>
              <Input 
                key={uploadKey}
                type="file" 
                multiple 
                accept="image/*" 
                onChange={e => setFiles(e.target.files)} 
                disabled={isBusy}
              />
            </div>
            <Button type="submit" disabled={isBusy || !files || files.length === 0}>
              <UploadCloud className="mr-2 h-4 w-4" />
              Upload & Detect
            </Button>
          </form>
          {detectMutation.isError && (
            <p className="text-sm text-red-500 mt-2">
              Upload failed: {detectMutation.error instanceof Error ? detectMutation.error.message : 'Unknown error'}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map(c => (
          <Button 
            key={c} 
            variant={category === c ? 'default' : 'outline'}
            className="capitalize rounded-full px-6"
            onClick={() => setCategory(c)}
          >
            {c}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {detectState.phase !== 'idle' && (
          <Card className="col-span-full overflow-hidden p-6 border-dashed border-2 bg-muted/30">
            <div className="flex flex-col gap-4 max-w-lg mx-auto">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  {detectState.phase === 'done' ? (
                    <span className="text-green-500 flex items-center gap-2">🎉 Detection Complete</span>
                  ) : detectState.phase === 'error' ? (
                    <span className="text-red-500 flex items-center gap-2">❌ Detection Failed</span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      Processing Wardrobe
                    </span>
                  )}
                </h3>
                {detectState.totalImages && detectState.totalImages > 1 && (
                  <span className="text-sm font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
                    Photo {detectState.imageIndex || 1} of {detectState.totalImages}
                  </span>
                )}
              </div>
              
              {detectState.phase === 'error' ? (
                <p className="text-sm text-red-500">{detectState.error}</p>
              ) : detectState.phase === 'done' ? (
                <p className="text-sm text-muted-foreground">
                  Successfully added {totalAdded} items to your wardrobe.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <span className={detectState.phase === 'uploading' ? "text-primary font-medium" : "text-muted-foreground"}>
                      {detectState.phase === 'uploading' ? "Uploading photos…" : "✓ Photos uploaded"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    {detectState.phase === 'analyzing' || detectState.phase === 'uploading' ? (
                      <span className={detectState.phase === 'analyzing' ? "text-primary font-medium animate-pulse" : "text-muted-foreground opacity-50"}>
                        {detectState.label || "AI is analyzing garments…"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">✓ AI analysis complete</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    {detectState.phase === 'cropping' ? (
                      <span className="text-primary font-medium animate-pulse">
                        {detectState.label || "Cropping detected items…"}
                      </span>
                    ) : detectState.phase === 'saving' ? (
                      <span className="text-muted-foreground">✓ Items cropped</span>
                    ) : (
                      <span className="text-muted-foreground opacity-50">Cropping detected items…</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    {detectState.phase === 'saving' ? (
                      <span className="text-primary font-medium animate-pulse">
                        {detectState.label || "Saving & categorizing…"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground opacity-50">Saving & categorizing…</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}
        {isLoading ? (
          <div className="col-span-full flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : garments?.length === 0 && detectState.phase === 'idle' ? (
          <div className="col-span-full text-center p-12 border border-dashed rounded-lg text-muted-foreground">
            No garments found in this category.
          </div>
        ) : garments?.map(garment => (
          <Card key={garment.id} className="overflow-hidden flex flex-col group cursor-pointer" onClick={() => setSelectedGarment(garment)}>
            <div className="aspect-square bg-muted relative p-4 flex items-center justify-center">
              <img src={garment.crop_url} alt={garment.category} className="max-w-full max-h-full object-contain mix-blend-multiply" />
            </div>
            <div className="p-4 bg-card flex flex-col gap-2 mt-auto text-sm border-t relative z-10" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <span className="font-semibold capitalize text-base">{garment.title || garment.category}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => delMutation.mutate(garment.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-muted-foreground capitalize flex flex-wrap gap-1">
                <span className="bg-muted px-2 py-0.5 rounded text-xs">{garment.attributes.color}</span>
                <span className="bg-muted px-2 py-0.5 rounded text-xs">{garment.attributes.fit}</span>
                <span className="bg-muted px-2 py-0.5 rounded text-xs">{garment.style_attributes.formality}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {selectedGarment && (
        <GarmentPreviewModal
          garment={selectedGarment}
          open={!!selectedGarment}
          onClose={() => setSelectedGarment(null)}
        />
      )}
    </div>
  );
}
