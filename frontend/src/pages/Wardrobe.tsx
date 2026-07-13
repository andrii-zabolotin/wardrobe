import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGarments, detectGarments, deleteGarment } from '../api/garments';
import { useNotifications } from '../ws/NotificationContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Trash2, Loader2, UploadCloud } from 'lucide-react';

const CATEGORIES = ['all', 'top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'];

export default function Wardrobe() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('all');
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploadKey, setUploadKey] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);
  
  const { data: garments, isLoading } = useQuery({ 
    queryKey: ['garments', category], 
    queryFn: () => getGarments(category) 
  });
  
  const { lastEvent } = useNotifications();
  
  useEffect(() => {
    if (lastEvent?.type === 'detection_done' || lastEvent?.type === 'detection_failed') {
      queryClient.invalidateQueries({ queryKey: ['garments'] });
      // Small timeout to ensure garments are fetched before removing skeleton
      setTimeout(() => setIsDetecting(false), 500);
    }
  }, [lastEvent, queryClient]);

  const detectMutation = useMutation({
    mutationFn: (f: File[]) => detectGarments(f),
    onSuccess: () => {
      setFiles(null);
      setUploadKey(prev => prev + 1);
      setIsDetecting(true);
    }
  });

  const delMutation = useMutation({
    mutationFn: deleteGarment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['garments'] })
  });

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!files || files.length === 0) return;
    setIsDetecting(true);
    detectMutation.mutate(Array.from(files));
  };

  const isBusy = detectMutation.isPending || isDetecting;

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
        {isDetecting && (
          <Card className="overflow-hidden flex flex-col items-center justify-center p-6 border-dashed border-2 opacity-50 bg-muted/50">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-sm font-medium text-muted-foreground text-center animate-pulse">AI is analyzing...</p>
          </Card>
        )}
        {isLoading ? (
          <div className="col-span-full flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : garments?.length === 0 && !isDetecting ? (
          <div className="col-span-full text-center p-12 border border-dashed rounded-lg text-muted-foreground">
            No garments found in this category.
          </div>
        ) : garments?.map(garment => (
          <Card key={garment.id} className="overflow-hidden flex flex-col group">
            <div className="aspect-square bg-muted relative p-4 flex items-center justify-center">
              <img src={garment.crop_url} alt={garment.category} className="max-w-full max-h-full object-contain mix-blend-multiply" />
            </div>
            <div className="p-4 bg-card flex flex-col gap-2 mt-auto text-sm border-t">
              <div className="flex items-center justify-between">
                <span className="font-semibold capitalize text-base">{garment.category}</span>
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
    </div>
  );
}
