import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Moon, Sun, Bell, Lock, Shield, HelpCircle, LogOut, Image, Check, Volume2, VolumeX, BellOff } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const WALLPAPERS = [
  { id: 'default', name: 'Predeterminado', color: 'bg-[#e5ddd5]' },
  { id: 'dark', name: 'Oscuro', color: 'bg-[#0b141a]' },
  { id: 'blue', name: 'Azul', color: 'bg-[#7aa2f7]' },
  { id: 'purple', name: 'Púrpura', color: 'bg-[#bb9af7]' },
  { id: 'green', name: 'Verde', color: 'bg-[#9ece6a]' },
  { id: 'rose', name: 'Rosa', color: 'bg-[#f7768e]' },
  { id: 'yellow', name: 'Amarillo', color: 'bg-[#e0af68]' },
];

export const SettingsView = () => {
  const { 
    setView, isDarkMode, toggleDarkMode, logout, currentUser,
    chatWallpaper, setChatWallpaper,
    notificationsEnabled, setNotificationsEnabled,
    soundsEnabled, setSoundsEnabled
  } = useChatStore();

  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);

  const handleLogout = () => {
    if (window.confirm('¿Estás seguro de que quieres cerrar sesión?')) {
      logout();
    }
  };

  const requestNotificationPermission = () => {
    if (Notification.permission !== 'granted') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          setNotificationsEnabled(true);
        }
      });
    } else {
      setNotificationsEnabled(!notificationsEnabled);
    }
  };

  return (
    <motion.div 
      initial={{ x: '-100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute inset-0 z-50 bg-wa-bg flex flex-col"
    >
      {/* Header */}
      <div className="h-[108px] bg-[#007bfc] flex items-end px-6 pb-4 text-white">
        <div className="flex items-center gap-6">
          <ArrowLeft 
            className="cursor-pointer hover:scale-110 transition-transform" 
            onClick={() => setView('chats')} 
          />
          <h2 className="text-[19px] font-medium">Configuración</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#f0f2f5]">
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

        {/* Sección de Pantalla */}
        <div className="bg-white shadow-sm mb-2">
          <SettingsItem 
            icon={<Moon size={20} />} 
            label="Modo Oscuro" 
            rightElement={<Switch active={isDarkMode} onClick={toggleDarkMode} />}
          />
          <SettingsItem 
            icon={<Image size={20} />} 
            label="Fondo de pantalla" 
            onClick={() => setShowWallpaperPicker(true)}
            rightElement={<div className={cn("w-6 h-6 rounded-md border border-wa-border", WALLPAPERS.find(w => w.id === chatWallpaper)?.color || 'bg-gray-200')} />}
          />
        </div>

        {/* Sección de Notificaciones */}
        <div className="bg-white shadow-sm mb-2">
          <SettingsItem 
            icon={notificationsEnabled ? <Bell size={20} /> : <BellOff size={20} />} 
            label="Notificaciones de escritorio" 
            rightElement={<Switch active={notificationsEnabled} onClick={requestNotificationPermission} />}
          />
          <SettingsItem 
            icon={soundsEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />} 
            label="Sonidos de mensajes" 
            rightElement={<Switch active={soundsEnabled} onClick={() => setSoundsEnabled(!soundsEnabled)} />}
          />
        </div>

        {/* Otras Opciones */}
        <div className="bg-white shadow-sm mb-2">
          <SettingsItem icon={<Lock size={20} />} label="Privacidad" onClick={() => setView('privacy')} />
          <SettingsItem icon={<Shield size={20} />} label="Seguridad" onClick={() => setView('security')} />
        </div>

        <div className="bg-white shadow-sm mb-6">
          <SettingsItem icon={<HelpCircle size={20} />} label="Ayuda" />
          <SettingsItem 
            icon={<LogOut size={20} className="text-red-500" />} 
            label="Cerrar sesión" 
            onClick={handleLogout}
            textColor="text-red-500"
          />
        </div>

        <div className="text-center py-4 mb-8">
          <p className="text-[12px] text-wa-text-secondary uppercase font-bold tracking-widest">Asicme Web</p>
          <p className="text-[12px] text-wa-text-secondary/60 mt-1">Versión 1.0.0</p>
        </div>
      </div>

      {/* Wallpaper Picker Modal */}
      <AnimatePresence>
        {showWallpaperPicker && (
          <div className="absolute inset-0 z-[60] bg-black/50 flex items-end">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full bg-white rounded-t-3xl p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-wa-text-primary">Fondo de pantalla</h3>
                <button onClick={() => setShowWallpaperPicker(false)} className="p-2 hover:bg-wa-bg rounded-full transition-colors">
                  <ArrowLeft className="rotate-[-90deg]" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-4 pb-8">
                {WALLPAPERS.map((wp) => (
                  <div 
                    key={wp.id}
                    onClick={() => { setChatWallpaper(wp.id); setShowWallpaperPicker(false); }}
                    className="flex flex-col items-center gap-2 cursor-pointer group"
                  >
                    <div className={cn(
                      "w-full aspect-[4/5] rounded-xl border-2 transition-all flex items-center justify-center",
                      wp.color,
                      chatWallpaper === wp.id ? "border-[#007bfc] scale-105" : "border-transparent hover:border-gray-300"
                    )}>
                      {chatWallpaper === wp.id && <Check className="text-white drop-shadow-md" />}
                    </div>
                    <span className="text-[12px] text-wa-text-secondary font-medium">{wp.name}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const SettingsItem = ({ icon, label, onClick, rightElement, textColor = "text-wa-text-primary" }: any) => (
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
    {rightElement}
  </div>
);

const Switch = ({ active, onClick }: { active: boolean, onClick: () => void }) => (
  <div 
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={cn(
      "w-11 h-5 rounded-full relative transition-colors cursor-pointer",
      active ? "bg-wa-teal" : "bg-gray-300"
    )}
  >
    <div className={cn(
      "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-md",
      active ? "left-6" : "left-1"
    )} />
  </div>
);
