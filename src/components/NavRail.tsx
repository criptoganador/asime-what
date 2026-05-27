import { MessageSquare, CircleDashed, Settings, UserCircle, LogOut, Users } from 'lucide-react';
import { useChatStore } from '../features/sidebar/store/useChatStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'framer-motion';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const NavItem = ({ icon: Icon, active, onClick, tooltip, image, isDanger }: any) => {
  return (
    <div className="relative group flex md:flex-col items-center justify-center w-full md:w-auto">
      <motion.button 
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onClick}
        className={cn(
          "p-2.5 rounded-xl transition-all duration-300 relative flex items-center justify-center",
          active 
            ? "bg-[#374248] text-wa-green shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]" 
            : isDanger
              ? "hover:bg-[#374248] text-red-400 hover:text-red-500"
              : "hover:bg-[#374248] text-[#aebac1] hover:text-[#e9edef]"
        )}
      >
        {active && (
          <motion.div 
            layoutId="nav-indicator"
            className="absolute left-0 top-1/4 bottom-1/4 w-[3px] bg-wa-green rounded-r-md hidden md:block shadow-[0_0_8px_rgba(0,168,132,0.5)]" 
          />
        )}
        
        {image ? (
          <div className={cn("w-6 h-6 rounded-full overflow-hidden", active && "ring-2 ring-wa-green ring-offset-2 ring-offset-wa-nav-rail")}>
            <img src={image} alt="Profile" className="w-full h-full object-cover" />
          </div>
        ) : (
          <Icon size={22} strokeWidth={active ? 2.5 : 2} />
        )}
      </motion.button>
      
      {/* Tooltip Desktop */}
      <div className="absolute left-[120%] px-3 py-1.5 bg-[#111b21] text-[#e9edef] text-[13px] font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl whitespace-nowrap z-50 pointer-events-none hidden md:block border border-[#2a3942]">
        {tooltip}
        {/* Triángulo del tooltip */}
        <div className="absolute top-1/2 -left-[5px] -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-r-[5px] border-r-[#2a3942] border-b-[5px] border-b-transparent"></div>
      </div>
    </div>
  );
};

export const NavRail = () => {
  const { view, setView, logout, currentUser } = useChatStore();

  return (
    <div className="w-full md:w-[64px] h-[56px] md:h-full bg-wa-nav-rail flex md:flex-col items-center px-2 sm:px-4 md:px-0 py-1 md:py-6 justify-between z-30 border-t md:border-t-0 md:border-r border-[#202c33] shadow-[2px_0_15px_rgba(0,0,0,0.1)]">
      
      <div className="flex md:flex-col gap-2 sm:gap-4 md:gap-5 items-center w-full md:w-auto px-2 md:px-0 justify-around md:justify-start">
        <NavItem 
          icon={MessageSquare} 
          active={view === 'chats' || view === 'new-chat' || view === 'add-contact' || view === 'group-info'} 
          onClick={() => setView('chats')} 
          tooltip="Chats" 
        />
        <NavItem 
          icon={CircleDashed} 
          active={view === 'status'} 
          onClick={() => setView('status')} 
          tooltip="Estados" 
        />
        <NavItem 
          icon={Users} 
          active={view === 'create-group'} 
          onClick={() => setView('create-group')} 
          tooltip="Crear Grupo" 
        />
      </div>
      
      {/* Texto Vertical de Marca - Solo en Desktop */}
      <div className="hidden md:flex flex-1 items-center justify-center py-8 select-none pointer-events-none opacity-40">
        <span 
          style={{ 
            writingMode: 'vertical-rl', 
            transform: 'rotate(180deg)',
          }} 
          className="text-[10px] font-bold tracking-[0.6em] uppercase text-[#8696a0] whitespace-nowrap"
        >
          Asicme Chat
        </span>
      </div>

      <div className="flex md:flex-col gap-2 sm:gap-4 md:gap-5 items-center w-full md:w-auto px-2 md:px-0 justify-around md:justify-end">
        <NavItem 
          icon={Settings} 
          active={view === 'settings' || view === 'security'} 
          onClick={() => setView('settings')} 
          tooltip="Configuración" 
        />
        <NavItem 
          icon={UserCircle} 
          active={view === 'profile'} 
          onClick={() => setView('profile')} 
          tooltip="Perfil"
          image={currentUser?.avatar}
        />
        <NavItem 
          icon={LogOut} 
          active={false} 
          isDanger={true}
          onClick={() => {
            if (window.confirm('¿Estás seguro de que quieres cerrar sesión?')) {
              logout();
            }
          }} 
          tooltip="Cerrar sesión" 
        />
      </div>
    </div>
  );
};
