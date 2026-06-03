import { motion } from 'framer-motion';
import { ArrowLeft, Shield, LogOut } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const SettingsView = () => {
  const { setView, logout, currentUser } = useChatStore();

  const handleLogout = () => {
    if (window.confirm('¿Estás seguro de que quieres cerrar sesión?')) {
      logout();
    }
  };

  return (
    <motion.div 
      initial={{ x: '-100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="w-full h-full absolute inset-0 z-50 bg-wa-bg flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="h-20 sm:h-[108px] bg-[#6366f1] flex items-end px-6 pb-4 text-white">
        <div className="flex items-center gap-6">
          <ArrowLeft 
            className="cursor-pointer hover:scale-110 transition-transform" 
            onClick={() => setView('chats')} 
          />
          <h2 className="text-[19px] font-medium">Configuración</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-wa-bg">
        {/* Perfil Mini */}
        <div 
          onClick={() => setView('profile')}
          className="bg-white px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-wa-hover transition-colors mb-2 shadow-sm"
        >
          <img src={currentUser?.avatar} className="w-16 h-16 rounded-full object-cover" alt="" />
          <div className="flex-1">
            <h3 className="text-[17px] font-medium text-wa-text-primary">{currentUser?.name}</h3>
            <p className="text-[14px] text-wa-text-secondary truncate">{currentUser?.about}</p>
          </div>
        </div>

        {/* Opciones */}
        <div className="bg-white shadow-sm mb-2">
          <SettingsItem icon={<Shield size={20} />} label="Seguridad" onClick={() => setView('security')} />
        </div>

        <div className="bg-white shadow-sm mb-6">
          <SettingsItem 
            icon={<LogOut size={20} className="text-red-500" />} 
            label="Cerrar sesión" 
            onClick={handleLogout}
            textColor="text-red-500"
          />
        </div>

        <div className="text-center py-4 mb-8">
          <p className="text-[12px] text-wa-text-secondary uppercase font-bold tracking-widest">Asicme Chat</p>
          <p className="text-[12px] text-wa-text-secondary/60 mt-1">Versión 1.0.0</p>
        </div>
      </div>
    </motion.div>
  );
};

const SettingsItem = ({ icon, label, onClick, textColor = "text-wa-text-primary" }: any) => (
  <div 
    onClick={onClick}
    className="flex items-center px-6 py-4 hover:bg-wa-hover cursor-pointer transition-colors border-b border-wa-border last:border-none"
  >
    <div className="text-wa-text-secondary mr-6">
      {icon}
    </div>
    <div className="flex-1">
      <span className={cn("text-[16px]", textColor)}>{label}</span>
    </div>
  </div>
);
