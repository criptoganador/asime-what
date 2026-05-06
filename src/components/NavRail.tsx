import { MessageSquare, CircleDashed, Users, Settings, UserCircle, LogOut } from 'lucide-react';
import { useChatStore } from '../features/sidebar/store/useChatStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const NavRail = () => {
  const { view, setView } = useChatStore();

  return (
    <div className="w-[60px] h-full bg-wa-nav-rail flex flex-col items-center py-4 justify-between text-[#aebac1] z-30">
      <div className="flex flex-col gap-6 items-center">
        <button 
          onClick={() => setView('chats')}
          className={cn(
            "p-2 rounded-full transition-colors cursor-pointer",
            view === 'chats' ? "bg-[#374248] text-wa-green" : "hover:bg-[#374248]"
          )}
        >
          <MessageSquare size={24} />
        </button>
        <button 
          onClick={() => setView('status')}
          className={cn(
            "p-2 rounded-full transition-colors cursor-pointer",
            view === 'status' ? "bg-[#374248] text-wa-green" : "hover:bg-[#374248]"
          )}
        >
          <CircleDashed size={24} />
        </button>
      </div>
      
      {/* Texto Vertical de Marca en el Espacio Vacío con Efecto 3D */}
      <div className="flex-1 flex items-center justify-center py-8 select-none pointer-events-none">
        <span 
          style={{ 
            writingMode: 'vertical-rl', 
            transform: 'rotate(180deg)',
            textShadow: '1px 1px 1px rgba(0,0,0,0.6), -1px -1px 1px rgba(255,255,255,0.05)'
          }} 
          className="text-[12px] font-black tracking-[0.5em] uppercase text-[#2a3942] whitespace-nowrap"
        >
          Asicme Chat
        </span>
      </div>

      <div className="flex flex-col gap-6 items-center">
        <button 
          onClick={() => setView('settings')}
          className={cn(
            "p-2 rounded-full transition-colors cursor-pointer",
            view === 'settings' ? "bg-[#374248] text-wa-green" : "hover:bg-[#374248]"
          )}
        >
          <Settings size={24} />
        </button>
        <button 
          onClick={() => setView('profile')}
          className={cn(
            "p-2 rounded-full transition-colors cursor-pointer",
            view === 'profile' ? "bg-[#374248] text-wa-green" : "hover:bg-[#374248]"
          )}
        >
          <UserCircle size={24} />
        </button>
        <button className="p-2 hover:bg-[#374248] rounded-full transition-colors cursor-pointer">
          <LogOut size={24} />
        </button>
      </div>
    </div>
  );
};
