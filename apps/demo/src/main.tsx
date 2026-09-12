import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import 'retro-web-terminal/styles.css'
import './styles.css'
import { App } from './App'

const root = document.querySelector('#root')
if (!root) throw new Error('The demo root element is missing')

createRoot(root).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>
)
