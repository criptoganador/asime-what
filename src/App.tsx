import { useEffect } from 'react'
import { Layout } from './components/Layout'
import { AuthScreen } from './features/auth/components/AuthScreen'
import { useChatStore, socket } from './features/sidebar/store/useChatStore'
import { requestNotificationPermissions } from './utils/notifications'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { Toaster } from 'react-hot-toast'

function App() {
  const { isAuthenticated, isValidatingSession, currentUser } = useChatStore();

  const { initializeNetworkListeners } = useChatStore();

  useEffect(() => {
    initializeNetworkListeners();
  }, [initializeNetworkListeners]);

  useEffect(() => {
    if (isAuthenticated && currentUser?.id) {
      socket.emit('user_connected', currentUser.id);
      requestNotificationPermissions();
    }
  }, [isAuthenticated, currentUser?.id]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const backListener = CapacitorApp.addListener('backButton', () => {
        const state = useChatStore.getState();
        
        // 1. Ignorar si hay una llamada activa
        if (state.activeCall || state.incomingCall || state.outgoingCall) {
          return;
        }

        // 2. Si estamos viendo un chat abierto, lo cerramos para volver al sidebar
        if (state.activeChatId) {
          state.closeChat();
          return;
        }

        // 3. Si estamos en alguna pantalla de configuración/perfil, volver a chats
        if (state.view !== 'chats') {
          state.setView('chats');
          return;
        }

        // 4. Si estamos en la pantalla principal (lista de chats), salir de la app
        CapacitorApp.exitApp();
      });

      return () => {
        backListener.then(l => l.remove());
      };
    }
  }, []);

  // Mientras se valida la sesión contra la BD, mostrar splash de carga
  if (isValidatingSession) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
        zIndex: 9999
      }}>
        <div style={{
          width: 80,
          height: 80,
          background: 'white',
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          overflow: 'hidden',
          padding: 8
        }}>
          <img src="/favicon.png" alt="Asicme Chat" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
        </div>
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid #e5e7eb',
          borderTopColor: '#6366f1',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <p style={{ marginTop: 16, color: '#667781', fontSize: 14, fontWeight: 500 }}>
          Verificando sesión...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#1c1c1e',
            color: '#fff',
            fontSize: '14px',
            fontWeight: '500',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.08)',
            maxWidth: '90vw'
          },
          success: { iconTheme: { primary: '#00a884', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ea4335', secondary: '#fff' } },
        }}
      />
      {!isAuthenticated ? <AuthScreen /> : <Layout />}
    </>
  )
}

export default App
