import React from 'react';
import { NavRail } from './NavRail';
import { Sidebar } from '../features/sidebar/components/Sidebar';
import { ChatArea } from './ChatArea';
import { StatusSidebar } from '../features/status/components/StatusSidebar';
import { SettingsView } from '../features/sidebar/components/SettingsView';
import { useChatStore } from '../features/sidebar/store/useChatStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AnimatePresence, motion } from 'framer-motion';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Layout = () => {
  const { view, activeChatId, currentUser } = useChatStore();

  // Actualizar el icono de la pestaña (favicon) dinámicamente con el avatar del usuario
  React.useEffect(() => {
    if (currentUser?.avatar) {
      const link: HTMLLinkElement = document.querySelector("link[rel*='icon']") || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = currentUser.avatar;
      document.getElementsByTagName('head')[0].appendChild(link);
      
      document.title = `${currentUser.name} | Asicme Chat`;
    } else {
      document.title = 'Asicme Chat';
    }
  }, [currentUser?.avatar, currentUser?.name]);

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-wa-bg">
      {/* NavRail: Lateral en desktop, inferior en móviles (solo cuando no hay chat activo) */}
      <div className={cn(
        "h-full z-30",
        activeChatId ? "hidden md:flex" : "flex order-2 md:order-none"
      )}>
        <NavRail />
      </div>
      
      {/* Sidebar dinámico */}
      <div className={cn(
        "flex-1 md:flex-none h-full border-r border-wa-border order-1 md:order-none",
        activeChatId ? "hidden md:block w-[400px]" : "w-full md:w-[400px]"
      )}>
        <AnimatePresence mode="wait">
          {/* Todas estas vistas comparten el Sidebar como contenedor base */}
          {(view === 'chats' || view === 'new-chat' || view === 'add-contact' || view === 'profile' || view === 'group-info' || view === 'security') && (
            <motion.div 
              key="sidebar-group"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <Sidebar />
            </motion.div>
          )}

          {view === 'status' && (
            <motion.div 
              key="status"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <StatusSidebar />
            </motion.div>
          )}

          {view === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <SettingsView />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ChatArea */}
      <div className={cn(
        "flex-1 h-full",
        !activeChatId ? "hidden md:flex" : "flex"
      )}>
        <ChatArea />
      </div>
    </div>
  );
};
