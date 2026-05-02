import { NavRail } from './NavRail';
import { Sidebar } from '../features/sidebar/components/Sidebar';
import { ChatArea } from './ChatArea';
import { StatusSidebar } from '../features/status/components/StatusSidebar';
import { ProfileSidebar } from '../features/profile/components/ProfileSidebar';
import { useChatStore } from '../features/sidebar/store/useChatStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Layout = () => {
  const { view, activeChatId } = useChatStore();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-wa-bg">
      {/* NavRail: Oculto en móviles */}
      <div className="hidden md:flex h-full">
        <NavRail />
      </div>
      
      {/* Sidebar dinámico: Ocupa todo el ancho en móviles si NO hay chat activo */}
      <div className={cn(
        "h-full border-r border-wa-border",
        activeChatId ? "hidden md:block w-[400px]" : "w-full md:w-[400px]"
      )}>
        {view === 'chats' && <Sidebar />}
        {view === 'status' && <StatusSidebar />}
        {view === 'profile' && <ProfileSidebar />}
        {view === 'communities' && (
          <div className="w-full h-full bg-wa-sidebar flex flex-col items-center justify-center p-8 text-center">
            <h2 className="text-xl font-bold text-wa-text-primary mb-2">Comunidades</h2>
            <p className="text-wa-text-secondary text-sm">Mantén tus grupos conectados y organizados.</p>
          </div>
        )}
        {view === 'settings' && (
          <div className="w-full h-full bg-wa-sidebar flex flex-col items-center justify-center p-8 text-center">
            <h2 className="text-xl font-bold text-wa-text-primary mb-2">Configuración</h2>
            <p className="text-wa-text-secondary text-sm">Próximamente: Ajustes de perfil y privacidad.</p>
          </div>
        )}
      </div>

      {/* ChatArea: Ocupa todo el ancho en móviles si HAY chat activo */}
      <div className={cn(
        "flex-1 h-full",
        !activeChatId ? "hidden md:flex" : "flex"
      )}>
        <ChatArea />
      </div>
    </div>
  );
};
