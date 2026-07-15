import { useState } from 'react';
import { Button } from './ui/button';
import { Sparkles, Loader2, Shirt } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { GarmentChip } from './GarmentChip';
import type { Garment } from '../api/garments';

export interface OutfitProposal {
  outfitId: string;
  label: string;
  garments: Garment[];
}

interface OutfitProposalBubbleProps {
  outfits: OutfitProposal[];
  text?: string;
  onRender: (outfitId: string) => Promise<void>;
  onGarmentClick: (garment: Garment) => void;
}

export function OutfitProposalBubble({ outfits, text, onRender, onGarmentClick }: OutfitProposalBubbleProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  const handleRenderClick = async (outfitId: string) => {
    setLoadingId(outfitId);
    setErrorId(null);
    try {
      await onRender(outfitId);
    } catch (err) {
      setErrorId(outfitId);
      console.error(err);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="flex justify-start w-full">
      <div className="max-w-[85%] rounded-2xl px-5 py-4 bg-muted rounded-bl-sm space-y-4 shadow-sm border border-border/50">
        {outfits.map((outfit, index) => (
          <div key={outfit.outfitId} className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
              <Shirt className="h-4 w-4" />
              {outfit.label}
            </div>
            
            <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 hide-scrollbar max-w-full">
              {outfit.garments.map(g => (
                <GarmentChip 
                  key={g.id} 
                  garment={g} 
                  onClick={() => onGarmentClick(g)} 
                />
              ))}
              {outfit.garments.length === 0 && (
                <div className="text-sm text-muted-foreground italic px-2">No specific items provided.</div>
              )}
            </div>

            <div className="space-y-2">
              <Button 
                onClick={() => handleRenderClick(outfit.outfitId)} 
                variant="default" 
                className="w-full sm:w-auto font-medium"
                disabled={loadingId === outfit.outfitId}
              >
                {loadingId === outfit.outfitId ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Try On
              </Button>
              {errorId === outfit.outfitId && (
                <p className="text-xs text-destructive">Failed to start render. Please try again.</p>
              )}
            </div>
            
            {/* Divider if not the last outfit */}
            {index < outfits.length - 1 && (
              <div className="h-px bg-border my-4" />
            )}
          </div>
        ))}

        {text && (
          <div className="prose prose-sm dark:prose-invert max-w-none pt-2 mt-2 border-t border-border/50">
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
