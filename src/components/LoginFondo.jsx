// Fondo decorativo de la pantalla de ingreso: patrón de motivos de artes marciales
// (sol naciente, cinturón, portal de dojo y kanji) que sigue el tema claro/oscuro.
function LoginFondo() {
  return (
    <svg className="login-fondo" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="login-patron" width="560" height="470" patternUnits="userSpaceOnUse">
          <g className="login-trazo">
            {/* sol naciente */}
            <circle cx="70" cy="80" r="34" className="login-relleno-rojo" stroke="none" />
            <circle cx="70" cy="80" r="52" />
            {/* portal de dojo */}
            <g transform="translate(250 40)">
              <path d="M0 14 Q40 -2 80 14" />
              <path d="M6 30 H74" />
              <path d="M16 14 V76 M64 14 V76" />
            </g>
            {/* cinturón con nudo */}
            <g transform="translate(60 250) rotate(-18)">
              <rect x="0" y="0" width="120" height="16" rx="3" />
              <rect x="46" y="-8" width="28" height="32" rx="5" />
              <path d="M60 24 L44 62 M60 24 L78 60" />
            </g>
            {/* kanji */}
            <text x="250" y="230" className="login-kanji">
              空手道
            </text>
            <text x="330" y="360" className="login-kanji login-kanji-chico">
              押忍
            </text>
            <text x="140" y="440" className="login-kanji login-kanji-chico">
              一本
            </text>
            {/* puntos */}
            <circle cx="510" cy="300" r="22" className="login-relleno" stroke="none" />
            <circle cx="190" cy="165" r="9" className="login-relleno" stroke="none" />
            <circle cx="30" cy="400" r="16" className="login-relleno" stroke="none" />
            <circle cx="520" cy="440" r="9" className="login-relleno" stroke="none" />
            <circle cx="480" cy="110" r="7" className="login-relleno" stroke="none" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#login-patron)" />
    </svg>
  )
}

export default LoginFondo
