// Formatea una fecha como DD/MM/YYYY HH:MM:SS, sin depender del locale del sistema.
export default function formatDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0')
  const dd = pad(date.getDate())
  const mm = pad(date.getMonth() + 1)
  const yyyy = date.getFullYear()
  const hh = pad(date.getHours())
  const mi = pad(date.getMinutes())
  const ss = pad(date.getSeconds())
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`
}
