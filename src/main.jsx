import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'
import { initTheme } from './lib/useTheme'
import { installGlobalErrorHandlers } from './lib/reportError'

// Initialize theme before first render to prevent flash
initTheme()

// Self-hosted error reporting — writes to Supabase `client_errors` (Sentry-free).
installGlobalErrorHandlers()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
