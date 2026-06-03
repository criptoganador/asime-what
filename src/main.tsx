import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { Buffer } from 'buffer'

import { ErrorBoundary } from './components/ErrorBoundary'

// Polyfill para bip39 y otras librerías que usan Buffer de Node.js
(window as any).Buffer = (window as any).Buffer || Buffer

import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    console.log('New content available, please refresh.')
    // Podríamos añadir un UI para "Refrescar" o hacerlo automático:
    updateSW(true)
  },
  onOfflineReady() {
    console.log('App is ready to work offline.')
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
