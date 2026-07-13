import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGarments, detectGarments, deleteGarment } from '../api/garments';
import { useNotifications } from '../ws/NotificationContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Trash2, Loader2, UploadCloud, Tag } from 'lucide-react';

const CATEGORIES = ['all', 'top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'];

export default function Wardrobe() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('all');
  const [files, setFiles] = useState<FileList | null>(null);
  
  const { data: garments, isLoading } = useQuery({ 
    queryKey: ['garments', category], 
    queryFn: () => getGarments(category) 
  });
  
  const { lastEvent } = useNotifications();
  
  if (lastEvent?.type === 'detection_done' || lastEvent?.type === 'detection_failed') {
    queryClient.invalidateQueries({ queryKey: ['garments'] });
  }

  const detectMutation = useMutation({
    mutationFn: (f: File[]) => detectGarments(f),
    onSuccess: () => {
      setFiles(null);
    }
  });

  const delMutation = useMutation({
    mutationFn: deleteGarment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['garments'] })
  });

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!files || files.length === 0) return;
    detectMutation.mutate(Array.from(files));
  };

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
                type="file" 
                multiple 
                accept="image/*" 
                onChange={e => setFiles(e.target.files)} 
                disabled={detectMutation.isPending}
              />
            </div>
            <Button type="submit" disabled={detectMutation.isPending || !files || files.length === 0}>
              {detectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              Upload & Detect
            </Button>
          </form>
          {detectMutation.isPending && (
            <p className="text-sm text-muted-foreground mt-2 flex items-center">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing images with Gemini 2.5 Flash... This may take a moment.
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
        {isLoading ? (
          <div className="col-span-full flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : garments?.length === 0 ? (
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
