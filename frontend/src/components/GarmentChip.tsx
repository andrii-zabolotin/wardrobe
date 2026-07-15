import type { Garment } from '../api/garments';

interface GarmentChipProps {
  garment: Garment;
  onClick: () => void;
}

export function GarmentChip({ garment, onClick }: GarmentChipProps) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col group rounded-xl border bg-card hover:border-primary/50 transition-all shrink-0 overflow-hidden w-28 text-left shadow-sm hover:shadow-md"
      aria-label={`Select ${garment.title || garment.category}`}
      title={garment.title || garment.category}
    >
      <div className="w-full aspect-square bg-muted/50 overflow-hidden relative">
        <img 
          src={garment.crop_url} 
          alt={garment.category} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
        />
      </div>
      <div className="p-2.5 w-full">
        <div className="text-xs font-medium leading-tight capitalize truncate w-full text-foreground/90">
          {garment.title || garment.category}
        </div>
        <div className="text-[10px] text-muted-foreground capitalize mt-1 truncate">
          {garment.category}
        </div>
      </div>
    </button>
  );
}
