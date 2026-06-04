import React from 'react';
import { NavRail } from './NavRail';
import { Sidebar } from '../features/sidebar/components/Sidebar';
import { ChatArea } from './ChatArea';
import { StatusSidebar } from '../features/status/components/StatusSidebar';
import { SettingsView } from '../features/sidebar/components/SettingsView';
import { CallOverlay } from './CallOverlay';
import { useChatStore } from '../features/sidebar/store/useChatStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff, Loader2 } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SidebarTransitionWrapper = ({ children, motionKey }: { children: React.ReactNode, motionKey: string }) => (
  <motion.div 
    key={motionKey}
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: 0.2 }}
    className="h-full"
  >
    {children}
  </motion.div>
);

export const Layout = () => {
  const { view, activeChatId, currentUser, isOnline, socketConnected } = useChatStore();

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
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-wa-bg relative">
      {/* Indicador de red global */}
      {(!isOnline || !socketConnected) && (
        <div className="absolute top-0 left-0 w-full z-50 flex justify-center p-1 pointer-events-none">
          <div className="bg-red-500/90 text-white text-xs font-medium px-3 py-1 rounded-full flex items-center gap-2 shadow-lg backdrop-blur-sm">
            {!isOnline ? (
              <>
                <WifiOff className="w-3 h-3" />
                <span>Sin conexión a internet</span>
              </>
            ) : (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Conectando...</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* NavRail: Lateral en desktop, oculto en móviles (ahora vive dentro de los sidebars) */}
      <div className={cn(
        "h-full z-30",
        activeChatId ? "hidden md:flex" : "hidden md:flex"
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
          {(view === 'chats' || view === 'new-chat' || view === 'add-contact' || view === 'profile' || view === 'group-info' || view === 'security' || view === 'create-group') && (
            <SidebarTransitionWrapper motionKey="sidebar-group">
              <Sidebar />
            </SidebarTransitionWrapper>
          )}

          {view === 'status' && (
            <SidebarTransitionWrapper motionKey="status">
              <StatusSidebar />
            </SidebarTransitionWrapper>
          )}

          {view === 'settings' && (
            <SidebarTransitionWrapper motionKey="settings">
              <SettingsView />
            </SidebarTransitionWrapper>
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

      {/* Motor de Llamadas Global */}
      <CallOverlay />
    </div>
  );
};
