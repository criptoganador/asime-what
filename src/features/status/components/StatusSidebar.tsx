import React, { useState } from 'react';
import { Plus, MoreVertical, Camera, Pencil, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const StatusSidebar = () => {
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  return (
    <div className="w-[400px] h-full flex flex-col bg-wa-sidebar border-r border-wa-border overflow-hidden animate-in fade-in slide-in-from-left-4 duration-300 relative">
      {/* Header */}
      <div className="px-4 py-3 flex justify-between items-center bg-wa-sidebar">
        <h1 className="text-xl font-bold text-wa-text-primary">Estados</h1>
        <div className="flex gap-4 text-wa-text-secondary">
          <MoreVertical size={20} className="cursor-pointer hover:bg-wa-hover rounded-full transition-colors" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* My Status */}
        <div 
          onClick={() => setShowCreateMenu(!showCreateMenu)}
          className="px-4 py-3 flex items-center hover:bg-wa-hover cursor-pointer transition-colors mt-2"
        >
          <div className="relative">
            <img 
              src="https://i.pravatar.cc/150?u=me" 
              className="w-12 h-12 rounded-full object-cover" 
              alt="Mi estado" 
            />
            <div className={cn(
              "absolute bottom-0 right-0 rounded-full p-0.5 border-2 border-white transition-all duration-300",
              showCreateMenu ? "bg-red-500 rotate-45" : "bg-wa-green rotate-0"
            )}>
              <Plus size={14} className="text-white" />
            </div>
          </div>
          <div className="ml-4">
            <h3 className="text-[17px] font-medium text-wa-text-primary leading-tight">Mi estado</h3>
            <p className="text-[14px] text-wa-text-secondary">Añade una actualización</p>
          </div>
        </div>

        {/* Floating Creation Menu */}
        {showCreateMenu && (
          <div className="mx-4 mb-2 flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-3 p-3 bg-wa-bg rounded-xl hover:bg-wa-hover cursor-pointer transition-all border border-wa-border shadow-sm">
              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white">
                <Pencil size={20} />
              </div>
              <span className="text-[15px] font-medium text-wa-text-primary">Estado de texto</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-wa-bg rounded-xl hover:bg-wa-hover cursor-pointer transition-all border border-wa-border shadow-sm">
              <div className="w-10 h-10 bg-wa-green rounded-full flex items-center justify-center text-white">
                <Camera size={20} />
              </div>
              <span className="text-[15px] font-medium text-wa-text-primary">Fotos y videos</span>
            </div>
          </div>
        )}

        {/* Section Title */}
        <div className="px-6 py-4">
          <h2 className="text-[14px] text-wa-teal font-medium uppercase tracking-wider">Recientes</h2>
        </div>

        {/* Mock Statuses */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="px-4 py-3 flex items-center hover:bg-wa-hover cursor-pointer transition-colors">
            <div className="relative p-[2px] rounded-full border-2 border-wa-green border-dashed">
              <img 
                src={`https://i.pravatar.cc/150?u=status-${i}`} 
                className="w-11 h-11 rounded-full object-cover border-2 border-white" 
                alt="" 
              />
            </div>
            <div className="ml-4 flex-1 border-b border-wa-border pb-3">
              <h3 className="text-[17px] font-medium text-wa-text-primary leading-tight">Contacto {i}</h3>
              <p className="text-[14px] text-wa-text-secondary">Hoy a las {10 + i}:30</p>
            </div>
          </div>
        ))}

        {/* Section Title Viewed */}
        <div className="px-6 py-4">
          <h2 className="text-[14px] text-wa-text-secondary font-medium uppercase tracking-wider">Vistos</h2>
        </div>

        {[6, 7].map((i) => (
          <div key={i} className="px-4 py-3 flex items-center hover:bg-wa-hover cursor-pointer transition-colors opacity-70">
            <div className="relative p-[2px] rounded-full border-2 border-wa-border">
              <img 
                src={`https://i.pravatar.cc/150?u=status-${i}`} 
                className="w-11 h-11 rounded-full object-cover border-2 border-white" 
                alt="" 
              />
            </div>
            <div className="ml-4 flex-1 border-b border-wa-border pb-3">
              <h3 className="text-[17px] font-medium text-wa-text-primary leading-tight">Contacto {i}</h3>
              <p className="text-[14px] text-wa-text-secondary">Ayer a las 22:15</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
