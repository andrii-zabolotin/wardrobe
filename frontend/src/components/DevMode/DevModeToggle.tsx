import React from 'react';
import { useDevStore } from '../../store/devStore';

export const DevModeToggle: React.FC = () => {
  const { devMode, toggleDevMode } = useDevStore();

  const handleToggle = () => {
    toggleDevMode();
  };

  return (
    <button
      onClick={handleToggle}
      className={`
        relative inline-flex items-center h-8 rounded-full border px-3 text-xs font-medium transition-colors
        ${devMode ? 'bg-red-950 border-red-500 text-red-500' : 'bg-transparent border-neutral-700 text-neutral-400 hover:text-white'}
      `}
    >
      <span className="flex items-center gap-2">
        <span className="font-mono">DEV MODE</span>
        <div className={`w-8 h-4 rounded-full border p-0.5 transition-colors relative ${devMode ? 'border-red-500 bg-red-950/50' : 'border-neutral-700 bg-neutral-900'}`}>
          <div className={`absolute w-3 h-3 rounded-full bg-current top-0.5 transition-transform ${devMode ? 'translate-x-4 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'translate-x-0 bg-neutral-500'}`} />
        </div>
      </span>
      {devMode && (
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
      )}
      {devMode && (
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
      )}
    </button>
  );
};
