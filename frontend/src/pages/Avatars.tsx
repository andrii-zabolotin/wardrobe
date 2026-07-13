import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAvatars, generateAvatar, deleteAvatar } from '../api/avatars';
import { useAuthStore } from '../store/authStore';
import { useNotifications } from '../ws/NotificationContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Trash2, Loader2, UploadCloud, CheckCircle2 } from 'lucide-react';

export default function Avatars() {
  const queryClient = useQueryClient();
  const { data: avatars, isLoading } = useQuery({ queryKey: ['avatars'], queryFn: getAvatars });
  const [files, setFiles] = useState<FileList | null>(null);
  const [prompt, setPrompt] = useState('');
  
  const { lastEvent } = useNotifications();
  
  // Refresh when WS event arrives
  if (lastEvent?.type === 'avatar_ready' || lastEvent?.type === 'avatar_failed') {
    queryClient.invalidateQueries({ queryKey: ['avatars'] });
  }

  const activeAvatarId = useAuthStore(state => state.activeAvatarId);
  const setActiveAvatarId = useAuthStore(state => state.setActiveAvatarId);

  const genMutation = useMutation({
    mutationFn: (data: { f: File[], p: string }) => generateAvatar(data.f, data.p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avatars'] });
      setFiles(null);
      setPrompt('');
    }
  });

  const delMutation = useMutation({
    mutationFn: deleteAvatar,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['avatars'] })
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    genMutation.mutate({ f: fileArray, p: prompt });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Avatars</h2>
        <p className="text-muted-foreground">Manage your digital twins for try-on.</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-lg font-medium">Create New Avatar</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Reference Photos (1-5)</label>
                <Input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  onChange={e => setFiles(e.target.files)} 
                  disabled={genMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Custom Instructions (Optional)</label>
                <Input 
                  placeholder="e.g. Keep the glasses on" 
                  value={prompt} 
                  onChange={e => setPrompt(e.target.value)}
                  disabled={genMutation.isPending}
                />
              </div>
            </div>
            <Button type="submit" disabled={genMutation.isPending || !files || files.length === 0}>
              {genMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              Generate Avatar
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading ? (
          <div className="col-span-full flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : avatars?.length === 0 ? (
          <div className="col-span-full text-center p-12 border border-dashed rounded-lg text-muted-foreground">
            No avatars found. Create one above!
          </div>
        ) : avatars?.map(avatar => (
          <Card key={avatar.id} className={`overflow-hidden flex flex-col relative transition-all ${activeAvatarId === avatar.id ? 'ring-2 ring-primary' : ''}`}>
            {activeAvatarId === avatar.id && (
              <div className="absolute top-2 left-2 z-10 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1 font-medium shadow-sm">
                <CheckCircle2 className="h-3 w-3" /> Active
              </div>
            )}
            <div className="aspect-[3/4] bg-muted relative">
              {avatar.status === 'ready' && avatar.canonical_url ? (
                <img src={avatar.canonical_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full w-full bg-muted/50">
                  {avatar.status === 'processing' || avatar.status === 'pending' ? (
                    <div className="flex flex-col items-center text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin mb-2" />
                      <span className="text-sm font-medium">Generating...</span>
                    </div>
                  ) : (
                    <span className="text-sm text-destructive font-medium bg-destructive/10 px-3 py-1 rounded-full">Failed</span>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 bg-card flex items-center justify-between mt-auto">
              <Button 
                variant={activeAvatarId === avatar.id ? "secondary" : "outline"}
                size="sm"
                onClick={() => setActiveAvatarId(avatar.id)}
                disabled={avatar.status !== 'ready'}
              >
                {activeAvatarId === avatar.id ? 'Selected' : 'Select for Try-On'}
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => delMutation.mutate(avatar.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
