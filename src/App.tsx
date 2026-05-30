import { Layout } from './components/Layout'
import { AuthScreen } from './features/auth/components/AuthScreen'
import { useChatStore } from './features/sidebar/store/useChatStore'

function App() {
  const { isAuthenticated, isValidatingSession } = useChatStore();

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
      {!isAuthenticated ? <AuthScreen /> : <Layout />}
    </>
  )
}

export default App
