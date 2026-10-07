import '@fontsource-variable/plus-jakarta-sans'
import './index.css'
import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill'
import flagFontUrl from 'country-flag-emoji-polyfill/dist/TwemojiCountryFlags.woff2?url'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

// Windows no dibuja banderas (🇫🇷 aparece como "FR"): fuente autoalojada solo para esos caracteres.
polyfillCountryFlagEmojis('Twemoji Country Flags', flagFontUrl)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
