import { MessageSquare, CircleDashed, Users, Settings, UserCircle, LogOut } from 'lucide-react';
import { useChatStore } from '../features/sidebar/store/useChatStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const NavRail = () => {
  const { view, setView, logout } = useChatStore();

  return (
    <div className="w-full md:w-[60px] h-[56px] md:h-full bg-wa-nav-rail flex md:flex-col items-center px-2 sm:px-4 md:px-0 py-0 md:py-4 justify-between text-[#aebac1] z-30 border-t md:border-t-0 md:border-r border-wa-border">
      <div className="flex md:flex-col gap-2 sm:gap-4 md:gap-6 items-center">
        <button 
          onClick={() => setView('chats')}
          className={cn(
            "p-2 rounded-full transition-colors cursor-pointer",
            view === 'chats' ? "bg-[#374248] text-wa-green" : "hover:bg-[#374248]"
          )}
        >
          <MessageSquare size={20} className="sm:w-6 sm:h-6" />
        </button>
        <button 
          onClick={() => setView('status')}
          className={cn(
            "p-2 rounded-full transition-colors cursor-pointer",
            view === 'status' ? "bg-[#374248] text-wa-green" : "hover:bg-[#374248]"
          )}
        >
          <CircleDashed size={20} className="sm:w-6 sm:h-6" />
        </button>
      </div>
      
      {/* Texto Vertical de Marca - Solo en Desktop */}
      <div className="hidden md:flex flex-1 items-center justify-center py-8 select-none pointer-events-none">
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

      <div className="flex md:flex-col gap-4 md:gap-6 items-center">
        <button 
          onClick={() => setView('settings')}
          className={cn(
            "p-2 rounded-full transition-colors cursor-pointer",
            view === 'settings' ? "bg-[#374248] text-wa-green" : "hover:bg-[#374248]"
          )}
        >
          <Settings size={20} className="sm:w-6 sm:h-6" />
        </button>
        <button 
          onClick={() => setView('profile')}
          className={cn(
            "p-2 rounded-full transition-colors cursor-pointer",
            view === 'profile' ? "bg-[#374248] text-wa-green" : "hover:bg-[#374248]"
          )}
        >
          <UserCircle size={20} className="sm:w-6 sm:h-6" />
        </button>
        <button 
          onClick={() => {
            if (window.confirm('¿Estás seguro de que quieres cerrar sesión?')) {
              logout();
            }
          }}
          className="p-2 hover:bg-[#374248] rounded-full transition-colors cursor-pointer text-red-400"
        >
          <LogOut size={20} className="sm:w-6 sm:h-6" />
        </button>
      </div>
    </div>
  );
};
