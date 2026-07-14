import type { Garment } from '../api/garments';

interface GarmentChipProps {
  garment: Garment;
  onClick: () => void;
}

export function GarmentChip({ garment, onClick }: GarmentChipProps) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-3 pr-4 p-1 rounded-full border bg-card hover:bg-accent hover:text-accent-foreground transition-colors shrink-0 overflow-hidden"
    >
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
        <img 
          src={garment.crop_url} 
          alt={garment.category} 
          className="w-full h-full object-cover mix-blend-multiply" 
        />
      </div>
      <div className="text-left">
        <div className="text-sm font-medium leading-none capitalize truncate max-w-[120px]">
          {garment.title || garment.category}
        </div>
        <div className="text-xs text-muted-foreground capitalize mt-1">
          {garment.category}
        </div>
      </div>
    </button>
  );
}
