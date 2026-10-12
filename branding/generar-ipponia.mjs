// Genera los logos de "Ipponia" (símbolo + nombre) en versión clara y oscura
// Uso:  node branding/generar-ipponia.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const salida = join(aqui, 'ipponia')
mkdirSync(salida, { recursive: true })
const chrome = process.argv[2] || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const temas = {
  oscuro: { bg: '#111318', fg: '#ffffff', simbolo: 'simbolo-cinturon-blanco.png' },
  claro: { bg: '#f5f4f0', fg: '#111318', simbolo: 'simbolo-cinturon-negro.png' },
}

const piezas = [
  { nombre: 'logo', ancho: 1800, alto: 560, html: (t) => `
    <div class="fila"><img src="${t.simbolo}" class="s"><div><div class="n">IPPONIA</div><div class="l">TORNEOS EN VIVO</div></div></div>` },
  { nombre: 'simbolo', ancho: 800, alto: 800, html: (t) => `
    <div class="centro"><img src="${t.simbolo}" class="g"></div>` },
]

for (const [tema, t] of Object.entries(temas)) {
  for (const p of piezas) {
    const base = `ipponia-${p.nombre}-${tema}`
    const html = join(salida, `${base}.html`)
    writeFileSync(
      html,
      `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@600;900&display=swap">
<style>
html,body{margin:0}body{width:${p.ancho}px;height:${p.alto}px;background:${t.bg};color:${t.fg};font-family:Inter,'Helvetica Neue',Arial,sans-serif;display:flex;align-items:center;justify-content:center}
.fila{display:flex;align-items:center;gap:70px}.s{height:380px;width:auto}.g{height:560px;width:auto}
.n{font-size:230px;font-weight:900;letter-spacing:14px;line-height:1}.l{font-size:44px;font-weight:600;letter-spacing:16px;opacity:.7;margin:26px 0 0 8px}
</style>${p.html(t)}`
    )
    execFileSync(
      chrome,
      ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
        `--window-size=${p.ancho},${p.alto}`, '--virtual-time-budget=8000',
        `--screenshot=${join(salida, base + '.png')}`, pathToFileURL(resolve(html)).href],
      { stdio: 'ignore' }
    )
    console.log('OK', base)
  }
}
