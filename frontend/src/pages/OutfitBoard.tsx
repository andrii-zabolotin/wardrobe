import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOutfits, createOutfit, deleteOutfit, triggerRender } from '../api/outfits';
import { getGarments } from '../api/garments';
import { useAuthStore } from '../store/authStore';
import { useNotifications } from '../ws/NotificationContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Trash2, Loader2, Play, Search, X, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = ['all', 'top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'];

export default function OutfitBoard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeAvatarId = useAuthStore(state => state.activeAvatarId);
  const { lastEvent } = useNotifications();

  const { data: garments } = useQuery({ queryKey: ['garments', 'all'], queryFn: () => getGarments('all') });
  const { data: outfits, isLoading } = useQuery({ queryKey: ['outfits'], queryFn: getOutfits });

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [colorFilter, setColorFilter] = useState('all');
  const [seasonFilter, setSeasonFilter] = useState('all');
  const [selectedGarments, setSelectedGarments] = useState<string[]>([]);
  const [pose, setPose] = useState('studio_front');

  if (lastEvent?.type === 'render_done' || lastEvent?.type === 'render_failed') {
    // Progress tracked elsewhere ideally
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
    onSuccess: () => navigate('/gallery')
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

  const removeGarment = (id: string) => {
    setSelectedGarments(prev => prev.filter(x => x !== id));
  };

  const uniqueColors = useMemo(() => {
    if (!garments) return [];
    return Array.from(new Set(garments.map(g => g.attributes?.color).filter(Boolean))).sort();
  }, [garments]);

  const uniqueSeasons = useMemo(() => {
    if (!garments) return [];
    const seasons = new Set<string>();
    garments.forEach(g => {
      if (g.style_attributes?.season_suitability) {
        g.style_attributes.season_suitability.forEach(s => seasons.add(s));
      }
    });
    return Array.from(seasons).sort();
  }, [garments]);

  const filteredGarments = useMemo(() => {
    return (garments ?? []).filter(g => {
      const matchSearch = !search || 
        g.title?.toLowerCase().includes(search.toLowerCase()) ||
        g.category.toLowerCase().includes(search.toLowerCase()) ||
        g.attributes?.color?.toLowerCase().includes(search.toLowerCase());
      const matchCategory = category === 'all' || g.category === category;
      const matchColor = colorFilter === 'all' || g.attributes?.color === colorFilter;
      const matchSeason = seasonFilter === 'all' || 
        (g.style_attributes?.season_suitability || []).includes(seasonFilter);
      return matchSearch && matchCategory && matchColor && matchSeason;
    });
  }, [garments, search, category, colorFilter, seasonFilter]);

  const selectedItemsData = useMemo(() => {
    return selectedGarments.map(id => garments?.find(g => g.id === id)).filter(Boolean);
  }, [selectedGarments, garments]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    selectedItemsData.forEach(item => {
      if (item) {
        counts[item.category] = (counts[item.category] || 0) + 1;
      }
    });
    return Object.entries(counts);
  }, [selectedItemsData]);

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-[1fr_380px] gap-8 pb-12 min-h-[calc(100vh-8rem)]">
      {/* Left Panel: Wardrobe Picker */}
      <div className="space-y-6 flex flex-col min-h-0">
        <div>
          <h2 className="text-5xl font-bold tracking-tight">Outfit Board</h2>
          <p className="text-muted-foreground mt-2 text-lg">Curate your look with minimal effort. Maximize impact.</p>
        </div>

        {!activeAvatarId && (
          <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="font-medium">Active avatar required before creating outfits.</p>
            <Button variant="outline" className="border-destructive/30 hover:bg-destructive/10 min-w-[140px]" onClick={() => navigate('/avatars')}>Go to Avatars</Button>
          </div>
        )}

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input 
              className="pl-10 h-12 rounded-xl border-2 border-border focus-visible:ring-primary text-base" 
              placeholder="Search by name, category, or color..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIES.map(c => (
              <Button 
                key={c} 
                variant={category === c ? 'default' : 'outline'}
                className="capitalize rounded-full px-6 min-w-[44px] h-11"
                onClick={() => setCategory(c)}
              >
                {c}
              </Button>
            ))}
          </div>

          <div className="flex gap-4 flex-wrap">
            <select 
              className="h-11 rounded-full border-2 border-border bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-w-[120px]"
              value={colorFilter}
              onChange={e => setColorFilter(e.target.value)}
            >
              <option value="all">All Colors</option>
              {uniqueColors.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
            </select>

            <select 
              className="h-11 rounded-full border-2 border-border bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-w-[120px]"
              value={seasonFilter}
              onChange={e => setSeasonFilter(e.target.value)}
            >
              <option value="all">All Seasons</option>
              {uniqueSeasons.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
          </div>
        </div>

        <div className="flex-grow min-h-0">
          {filteredGarments.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-2xl text-muted-foreground">
              <p className="text-lg font-medium text-foreground">No garments match your filters</p>
              <p className="mt-1">Try clearing the search or filters to see more items.</p>
              <Button variant="link" onClick={() => { setSearch(''); setCategory('all'); setColorFilter('all'); setSeasonFilter('all'); }} className="mt-4">
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pb-4">
              {filteredGarments.map(garment => {
                const isSelected = selectedGarments.includes(garment.id);
                return (
                  <div 
                    key={garment.id} 
                    onClick={() => toggleGarment(garment.id)}
                    className={`group cursor-pointer aspect-square relative p-4 flex items-center justify-center rounded-2xl border-2 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]
                      ${isSelected 
                        ? 'border-primary bg-primary/5 ring-4 ring-primary/10' 
                        : 'border-transparent bg-muted hover:border-border hover:scale-[1.02]'
                      }`}
                  >
                    <img src={garment.crop_url} alt={garment.category} className="max-w-full max-h-full object-contain mix-blend-multiply transition-opacity duration-200" style={{ opacity: isSelected ? 0.8 : 1 }} />
                    {isSelected && (
                      <div className="absolute top-3 right-3 bg-primary text-primary-foreground rounded-full p-1.5 shadow-md">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Outfit Board (Sticky) */}
      <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] overflow-y-auto space-y-6 flex flex-col">
        <Card className="rounded-2xl border-2 border-border shadow-sm overflow-hidden flex-shrink-0">
          <CardHeader className="bg-muted/30 pb-4 border-b border-border">
            <CardTitle className="text-xl">Selected Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-5">
              <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin">
                {selectedItemsData.length === 0 ? (
                  <div className="w-full py-8 border-2 border-dashed border-border rounded-xl text-center text-sm text-muted-foreground">
                    Click items on the left to add them to your outfit.
                  </div>
                ) : (
                  selectedItemsData.map((item) => (
                    item && (
                      <div key={item.id} className="relative flex-shrink-0 w-20 h-20 bg-muted rounded-xl p-2 group flex items-center justify-center border border-border/50">
                        <img src={item.crop_url} alt={item.category} className="max-w-full max-h-full object-contain mix-blend-multiply" />
                        <button 
                          onClick={() => removeGarment(item.id)}
                          className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity min-w-[32px] min-h-[32px] flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
                          aria-label="Remove item"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )
                  ))
                )}
              </div>
              
              {categoryCounts.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                  {categoryCounts.map(([cat, count]) => (
                    <span key={cat} className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {cat} &times;{count}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-5 bg-muted/20 border-t border-border space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pose</label>
                <select 
                  className="flex h-12 w-full rounded-xl border-2 border-border bg-background px-4 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-shadow"
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

              <Button 
                className="w-full h-12 rounded-xl text-base font-medium shadow-sm transition-all duration-200" 
                size="lg" 
                onClick={() => createMutation.mutate()} 
                disabled={!activeAvatarId || selectedGarments.length === 0 || createMutation.isPending}
              >
                {createMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Save Outfit
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 flex-1">
          <h3 className="text-2xl font-bold tracking-tight">Saved Outfits</h3>
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : outfits?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No saved outfits yet.</p>
            ) : outfits?.map(outfit => (
              <Card key={outfit.id} className="flex flex-col rounded-xl border-2 border-border group overflow-hidden">
                <div className="p-4 flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold truncate pr-4 text-lg">{outfit.name || 'Unnamed Outfit'}</h4>
                    <span className="inline-block mt-1 text-xs font-medium bg-muted px-2 py-0.5 rounded-md capitalize tracking-wide text-muted-foreground border border-border/50">
                      {outfit.pose.replace('_', ' ')}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity -mr-2 -mt-2" onClick={() => delMutation.mutate(outfit.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="px-4 pb-4 pt-0">
                  <Button 
                    className="w-full rounded-lg bg-secondary hover:bg-secondary/90 text-secondary-foreground transition-all duration-200" 
                    variant="secondary"
                    disabled={renderMutation.isPending}
                    onClick={() => renderMutation.mutate(outfit.id)}
                  >
                    <Play className="mr-2 h-4 w-4" /> Try On (Render)
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
