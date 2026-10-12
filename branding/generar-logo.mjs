// Genera los SVG del logo (Taikai · sol naciente con cinturón, nudo de karate envuelto)
// y, con Chrome sin ventana, los PNG de cada uno.
// Uso:  node branding/generar-logo.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const salida = join(aqui, 'salida')
mkdirSync(salida, { recursive: true })

const ROJO = '#D7282F'
const TEMAS = {
  claro: { fg: '#111318', bg: '#f5f4f0' },
  oscuro: { fg: '#ffffff', bg: '#111318' },
}

// --- Piezas del símbolo (coordenadas en un lienzo de 110 x 112) ---
const pieza = (fg, bg) => `fill:${fg};stroke:${bg};stroke-width:1.6;stroke-linejoin:round`
const linea = (bg) => `stroke:${bg};stroke-width:1.4;opacity:.55;fill:none;stroke-linecap:round`

function simbolo({ fg, bg }) {
  const p = pieza(fg, bg)
  return `
  <g id="sol">
    <clipPath id="medio-sol"><rect x="0" y="0" width="110" height="55"/></clipPath>
    <circle cx="55" cy="55" r="42" fill="${ROJO}" clip-path="url(#medio-sol)"/>
  </g>
  <g id="cinturon">
    <rect x="6" y="53" width="98" height="14" rx="2" fill="${fg}"/>
    <path d="M9 57.3 H101 M9 62.7 H101" style="stroke:${bg};stroke-width:1;opacity:.35;fill:none"/>
  </g>
  <g id="puntas">
    <path d="M44 64 L58 67 L33 107 L18 99 Z" style="${p}"/>
    <path d="M52 67 L66 64 L92 99 L77 107 Z" style="${p}"/>
  </g>
  <g id="nudo">
    <path d="M39 57 Q45 49 57 50 L57 70 Q46 71 41 65 Z" style="${p}"/>
    <path d="M40 55 L48 52 L69 66 L61 71 Z" style="${p}"/>
    <rect x="56" y="48" width="11" height="24" rx="3.5" style="${p}"/>
    <path d="M61.5 52 V68" style="${linea(bg)}"/>
  </g>`
}

function svgSimbolo(tema) {
  const t = TEMAS[tema]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 112" width="1100" height="1120">
  <title>Taikai · símbolo (${tema})</title>
  <rect width="110" height="112" fill="${t.bg}"/>${simbolo(t)}
</svg>
`
}

function svgLogo(tema) {
  const t = TEMAS[tema]
  const fuente = `font-family="Inter,'Helvetica Neue',Arial,sans-serif"`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 112" width="2160" height="672">
  <title>Taikai · logo (${tema})</title>
  <rect width="360" height="112" fill="${t.bg}"/>${simbolo(t)}
  <text x="116" y="66" font-size="46" font-weight="900" letter-spacing="5" fill="${t.fg}" ${fuente}>TAIKAI</text>
  <text x="118" y="88" font-size="11" font-weight="600" letter-spacing="4" fill="${t.fg}" opacity=".7" ${fuente}>TORNEO EN VIVO</text>
</svg>
`
}

const archivos = []
for (const tema of Object.keys(TEMAS)) {
  for (const [nombre, fn, ancho, alto] of [
    ['simbolo', svgSimbolo, 1100, 1120],
    ['logo', svgLogo, 2160, 672],
  ]) {
    const base = `taikai-${nombre}-${tema}`
    const svg = join(salida, `${base}.svg`)
    writeFileSync(svg, fn(tema))
    // Página mínima que muestra el SVG (con la tipografía Inter) para fotografiarla
    const html = join(salida, `${base}.html`)
    writeFileSync(
      html,
      `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@600;900&display=swap"><style>html,body{margin:0;background:${TEMAS[tema].bg}}svg{display:block}</style>${fn(tema)}`
    )
    archivos.push({ base, html, ancho, alto })
  }
}

const chrome = process.argv[2] || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
for (const { base, html, ancho, alto } of archivos) {
  const png = join(salida, `${base}.png`)
  execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${ancho},${alto}`,
      '--virtual-time-budget=8000',
      `--screenshot=${png}`,
      pathToFileURL(resolve(html)).href,
    ],
    { stdio: 'ignore' }
  )
  console.log('OK', png)
}
