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
        <button 
          onClick={() => setView('communities')}
          className={cn(
            "p-2 rounded-full transition-colors cursor-pointer",
            view === 'communities' ? "bg-[#374248] text-wa-green" : "hover:bg-[#374248]"
          )}
        >
          <Users size={24} />
        </button>
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
