import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOutfits, createOutfit, deleteOutfit, triggerRender } from '../api/outfits';
import { getGarments } from '../api/garments';
import { useAuthStore } from '../store/authStore';
import { useNotifications } from '../ws/NotificationContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Trash2, Plus, Loader2, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function OutfitBoard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeAvatarId = useAuthStore(state => state.activeAvatarId);
  const { lastEvent } = useNotifications();

  const { data: garments } = useQuery({ queryKey: ['garments', 'all'], queryFn: () => getGarments('all') });
  const { data: outfits, isLoading } = useQuery({ queryKey: ['outfits'], queryFn: getOutfits });

  const [selectedGarments, setSelectedGarments] = useState<string[]>([]);
  const [pose, setPose] = useState('studio_front');

  if (lastEvent?.type === 'render_done' || lastEvent?.type === 'render_failed') {
    // Note: Render progress might be tracked in gallery/renders page, but we show a toast or something ideally
  }

  const createMutation = useMutation({
    mutationFn: () => createOutfit(activeAvatarId!, selectedGarments, pose),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      setSelectedGarments([]);
    }
  });

  const renderMutation = useMutation({
    mutationFn: triggerRender,
    onSuccess: () => navigate('/gallery') // Redirect to gallery to see processing render
  });

  const delMutation = useMutation({
    mutationFn: deleteOutfit,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['outfits'] })
  });

  const toggleGarment = (id: string) => {
    setSelectedGarments(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Outfit Board</h2>
        <p className="text-muted-foreground">Mix and match garments to create outfits and render them on your avatar.</p>
      </div>

      {!activeAvatarId && (
        <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg flex items-center justify-between">
          <p className="font-medium">You need to select an active avatar before creating outfits.</p>
          <Button variant="outline" className="border-destructive/30 hover:bg-destructive/10" onClick={() => navigate('/avatars')}>Go to Avatars</Button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Select Garments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-4">
                {garments?.map(garment => {
                  const isSelected = selectedGarments.includes(garment.id);
                  return (
                    <div 
                      key={garment.id} 
                      onClick={() => toggleGarment(garment.id)}
                      className={`cursor-pointer aspect-square bg-muted relative p-2 flex items-center justify-center rounded-lg border-2 transition-all ${isSelected ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-transparent hover:border-border'}`}
                    >
                      <img src={garment.crop_url} alt={garment.category} className="max-w-full max-h-full object-contain mix-blend-multiply" />
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                          <CheckIcon className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Compose Outfit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Pose</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={pose}
                  onChange={e => setPose(e.target.value)}
                >
                  <option value="studio_front">Studio Front</option>
                  <option value="studio_3q">Studio 3/4</option>
                  <option value="studio_casual">Studio Casual</option>
                  <option value="outdoor_walk">Outdoor Walk</option>
                  <option value="seated">Seated</option>
                </select>
              </div>
              
              <div className="p-4 bg-muted rounded-lg text-center">
                <span className="text-2xl font-bold">{selectedGarments.length}</span>
                <p className="text-xs text-muted-foreground uppercase font-semibold mt-1">Items Selected</p>
              </div>

              <Button 
                className="w-full" 
                size="lg" 
                onClick={() => createMutation.mutate()} 
                disabled={!activeAvatarId || selectedGarments.length === 0 || createMutation.isPending}
              >
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Save Outfit
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-4 mt-12">
        <h3 className="text-xl font-bold">Saved Outfits</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isLoading ? (
            <div className="col-span-full flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : outfits?.map(outfit => (
            <Card key={outfit.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex justify-between items-center">
                  <span className="truncate">{outfit.name || 'Unnamed Outfit'}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => delMutation.mutate(outfit.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </CardTitle>
                <div className="text-xs text-muted-foreground capitalize">{outfit.pose.replace('_', ' ')}</div>
              </CardHeader>
              <CardContent className="mt-auto pt-4">
                <Button 
                  className="w-full" 
                  variant="secondary"
                  disabled={renderMutation.isPending}
                  onClick={() => renderMutation.mutate(outfit.id)}
                >
                  <Play className="mr-2 h-4 w-4" /> Try On (Render)
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
