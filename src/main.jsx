import { Buffer } from 'buffer'
if (typeof window !== 'undefined' && !window.Buffer) window.Buffer = Buffer

import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(<App />)
