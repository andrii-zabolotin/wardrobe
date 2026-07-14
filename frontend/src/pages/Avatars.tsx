import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAvatars, generateAvatar, deleteAvatar, uploadAvatar } from '../api/avatars';
import { useAuthStore } from '../store/authStore';
import { useNotifications } from '../ws/NotificationContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Trash2, Loader2, UploadCloud, CheckCircle2, ImagePlus, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';

export default function Avatars() {
  const queryClient = useQueryClient();
  const { data: avatars, isLoading } = useQuery({ queryKey: ['avatars'], queryFn: getAvatars });
  const [files, setFiles] = useState<FileList | null>(null);
  const [prompt, setPrompt] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  
  const [viewAvatarId, setViewAvatarId] = useState<string | null>(null);
  
  const { lastEvent } = useNotifications();
  
  // Refresh when WS event arrives
  if (lastEvent?.type === 'avatar_ready' || lastEvent?.type === 'avatar_failed' || lastEvent?.type === 'avatar_updated') {
    queryClient.invalidateQueries({ queryKey: ['avatars'] });
  }

  const activeAvatarId = useAuthStore(state => state.activeAvatarId);
  const setActiveAvatarId = useAuthStore(state => state.setActiveAvatarId);

  const genMutation = useMutation({
    mutationFn: (data: { f: File[], p: string, h: string, w: string }) => generateAvatar(data.f, data.p, data.h, data.w),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avatars'] });
      setFiles(null);
      setPrompt('');
      setHeight('');
      setWeight('');
    }
  });

  const delMutation = useMutation({
    mutationFn: deleteAvatar,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['avatars'] })
  });

  const uploadMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avatars'] });
      setUploadFile(null);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    genMutation.mutate({ f: fileArray, p: prompt, h: height, w: weight });
  };

  const handleUploadManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    uploadMutation.mutate(uploadFile);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Avatars</h2>
        <p className="text-muted-foreground">Manage your digital twins for try-on.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="text-lg font-medium">Create AI Avatar</h3>
              <p className="text-sm text-muted-foreground h-10">Generate a photorealistic 3D avatar from 1-5 reference photos.</p>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Height (cm) (Optional)</label>
                  <Input 
                    type="number"
                    placeholder="e.g. 175" 
                    value={height} 
                    onChange={e => setHeight(e.target.value)}
                    disabled={genMutation.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Weight (kg) (Optional)</label>
                  <Input 
                    type="number"
                    placeholder="e.g. 70" 
                    value={weight} 
                    onChange={e => setWeight(e.target.value)}
                    disabled={genMutation.isPending}
                  />
                </div>
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
              <Button type="submit" disabled={genMutation.isPending || !files || files.length === 0} className="w-full">
                {genMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                Generate with AI
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleUploadManual} className="space-y-4">
              <h3 className="text-lg font-medium">Upload Ready Avatar</h3>
              <p className="text-sm text-muted-foreground h-10">Upload an existing photo to use directly without spending AI credits.</p>
              <div className="space-y-2">
                <label className="text-sm font-medium">Avatar Photo (1)</label>
                <Input 
                  type="file" 
                  accept="image/*" 
                  onChange={e => setUploadFile(e.target.files?.[0] || null)} 
                  disabled={uploadMutation.isPending}
                />
              </div>
              <div className="pt-[72px]"></div>
              <Button type="submit" disabled={uploadMutation.isPending || !uploadFile} className="w-full" variant="secondary">
                {uploadMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                Upload Manually
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
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
            <div className="aspect-video bg-muted relative">
              {avatar.status === 'ready' && avatar.canonical_url ? (
                <div 
                  className="w-full h-full relative group cursor-pointer"
                  onClick={() => setViewAvatarId(avatar.id)}
                >
                  <img src={avatar.canonical_url} alt="Avatar" className="w-full h-full object-contain bg-white transition-opacity duration-200 group-hover:opacity-90" />
                  
                  {!avatar.physical_description && (
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 transition-all duration-300">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                      <span className="text-sm font-medium text-center text-foreground shadow-sm">AI is analyzing physical features...</span>
                    </div>
                  )}

                  <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-background/80 backdrop-blur-sm p-1.5 rounded-md text-foreground shadow-sm">
                    <Info className="w-4 h-4" />
                  </div>
                </div>
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
            <div className="p-4 bg-card flex flex-col gap-3 mt-auto border-t">
              {avatar.status === 'ready' && avatar.physical_description && (
                <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-md border border-border/30">
                  <span className="font-semibold text-foreground block mb-0.5">AI Profile:</span>
                  {avatar.physical_description}
                </div>
              )}
              <div className="flex items-center justify-between">
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
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!viewAvatarId} onOpenChange={(open) => !open && setViewAvatarId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Avatar Profile</DialogTitle>
            <DialogDescription>Physical characteristics extracted by AI for outfit generation.</DialogDescription>
          </DialogHeader>
          {(() => {
            const avatar = avatars?.find(a => a.id === viewAvatarId);
            if (!avatar) return null;
            return (
              <div className="space-y-4 pt-2">
                <div className="aspect-square bg-muted rounded-md overflow-hidden relative shadow-inner border">
                  {avatar.canonical_url && (
                    <img src={avatar.canonical_url} className="w-full h-full object-contain bg-white" alt="Avatar full view" />
                  )}
                  {!avatar.physical_description && (
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center p-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                      <p className="text-sm font-medium text-foreground text-center">Extracting description...</p>
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-foreground flex items-center gap-2">
                    <Info className="w-4 h-4 text-muted-foreground" /> 
                    AI Description
                  </h4>
                  {avatar.physical_description ? (
                    <div className="bg-muted p-4 rounded-md text-sm leading-relaxed text-foreground border border-border/50 shadow-sm">
                      {avatar.physical_description}
                    </div>
                  ) : (
                    <div className="bg-muted/50 p-6 rounded-md flex flex-col items-center justify-center text-muted-foreground border border-dashed">
                      <Loader2 className="h-6 w-6 animate-spin mb-2" />
                      <p className="text-sm text-center">Please wait while our fashion AI analyzes the avatar's physical traits.</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
