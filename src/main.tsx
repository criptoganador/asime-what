import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { Buffer } from 'buffer'

import { ErrorBoundary } from './components/ErrorBoundary'

// Polyfill para bip39 y otras librerías que usan Buffer de Node.js
(window as any).Buffer = (window as any).Buffer || Buffer

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
