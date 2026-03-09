// Bootstrap the storage shim BEFORE the dashboard component loads
// so window.storage is available when module-level code runs
import './lib/storage.js'

import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
