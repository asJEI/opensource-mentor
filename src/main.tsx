import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import '@/styles/index.css'
import { initializeWorkspaceSync } from '@/sync/workspaceBridge'

const disposeWorkspaceSync = initializeWorkspaceSync()
if (import.meta.hot) import.meta.hot.dispose(disposeWorkspaceSync)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
