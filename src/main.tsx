import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { Buffer } from 'buffer'

// Polyfill para bip39 y otras librerías que usan Buffer de Node.js
window.Buffer = window.Buffer || Buffer

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
)
