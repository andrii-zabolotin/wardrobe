import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import type { Render } from '../api/gallery';
import type { Garment } from '../api/garments';
import type { Outfit } from '../api/outfits';
import { Calendar, Image as ImageIcon, Cpu, FileText, Download } from 'lucide-react';

interface RenderPreviewModalProps {
  render: Render;
  open: boolean;
  onClose: () => void;
  garments: Garment[];
  outfits: Outfit[];
  onDownload: (url: string, id: string) => void;
}

export function RenderPreviewModal({ render, open, onClose, garments, outfits, onDownload }: RenderPreviewModalProps) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [fileSize, setFileSize] = useState<string | null>(null);

  const outfit = useMemo(() => {
    return outfits.find(o => o.id === render.outfit_id);
  }, [outfits, render.outfit_id]);

  const usedGarments = useMemo(() => {
    if (!outfit?.garment_ids) return [];
    return outfit.garment_ids.map(id => garments.find(g => g.id === id)).filter((g): g is Garment => !!g);
  }, [outfit, garments]);

  useEffect(() => {
    if (render.result_url && open) {
      const img = new Image();
      img.src = render.result_url;
      img.onload = () => {
        setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      };

      fetch(render.result_url, { method: 'HEAD' })
        .then(res => {
          const len = res.headers.get('Content-Length');
          if (len) {
            const kb = (parseInt(len) / 1024).toFixed(1);
            setFileSize(`${kb} KB`);
          } else {
            setFileSize('Unknown');
          }
        })
        .catch(() => setFileSize('Unknown'));
    }
  }, [render.result_url, open]);

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const fileFormat = useMemo(() => {
    if (!render.result_url) return 'Unknown';
    const parts = render.result_url.split('.');
    return parts[parts.length - 1].toUpperCase();
  }, [render.result_url]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-0 rounded-2xl border-2 border-border/80">
        <DialogHeader className="p-6 pb-2 border-b border-border/40">
          <DialogTitle className="text-2xl" style={{ fontFamily: 'Cormorant, serif' }}>
            {outfit?.name || 'Outfit Render Detail'}
          </DialogTitle>
          <DialogDescription className="capitalize">
            Pose: {outfit?.pose.replace('_', ' ') || 'unknown'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto">
          {/* Left panel: Image Preview */}
          <div className="flex-1 p-6 border-b md:border-b-0 md:border-r border-border/40 flex flex-col justify-center items-center bg-muted/10">
            {render.result_url ? (
              <div className="relative group max-w-full max-h-[50vh] md:max-h-[60vh] rounded-xl overflow-hidden shadow-md">
                <img 
                  src={render.result_url} 
                  alt="Render preview" 
                  className="max-w-full max-h-full object-contain" 
                />
                <button 
                  onClick={() => onDownload(render.result_url!, render.id)}
                  className="absolute bottom-3 right-3 bg-background border border-border rounded-full p-3 shadow-lg hover:bg-primary hover:text-white transition-colors animate-fade-in"
                  title="Download image"
                >
                  <Download className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="text-muted-foreground flex flex-col items-center">
                <ImageIcon className="h-16 w-16 mb-2 opacity-50" />
                <p>No preview image available</p>
              </div>
            )}
          </div>

          {/* Right panel: Details & Used Items */}
          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            {/* Used items list */}
            {usedGarments.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Garments Used</h3>
                <div className="grid grid-cols-4 gap-3">
                  {usedGarments.map(g => (
                    <div key={g.id} className="relative aspect-square bg-muted rounded-xl p-2 flex items-center justify-center border border-border/50 group" title={g.title || g.category}>
                      <img src={g.crop_url} alt={g.category} className="max-w-full max-h-full object-contain mix-blend-multiply" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prompt */}
            {render.prompt_used && (
              <div className="bg-muted/30 p-4 rounded-xl border border-border/40">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Cpu className="h-3.5 w-3.5" /> AI Prompt Used
                </h4>
                <p className="text-xs text-foreground leading-relaxed font-mono whitespace-pre-wrap max-h-24 overflow-y-auto pr-1">
                  {render.prompt_used}
                </p>
              </div>
            )}

            {/* Error Message */}
            {render.status === 'failed' && render.error_message && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-xl border border-destructive/20">
                <h4 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  Error Details
                </h4>
                <p className="text-xs font-mono">{render.error_message}</p>
              </div>
            )}

            {/* Meta Information */}
            <div className="space-y-3 pt-4 border-t border-border/40 text-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-1">Image Information</h3>
              
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Generated At</span>
                </div>
                <div className="font-medium text-right">{formatDateTime(render.created_at)}</div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <ImageIcon className="h-4 w-4" />
                  <span>Resolution</span>
                </div>
                <div className="font-medium text-right">
                  {dimensions.width > 0 ? `${dimensions.width} × ${dimensions.height}` : 'Loading...'}
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>File Size / Type</span>
                </div>
                <div className="font-medium text-right">
                  {fileSize ? `${fileSize} (${fileFormat})` : 'Loading...'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
