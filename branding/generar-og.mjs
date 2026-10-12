// Genera public/og-image.png (tarjeta que se ve al compartir el enlace) desde branding/og-image.html
// Uso:  node branding/generar-og.mjs
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const chrome = process.argv[2] || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const html = pathToFileURL(resolve(aqui, 'og-image.html')).href
const png = resolve(aqui, '..', 'public', 'og-image.png')

execFileSync(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1200,630',
    '--virtual-time-budget=8000',
    `--screenshot=${png}`,
    html,
  ],
  { stdio: 'ignore' }
)
console.log('OK', png)
