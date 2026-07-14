import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import type { Garment } from '../api/garments';

interface GarmentPreviewModalProps {
  garment: Garment;
  open: boolean;
  onClose: () => void;
}

export function GarmentPreviewModal({ garment, open, onClose }: GarmentPreviewModalProps) {
  const [hoverOriginal, setHoverOriginal] = useState(false);
  
  const formatTag = (tag: string) => tag ? tag.replace(/_/g, ' ') : '';

  // bounding_box is [ymin, xmin, ymax, xmax]
  const hasBbox = garment.bounding_box && garment.bounding_box.length === 4;
  let [ymin, xmin, ymax, xmax] = hasBbox ? garment.bounding_box! : [0, 0, 1, 1];

  if (Math.max(ymin, xmin, ymax, xmax) > 1.0) {
    ymin /= 1000.0;
    xmin /= 1000.0;
    ymax /= 1000.0;
    xmax /= 1000.0;
  }
  
  const topPercent = `${ymin * 100}%`;
  const leftPercent = `${xmin * 100}%`;
  const widthPercent = `${(xmax - xmin) * 100}%`;
  const heightPercent = `${(ymax - ymin) * 100}%`;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="capitalize text-xl">{garment.title || garment.category}</DialogTitle>
          <DialogDescription className="capitalize">
            {garment.category}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto">
          {/* Left panel: Original Image with Bbox */}
          {garment.source_image_url ? (
            <div className="flex-1 p-6 pt-2 min-w-0 border-b md:border-b-0 md:border-r flex flex-col">
              <h3 className="text-sm font-medium mb-3 text-muted-foreground flex justify-between items-center">
                <span>Original Source</span>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Tap/Hover to view full</span>
              </h3>
              <div className="relative flex-1 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                <div 
                  className="relative max-w-full max-h-full flex items-center justify-center cursor-pointer"
                  onMouseEnter={() => setHoverOriginal(true)}
                  onMouseLeave={() => setHoverOriginal(false)}
                  onClick={() => setHoverOriginal(prev => !prev)}
                >
                  <img 
                    src={garment.source_image_url} 
                    alt="Original source" 
                    className="max-w-full max-h-[60vh] object-contain" 
                  />
                  
                  {/* Bbox Highlight Overlay */}
                  {hasBbox && (
                    <div 
                      className="absolute pointer-events-none transition-opacity duration-300 ease-in-out border-2 border-primary overflow-hidden"
                      style={{
                        top: topPercent,
                        left: leftPercent,
                        width: widthPercent,
                        height: heightPercent,
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
                        opacity: hoverOriginal ? 0 : 1
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* Right panel: Crop and Details */}
          <div className="flex-1 p-6 pt-2 flex flex-col min-w-0">
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Detected Item</h3>
            <div className="flex gap-6">
              <div className="w-1/3 aspect-square bg-muted rounded-lg p-2 flex items-center justify-center shrink-0">
                <img 
                  src={garment.crop_url} 
                  alt={garment.category} 
                  className="max-w-full max-h-full object-contain mix-blend-multiply" 
                />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Attributes</h4>
                  <div className="flex flex-wrap gap-2 text-sm capitalize">
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded">{formatTag(garment.attributes.color)}</span>
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded">{formatTag(garment.attributes.fit)} fit</span>
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded">{formatTag(garment.attributes.material_guess)}</span>
                    {garment.attributes.pattern && garment.attributes.pattern !== 'solid' && (
                      <span className="bg-primary/10 text-primary px-2 py-1 rounded">{formatTag(garment.attributes.pattern)}</span>
                    )}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Style</h4>
                  <div className="flex flex-wrap gap-2 text-sm capitalize">
                    <span className="bg-secondary text-secondary-foreground px-2 py-1 rounded">{formatTag(garment.style_attributes.formality)}</span>
                    <span className="bg-secondary text-secondary-foreground px-2 py-1 rounded">{formatTag(garment.style_attributes.warmth_level)} warmth</span>
                  </div>
                </div>

                {garment.style_attributes.occasion_tags && garment.style_attributes.occasion_tags.length > 0 && (
                  <div>
                    <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Occasions</h4>
                    <div className="flex flex-wrap gap-1">
                      {garment.style_attributes.occasion_tags.map(tag => (
                        <span key={tag} className="text-xs border px-2 py-1 rounded capitalize">{formatTag(tag)}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
