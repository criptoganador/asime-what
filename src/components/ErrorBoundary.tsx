import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', 
          alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', zIndex: 9999, padding: 20
        }}>
          <div style={{
            background: 'white', padding: '40px 30px', borderRadius: 24, 
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)', maxWidth: 400, width: '100%',
            textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center'
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: '#fee2e2',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 10px 0' }}>Algo salió mal</h2>
            <p style={{ color: '#6b7280', fontSize: 15, lineHeight: 1.5, margin: '0 0 24px 0' }}>
              La aplicación encontró un error inesperado al mostrar esta pantalla. Hemos recuperado el sistema para evitar que se cierre.
            </p>
            <button 
              onClick={() => window.location.reload()}
              style={{
                background: '#6366f1', color: 'white', border: 'none', padding: '12px 24px',
                borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(99,102,241,0.3)', width: '100%', transition: 'all 0.2s'
              }}
            >
              Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
