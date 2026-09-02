import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/base.css'
import './styles/table.css'
import './styles/board.css'

const container = document.getElementById('root')
if (container === null) throw new Error('No se encontró el nodo #root')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
